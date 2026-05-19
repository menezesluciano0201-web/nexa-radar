# scraper/sources/portal_transparencia.py
"""
Coleta transferências voluntárias federais por município via Portal da Transparência API.
Documentação: https://api.portaldatransparencia.gov.br/swagger-ui.html
"""
import time
import logging
import requests
from scraper.config import PORTAL_API_KEY, RATE_LIMIT_SECONDS, USER_AGENT

log = logging.getLogger(__name__)

BASE_URL = "https://api.portaldatransparencia.gov.br/api-de-dados"


class PortalTransparenciaClient:
    def __init__(self) -> None:
        self.headers = {
            "chave-api-dados": PORTAL_API_KEY,
            "Accept": "application/json",
            "User-Agent": USER_AGENT,
        }

    def _get_paginated(self, endpoint: str, params: dict) -> list[dict]:
        url = f"{BASE_URL}/{endpoint}"
        results: list[dict] = []
        pagina = 1
        while True:
            params["pagina"] = pagina
            try:
                r = requests.get(url, headers=self.headers, params=params, timeout=30)
                r.raise_for_status()
                data = r.json()
            except requests.RequestException as e:
                log.error("Portal Transparência erro em %s: %s", endpoint, e)
                break
            if not data:
                break
            results.extend(data)
            pagina += 1
            time.sleep(RATE_LIMIT_SECONDS)
        return results

    def transferencias_por_municipio(self, ibge: str, ano: int) -> list[dict]:
        """Retorna lista de transferências voluntárias para o município no ano."""
        return self._get_paginated(
            "transferencias-voluntarias",
            {"codigoIbge": ibge, "ano": ano},
        )


def coletar_transferencias(ibge: str, anos: list[int]) -> list[dict]:
    """
    Retorna rows prontas para inserção em transferencias_federais.
    """
    client = PortalTransparenciaClient()
    rows: list[dict] = []
    for ano in anos:
        registros = client.transferencias_por_municipio(ibge, ano)
        log.info("  %s | %d | %d registros", ibge, ano, len(registros))
        for r in registros:
            rows.append({
                "municipio_ibge":  ibge,
                "programa":        (r.get("programa") or {}).get("nome", "DESCONHECIDO"),
                "fundo":           (r.get("orgaoSuperior") or {}).get("nome", "FEDERAL"),
                "valor_empenhado": float(r.get("valorEmpenhado") or 0),
                "valor_liquidado": float(r.get("valorLiquidado") or 0),
                "valor_pago":      float(r.get("valorPago") or 0),
                "fonte":           "portal_transparencia",
                "raw_json":        r,
            })
    return rows
