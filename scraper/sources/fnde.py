# scraper/sources/fnde.py
"""
Coleta transferências FNDE: PNAE, PNATE, PDDE, Proinfância.
API: https://www.fnde.gov.br/dadosabertos
"""
import time
import logging
import requests
from scraper.config import RATE_LIMIT_SECONDS, USER_AGENT

log = logging.getLogger(__name__)

BASE_URL = "https://www.fnde.gov.br/sigetape/consultaPublica/get"
HEADERS = {"Accept": "application/json", "User-Agent": USER_AGENT}

PROGRAMAS_FNDE = {
    "PNAE":        "pnae",
    "PNATE":       "pnate",
    "PDDE":        "pdde",
    "PROINFANCIA": "proinfancia",
}


def _get_programa(programa_slug: str, ibge: str, ano: int) -> list[dict]:
    try:
        r = requests.get(
            f"{BASE_URL}/{programa_slug}",
            headers=HEADERS,
            params={"codigoIbge": ibge, "anoReferencia": ano},
            timeout=30,
        )
        r.raise_for_status()
        data = r.json()
        return data if isinstance(data, list) else []
    except requests.RequestException as e:
        log.error("FNDE %s | %s | %s", programa_slug, ibge, e)
        return []
    finally:
        time.sleep(RATE_LIMIT_SECONDS)


def coletar_fnde(ibge: str, anos: list[int]) -> list[dict]:
    """Retorna rows prontas para inserção em transferencias_federais."""
    rows: list[dict] = []
    for programa_nome, slug in PROGRAMAS_FNDE.items():
        for ano in anos:
            registros = _get_programa(slug, ibge, ano)
            for r in registros:
                rows.append({
                    "municipio_ibge":  ibge,
                    "programa":        programa_nome,
                    "fundo":           "FNDE",
                    "valor_empenhado": float(r.get("valorRepasse") or 0),
                    "valor_liquidado": float(r.get("valorEfetivado") or 0),
                    "valor_pago":      float(r.get("valorEfetivado") or 0),
                    "fonte":           "fnde",
                    "raw_json":        r,
                })
    log.info("FNDE | %s | %d registros", ibge, len(rows))
    return rows
