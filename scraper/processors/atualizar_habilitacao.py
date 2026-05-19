# scraper/processors/atualizar_habilitacao.py
"""
Atualiza a tabela municipios_habilitacao com programas habilitados
baseado nos dados coletados de transferencias_federais.
"""
import logging
from datetime import datetime, timezone
from scraper.supabase_client import select, upsert

log = logging.getLogger(__name__)


def atualizar_programas_habilitados(ibge: str) -> None:
    """
    Infere programas habilitados a partir dos programas que já tiveram
    transferências no histórico. Atualiza municipios_habilitacao.

    Pré-requisito: a tabela municipios_habilitacao deve conter a linha com
    este ibge (populada pelo seed). Se não existir, a operação é abortada.
    """
    # Verify municipality exists before attempting update-only upsert
    existing = select("municipios_habilitacao", filters={"ibge": ibge}, columns="ibge")
    if not existing:
        log.error("Município %s não encontrado em municipios_habilitacao — execute o seed primeiro", ibge)
        return

    rows = select(
        "transferencias_federais",
        filters={"municipio_ibge": ibge},
        columns="programa,valor_empenhado",
    )

    habilitados = list({
        r["programa"]
        for r in rows
        if r.get("valor_empenhado") and float(r["valor_empenhado"]) > 0
    })

    upsert(
        "municipios_habilitacao",
        [{
            "ibge": ibge,
            "programas_habilitados": habilitados,
            "ultima_verificacao": datetime.now(timezone.utc).isoformat(),
        }],
        on_conflict="ibge",
    )
    log.info("Habilitação | %s | %d programas", ibge, len(habilitados))


def marcar_cauc_irregular(ibge: str) -> None:
    """
    Marca município como irregular no CAUC após verificação manual.
    Pré-requisito: município deve existir em municipios_habilitacao.
    """
    existing = select("municipios_habilitacao", filters={"ibge": ibge}, columns="ibge")
    if not existing:
        log.error("Município %s não encontrado em municipios_habilitacao — execute o seed primeiro", ibge)
        return
    upsert(
        "municipios_habilitacao",
        [{"ibge": ibge, "cauc_regular": False,
          "ultima_verificacao": datetime.now(timezone.utc).isoformat()}],
        on_conflict="ibge",
    )
    log.warning("CAUC irregular marcado | %s", ibge)
