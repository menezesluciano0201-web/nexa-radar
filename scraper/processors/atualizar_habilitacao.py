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
    """
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
    """Marca município como irregular no CAUC após verificação manual."""
    upsert(
        "municipios_habilitacao",
        [{"ibge": ibge, "cauc_regular": False,
          "ultima_verificacao": datetime.now(timezone.utc).isoformat()}],
        on_conflict="ibge",
    )
    log.warning("CAUC irregular marcado | %s", ibge)
