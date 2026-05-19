# scraper/tests/test_portal_transparencia.py
import responses as resp_mock
from scraper.sources.portal_transparencia import coletar_transferencias

PORTAL_URL = "https://api.portaldatransparencia.gov.br/api-de-dados/transferencias-voluntarias"

MOCK_RESPONSE = [
    {
        "programa": {"nome": "SCFV"},
        "orgaoSuperior": {"nome": "MDS"},
        "valorEmpenhado": "500000.00",
        "valorLiquidado": "300000.00",
        "valorPago": "250000.00",
    }
]


@resp_mock.activate
def test_coletar_transferencias_retorna_rows_normalizadas():
    resp_mock.add(resp_mock.GET, PORTAL_URL, json=MOCK_RESPONSE, status=200)
    resp_mock.add(resp_mock.GET, PORTAL_URL, json=[], status=200)  # fim da paginação

    rows = coletar_transferencias("2803500", [2024])

    assert len(rows) == 1
    assert rows[0]["municipio_ibge"] == "2803500"
    assert rows[0]["programa"] == "SCFV"
    assert rows[0]["valor_empenhado"] == 500000.0
    assert rows[0]["valor_pago"] == 250000.0
    assert rows[0]["fonte"] == "portal_transparencia"


@resp_mock.activate
def test_coletar_transferencias_api_indisponivel_retorna_lista_vazia():
    import requests as req_lib
    resp_mock.add(resp_mock.GET, PORTAL_URL, body=req_lib.exceptions.ConnectionError("timeout"))

    rows = coletar_transferencias("2803500", [2024])

    assert rows == []


@resp_mock.activate
def test_coletar_transferencias_resposta_vazia():
    resp_mock.add(resp_mock.GET, PORTAL_URL, json=[], status=200)

    rows = coletar_transferencias("2803500", [2024])

    assert rows == []


@resp_mock.activate
def test_coletar_transferencias_programa_nulo_usa_default():
    """API retorna 'programa': null — deve usar 'DESCONHECIDO' sem crash."""
    resp_mock.add(resp_mock.GET, PORTAL_URL, json=[{
        "programa": None,
        "orgaoSuperior": None,
        "valorEmpenhado": "100000.00",
        "valorLiquidado": "50000.00",
        "valorPago": "50000.00",
    }], status=200)
    resp_mock.add(resp_mock.GET, PORTAL_URL, json=[], status=200)

    rows = coletar_transferencias("2803500", [2024])

    assert len(rows) == 1
    assert rows[0]["programa"] == "DESCONHECIDO"
    assert rows[0]["fundo"] == "FEDERAL"
