# scraper/sources/transferegov.py
"""
Coleta convênios e instrumentos via API Transferegov.
Sem autenticação para leitura pública.
"""
import time
import logging
import requests
from scraper.config import RATE_LIMIT_SECONDS, USER_AGENT

log = logging.getLogger(__name__)

BASE_URL = "https://api.transferegov.sistema.gov.br/api"
HEADERS = {"Accept": "application/json", "User-Agent": USER_AGENT}


def _get(endpoint: str, params: dict) -> list[dict]:
    results: list[dict] = []
    pagina = 1
    while True:
        params["pagina"] = pagina
        params["tamanhoPagina"] = 100
        try:
            r = requests.get(
                f"{BASE_URL}/{endpoint}",
                headers=HEADERS,
                params=params,
                timeout=30,
            )
            r.raise_for_status()
            data = r.json()
        except requests.RequestException as e:
            log.error("Transferegov erro em %s: %s", endpoint, e)
            break
        items = data if isinstance(data, list) else data.get("data", [])
        if not items:
            break
        results.extend(items)
        pagina += 1
        time.sleep(RATE_LIMIT_SECONDS)
    return results


def coletar_convenios(ibge: str) -> list[dict]:
    """Retorna rows prontas para inserção em transferencias_federais."""
    registros = _get("convenios", {"codigoMunicipioIbge": ibge})
    rows: list[dict] = []
    for r in registros:
        rows.append({
            "municipio_ibge":  ibge,
            "programa":        (r.get("objeto") or "CONVENIO")[:100],
            "fundo":           (r.get("orgaoSuperior") or {}).get("nome", "FEDERAL"),
            "valor_empenhado": float(r.get("valorGlobal") or 0),
            "valor_liquidado": float(r.get("valorDesembolsado") or 0),
            "valor_pago":      float(r.get("valorDesembolsado") or 0),
            "fonte":           "transferegov",
            "competencia":     None,
            "raw_json":        r,
        })
    log.info("Transferegov | %s | %d convênios", ibge, len(rows))
    return rows
