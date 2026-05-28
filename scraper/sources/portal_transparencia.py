# scraper/sources/portal_transparencia.py
"""
Coleta convênios federais por município via Portal da Transparência API.
Endpoint: /api-de-dados/convenios (filtro codigoIBGE).
Documentação: https://api.portaldatransparencia.gov.br/swagger-ui/index.html
"""
import time
import logging
from datetime import date
from typing import Optional
import requests
from scraper.config import PORTAL_API_KEY, RATE_LIMIT_SECONDS, USER_AGENT

log = logging.getLogger(__name__)

BASE_URL = "https://api.portaldatransparencia.gov.br/api-de-dados"


def _truncate(value: str, max_len: int) -> str:
    if len(value) > max_len:
        log.warning("portal_transparencia | programa truncated from %d to %d chars: %s...", len(value), max_len, value[:40])
        return value[:max_len]
    return value


def _parse_data_br(value: Optional[str]) -> Optional[str]:
    """Converte data da API ('DD/MM/AAAA' ou ISO) para 'YYYY-MM-DD'. None se inválida."""
    if not value or not isinstance(value, str):
        return None
    value = value.strip()
    # Formato BR DD/MM/AAAA
    if "/" in value and len(value) >= 10:
        try:
            dia, mes, ano = value[:10].split("/")
            return str(date(int(ano), int(mes), int(dia)))
        except (ValueError, TypeError):
            return None
    # Formato ISO YYYY-MM-DD
    if "-" in value and len(value) >= 10:
        try:
            return str(date.fromisoformat(value[:10]))
        except (ValueError, TypeError):
            return None
    return None


def _competencia_de(conv: dict) -> str:
    """Deriva competência (YYYY-01-01) a partir das datas do convênio; fallback ano corrente."""
    for campo in ("dataInicioVigencia", "dataReferencia", "dataPublicacao"):
        iso = _parse_data_br(conv.get(campo))
        if iso:
            return f"{iso[:4]}-01-01"
    return f"{date.today().year}-01-01"


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
        MAX_PAGES = 100
        while pagina <= MAX_PAGES:
            params["pagina"] = pagina
            try:
                r = requests.get(url, headers=self.headers, params=params, timeout=30)
                r.raise_for_status()
                data = r.json()
            except requests.RequestException as e:
                log.error("Portal Transparência erro em %s: %s", endpoint, e)
                break
            if not data:
                if pagina > 1:
                    log.debug(
                        "Portal Transparência | %s | paginação encerrada na página %d (lista vazia)",
                        endpoint, pagina,
                    )
                break
            results.extend(data)
            pagina += 1
            time.sleep(RATE_LIMIT_SECONDS)
        if pagina > MAX_PAGES:
            log.warning("Portal Transparência | %s | MAX_PAGES=%d atingido", endpoint, MAX_PAGES)
        return results

    def convenios_por_municipio(self, ibge: str) -> list[dict]:
        """Retorna lista de convênios federais para o município (código IBGE)."""
        return self._get_paginated("convenios", {"codigoIBGE": ibge})


def coletar_transferencias(ibge: str, anos: Optional[list[int]] = None) -> list[dict]:
    """
    Retorna rows prontas para inserção em transferencias_federais a partir dos convênios
    do município. O endpoint /convenios não filtra por ano — a competência é derivada
    por convênio. Parâmetro `anos` é aceito por compatibilidade mas ignorado.
    Calcula percentual_execucao (valorLiberado/valor * 100), critério primário do M1 Radar.
    """
    client = PortalTransparenciaClient()
    registros = client.convenios_por_municipio(ibge)
    log.info("  %s | %d convênios", ibge, len(registros))

    rows: list[dict] = []
    for r in registros:
        valor = float(r.get("valor") or 0)
        liberado = float(r.get("valorLiberado") or 0)
        pct = (liberado / valor * 100.0) if valor > 0 else 0.0
        programa = (r.get("dimConvenio") or {}).get("objeto") or "CONVÊNIO"
        fundo = (r.get("orgao") or {}).get("nome") or "FEDERAL"
        rows.append({
            "municipio_ibge":      ibge,
            "programa":            _truncate(programa, 100),
            "fundo":               _truncate(fundo, 100),
            "valor_empenhado":     valor,
            "valor_liquidado":     liberado,
            "valor_pago":          liberado,
            "percentual_execucao": round(pct, 2),
            "fonte":               "portal_transparencia",
            "competencia":         _competencia_de(r),
            "prazo_limite":        _parse_data_br(r.get("dataFinalVigencia")),
            "raw_json":            r,
        })
    return rows
