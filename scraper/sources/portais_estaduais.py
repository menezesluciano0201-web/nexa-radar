# scraper/sources/portais_estaduais.py
"""
Portais estaduais AL/SE/PE — Camada 2 (semi-automática).
O scraper tenta coletar; analista Nexa valida antes de publicar no painel.
Erros de scraping são esperados — portais mudam de layout sem aviso.
"""
import logging
import time
import requests
from scraper.config import USER_AGENT, RATE_LIMIT_SECONDS

log = logging.getLogger(__name__)

PORTAIS = {
    "AL": "https://transparencia.al.gov.br",
    "SE": "https://transparencia.se.gov.br",
    "PE": "https://transparencia.pe.gov.br",
}


def tentar_coletar_estadual(uf: str, ibge: str) -> list[dict]:
    """
    Tenta scraping do portal estadual. Retorna lista vazia se falhar.
    Resultado desta função DEVE ser validado manualmente antes de inserção.
    """
    if uf not in PORTAIS:
        log.warning("UF %s não mapeada nos portais estaduais", uf)
        return []

    url = PORTAIS[uf]
    try:
        r = requests.get(
            url,
            headers={"User-Agent": USER_AGENT},
            timeout=15,
        )
        r.raise_for_status()
        log.info("Portal %s respondeu (status %s) — parsing pendente de implementação", uf, r.status_code)
        return []
    except requests.RequestException as e:
        log.warning("Portal estadual %s indisponível: %s — requer validação manual", uf, e)
        return []
    finally:
        time.sleep(RATE_LIMIT_SECONDS)


def registrar_pendencia_manual(ibge: str, uf: str, descricao: str) -> None:
    """
    Registra no log uma pendência para o analista Nexa tratar manualmente.
    Em versões futuras, escrever numa tabela de pendencias_manuais no Supabase.
    """
    log.warning(
        "PENDÊNCIA MANUAL | ibge=%s | uf=%s | %s",
        ibge, uf, descricao,
    )
