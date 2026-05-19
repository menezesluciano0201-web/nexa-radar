# scraper/tests/test_transferegov.py
import responses as resp_mock
import requests as req_lib
from scraper.sources.transferegov import coletar_convenios

TGOV_URL = "https://api.transferegov.sistema.gov.br/api/convenios"

MOCK_CONVENIO = {
    "objeto": "Aquisição de equipamentos de saúde",
    "orgaoSuperior": {"nome": "MS"},
    "valorGlobal": "500000.00",
    "valorDesembolsado": "300000.00",
}


@resp_mock.activate
def test_coletar_convenios_retorna_rows_normalizadas():
    resp_mock.add(resp_mock.GET, TGOV_URL, json=[MOCK_CONVENIO], status=200)
    resp_mock.add(resp_mock.GET, TGOV_URL, json=[], status=200)

    rows = coletar_convenios("2803500")

    assert len(rows) == 1
    assert rows[0]["municipio_ibge"] == "2803500"
    assert rows[0]["valor_empenhado"] == 500000.0
    assert rows[0]["valor_pago"] == 300000.0
    assert rows[0]["fonte"] == "transferegov"
    assert rows[0]["competencia"] is None


@resp_mock.activate
def test_coletar_convenios_api_indisponivel_retorna_lista_vazia():
    resp_mock.add(resp_mock.GET, TGOV_URL,
                  body=req_lib.exceptions.ConnectionError("timeout"))

    rows = coletar_convenios("2803500")

    assert rows == []


@resp_mock.activate
def test_coletar_convenios_objeto_nulo_usa_default():
    resp_mock.add(resp_mock.GET, TGOV_URL,
                  json=[{"objeto": None, "orgaoSuperior": None,
                         "valorGlobal": "100000.00", "valorDesembolsado": "50000.00"}],
                  status=200)
    resp_mock.add(resp_mock.GET, TGOV_URL, json=[], status=200)

    rows = coletar_convenios("2803500")

    assert rows[0]["programa"] == "CONVENIO"
    assert rows[0]["fundo"] == "FEDERAL"
