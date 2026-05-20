# scraper/tests/test_portais_estaduais.py
import responses as resp_mock
import requests as req_lib
from scraper.sources.portais_estaduais import tentar_coletar_estadual

PORTAL_AL = "https://transparencia.al.gov.br"


@resp_mock.activate
def test_uf_mapeada_portal_acessivel_retorna_none_pois_parsing_pendente():
    """Portal responds but parsing is not yet implemented — returns None (not [])."""
    resp_mock.add(resp_mock.GET, PORTAL_AL, body="<html>...</html>", status=200)

    result = tentar_coletar_estadual("AL", "2702207")

    assert result is None


@resp_mock.activate
def test_portal_indisponivel_retorna_none():
    """Unreachable portal returns None (pending manual validation)."""
    resp_mock.add(resp_mock.GET, PORTAL_AL, body=req_lib.exceptions.ConnectionError("timeout"))

    result = tentar_coletar_estadual("AL", "2702207")

    assert result is None


def test_uf_nao_mapeada_retorna_none():
    """Unmapped UF returns None without making any network call."""
    result = tentar_coletar_estadual("XX", "9999999")

    assert result is None
