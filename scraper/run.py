# scraper/run.py
"""
Entry point do cron job semanal.
Execução: python -m scraper.run
"""
import logging
import sys
from datetime import datetime

from scraper.config import MUNICIPIOS_ATIVOS
from scraper.supabase_client import upsert
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

ANOS = [datetime.now().year, datetime.now().year - 1]


def coletar_municipio(ibge: str, nome: str) -> None:
    log.info("=== Iniciando coleta | %s (%s) ===", nome, ibge)

    # Transferências Portal Transparência
    rows_portal = coletar_transferencias(ibge, ANOS)
    if rows_portal:
        upsert("transferencias_federais", rows_portal,
               on_conflict="municipio_ibge,programa,fonte,competencia")

    # Convênios Transferegov
    rows_tgov = coletar_convenios(ibge)
    if rows_tgov:
        upsert("transferencias_federais", rows_tgov,
               on_conflict="municipio_ibge,programa,fonte,competencia")

    # FNDE
    rows_fnde = coletar_fnde(ibge, ANOS)
    if rows_fnde:
        upsert("transferencias_federais", rows_fnde,
               on_conflict="municipio_ibge,programa,fonte,competencia")

    # Portais estaduais (semi-automático)
    uf = nome.split(" - ")[-1] if " - " in nome else ""
    estadual = tentar_coletar_estadual(uf, ibge)
    if not estadual:
        registrar_pendencia_manual(ibge, uf, "Coleta estadual requer validação manual")

    # Processar
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
    log.info("Nexa Radar — Início da coleta %s", datetime.now().isoformat())

    for nome, ibge in MUNICIPIOS_ATIVOS.items():
        try:
            coletar_municipio(ibge, nome)
        except Exception as e:
            log.error("Falha em %s (%s): %s", nome, ibge, e, exc_info=True)

    for ano in ANOS:
        try:
            coletar_emendas(ano)
        except Exception as e:
            log.error("Falha emendas %d: %s", ano, e, exc_info=True)

    log.info("Nexa Radar — Coleta concluída")


if __name__ == "__main__":
    main()
