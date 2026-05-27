# scraper/run.py
"""
Entry point dos scrapers Nexa Radar.
Execução:
  python -m scraper.run                                       # comportamento legado (MUNICIPIOS_ATIVOS, todas as fontes)
  python -m scraper.run --source transferegov --ufs AL,SE     # M1 Radar: só transferegov, UFs alvo
"""
import argparse
import logging
import sys
from datetime import datetime
from typing import Iterable

from scraper.config import MUNICIPIOS_ATIVOS, IBGE_TO_UF
from scraper.supabase_client import upsert, select
from scraper.sources.portal_transparencia import coletar_transferencias
from scraper.sources.siga_brasil import coletar_emendas_individuais
from scraper.sources.transferegov import coletar_convenios
from scraper.sources.fnde import coletar_fnde
from scraper.sources.portais_estaduais import tentar_coletar_estadual, registrar_pendencia_manual
from scraper.processors.calcular_subexecucao import calcular_por_municipio
from scraper.processors.atualizar_habilitacao import atualizar_programas_habilitados

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
log = logging.getLogger("nexaradar.run")


def fetch_municipios_por_uf(ufs: list[str]) -> list[tuple[str, str]]:
    """Busca (ibge, nome) de todos os municípios das UFs alvo via Supabase."""
    rows = select("municipios_habilitacao", filters={}, columns="ibge,nome,uf")
    return [(r["ibge"], f"{r['nome']} - {r['uf']}") for r in rows if r.get("uf") in ufs]


def run_transferegov(municipios: Iterable[tuple[str, str]]) -> None:
    """M1 Radar: coleta SÓ Transferegov para os municípios fornecidos.
    AVISO: api.transferegov.sistema.gov.br foi descontinuada/nunca existiu (NXDOMAIN).
    Mantido para retrocompatibilidade; use --source portal_transparencia.
    """
    total = 0
    for ibge, nome in municipios:
        try:
            rows = coletar_convenios(ibge)
            if rows:
                upsert(
                    "transferencias_federais",
                    rows,
                    on_conflict="municipio_ibge,programa,fonte,competencia",
                )
                total += len(rows)
        except Exception as e:
            log.error("Transferegov falhou em %s (%s): %s", nome, ibge, e, exc_info=True)
    log.info("Transferegov | TOTAL upserts: %d", total)


def run_portal_transparencia(municipios: Iterable[tuple[str, str]], anos: list[int]) -> None:
    """M1 Radar: coleta Portal da Transparência (transferências voluntárias) para os municípios fornecidos.
    Requer PORTAL_TRANSPARENCIA_API_KEY no ambiente — falha imediatamente sem.
    """
    from scraper.config import PORTAL_API_KEY
    if not PORTAL_API_KEY:
        log.error("PORTAL_TRANSPARENCIA_API_KEY ausente — abortando. Cadastre em "
                  "https://api.portaldatransparencia.gov.br/swagger-ui/index.html")
        sys.exit(1)

    total = 0
    for ibge, nome in municipios:
        try:
            rows = coletar_transferencias(ibge, anos)
            if rows:
                upsert(
                    "transferencias_federais",
                    rows,
                    on_conflict="municipio_ibge,programa,fonte,competencia",
                )
                total += len(rows)
        except Exception as e:
            log.error("Portal Transparência falhou em %s (%s): %s", nome, ibge, e, exc_info=True)
    log.info("Portal Transparência | TOTAL upserts: %d (anos: %s)", total, anos)


def coletar_municipio_full(ibge: str, nome: str, anos: list[int]) -> None:
    """Comportamento legado: todas as fontes para um município."""
    log.info("=== Iniciando coleta | %s (%s) ===", nome, ibge)

    rows_portal = coletar_transferencias(ibge, anos)
    if rows_portal:
        upsert("transferencias_federais", rows_portal,
               on_conflict="municipio_ibge,programa,fonte,competencia")

    rows_tgov = coletar_convenios(ibge)
    if rows_tgov:
        upsert("transferencias_federais", rows_tgov,
               on_conflict="municipio_ibge,programa,fonte,competencia")

    rows_fnde = coletar_fnde(ibge, anos)
    if rows_fnde:
        upsert("transferencias_federais", rows_fnde,
               on_conflict="municipio_ibge,programa,fonte,competencia")

    uf = IBGE_TO_UF.get(ibge, "")
    estadual = tentar_coletar_estadual(uf, ibge)
    if estadual is None:
        registrar_pendencia_manual(ibge, uf, "Coleta estadual requer validação manual")
    elif estadual:
        upsert("transferencias_federais", estadual,
               on_conflict="municipio_ibge,programa,fonte,competencia")

    atualizar_programas_habilitados(ibge)
    em_risco = calcular_por_municipio(ibge)
    log.info("  %d programas em risco identificados", len(em_risco))


def coletar_emendas(ano: int) -> None:
    log.info("=== Coletando emendas SIGA Brasil | %d ===", ano)
    rows = coletar_emendas_individuais(ano)
    if rows:
        upsert("emendas_parlamentares", rows,
               on_conflict="parlamentar_id,municipio_ibge,exercicio,fonte")


def main() -> None:
    parser = argparse.ArgumentParser(description="Nexa Radar scrapers")
    parser.add_argument(
        "--source",
        choices=["transferegov", "portal_transparencia", "full"],
        default="full",
        help="'portal_transparencia' = M1 Radar (recomendado); 'transferegov' = legado/descontinuado; 'full' = todas (legado)",
    )
    parser.add_argument(
        "--ufs",
        type=str,
        default="",
        help="UFs separadas por vírgula (ex: AL,SE,PE,BA). Vazio = usa MUNICIPIOS_ATIVOS.",
    )
    args = parser.parse_args()

    log.info("Nexa Radar — Início | source=%s | ufs=%s | %s",
             args.source, args.ufs or "MUNICIPIOS_ATIVOS", datetime.now().isoformat())

    if args.source in ("transferegov", "portal_transparencia"):
        if args.ufs:
            ufs_list = [u.strip().upper() for u in args.ufs.split(",") if u.strip()]
            municipios = fetch_municipios_por_uf(ufs_list)
            log.info("M1 Radar | %d municípios das UFs %s", len(municipios), ufs_list)
        else:
            municipios = [(ibge, nome) for nome, ibge in MUNICIPIOS_ATIVOS.items()]

        if args.source == "transferegov":
            run_transferegov(municipios)
        else:
            hoje = datetime.now()
            anos = [hoje.year, hoje.year - 1]
            run_portal_transparencia(municipios, anos)
    else:
        # 'full' = comportamento legado
        hoje = datetime.now()
        anos = [hoje.year, hoje.year - 1]
        for nome, ibge in MUNICIPIOS_ATIVOS.items():
            try:
                coletar_municipio_full(ibge, nome, anos)
            except Exception as e:
                log.error("Falha em %s (%s): %s", nome, ibge, e, exc_info=True)
        for ano in anos:
            try:
                coletar_emendas(ano)
            except Exception as e:
                log.error("Falha emendas %d: %s", ano, e, exc_info=True)

    log.info("Nexa Radar — Coleta concluída")


if __name__ == "__main__":
    main()
