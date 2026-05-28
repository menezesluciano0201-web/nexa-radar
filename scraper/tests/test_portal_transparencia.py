# scraper/tests/test_portal_transparencia.py
import responses as resp_mock
from scraper.sources.portal_transparencia import coletar_transferencias, _parse_data_br

PORTAL_URL = "https://api.portaldatransparencia.gov.br/api-de-dados/convenios"

MOCK_CONVENIO = {
    "dimConvenio": {"objeto": "Construção de creche municipal", "numero": "123"},
    "orgao": {"nome": "Ministério da Educação"},
    "valor": "500000.00",
    "valorLiberado": "250000.00",
    "dataInicioVigencia": "01/03/2024",
    "dataFinalVigencia": "31/12/2026",
}


@resp_mock.activate
def test_coletar_transferencias_retorna_rows_normalizadas():
    resp_mock.add(resp_mock.GET, PORTAL_URL, json=[MOCK_CONVENIO], status=200)
    resp_mock.add(resp_mock.GET, PORTAL_URL, json=[], status=200)  # fim da paginação

    rows = coletar_transferencias("2803500")

    assert len(rows) == 1
    assert rows[0]["municipio_ibge"] == "2803500"
    assert rows[0]["programa"] == "Construção de creche municipal"
    assert rows[0]["fundo"] == "Ministério da Educação"
    assert rows[0]["valor_empenhado"] == 500000.0
    assert rows[0]["valor_pago"] == 250000.0
    assert rows[0]["percentual_execucao"] == 50.0
    assert rows[0]["fonte"] == "portal_transparencia"
    assert rows[0]["competencia"] == "2024-01-01"
    assert rows[0]["prazo_limite"] == "2026-12-31"


@resp_mock.activate
def test_coletar_transferencias_api_indisponivel_retorna_lista_vazia():
    import requests as req_lib
    resp_mock.add(resp_mock.GET, PORTAL_URL, body=req_lib.exceptions.ConnectionError("timeout"))

    rows = coletar_transferencias("2803500")

    assert rows == []


@resp_mock.activate
def test_coletar_transferencias_resposta_vazia():
    resp_mock.add(resp_mock.GET, PORTAL_URL, json=[], status=200)

    rows = coletar_transferencias("2803500")

    assert rows == []


@resp_mock.activate
def test_coletar_transferencias_objeto_nulo_usa_default():
    """API retorna dimConvenio/orgao null — deve usar defaults sem crash."""
    resp_mock.add(resp_mock.GET, PORTAL_URL, json=[{
        "dimConvenio": None,
        "orgao": None,
        "valor": "100000.00",
        "valorLiberado": "0",
    }], status=200)
    resp_mock.add(resp_mock.GET, PORTAL_URL, json=[], status=200)

    rows = coletar_transferencias("2803500")

    assert len(rows) == 1
    assert rows[0]["programa"] == "CONVÊNIO"
    assert rows[0]["fundo"] == "FEDERAL"
    assert rows[0]["percentual_execucao"] == 0.0
    assert rows[0]["prazo_limite"] is None


def test_parse_data_br_formato_brasileiro():
    assert _parse_data_br("31/12/2026") == "2026-12-31"


def test_parse_data_br_formato_iso():
    assert _parse_data_br("2026-12-31") == "2026-12-31"


def test_parse_data_br_invalida_retorna_none():
    assert _parse_data_br(None) is None
    assert _parse_data_br("") is None
    assert _parse_data_br("data inválida") is None
