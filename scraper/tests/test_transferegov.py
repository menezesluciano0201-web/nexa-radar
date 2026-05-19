# scraper/tests/test_transferegov.py
import responses as resp_mock
import requests as req_lib
from datetime import date
from scraper.sources.transferegov import coletar_convenios, _extrair_competencia

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
    # No date fields in mock → falls back to current year; must never be None
    assert rows[0]["competencia"] == f"{date.today().year}-01-01"


def test_extrair_competencia_usa_dataAssinatura():
    assert _extrair_competencia({"dataAssinatura": "2024-03-15"}) == "2024-01-01"


def test_extrair_competencia_fallback_dataFimVigencia():
    assert _extrair_competencia({"dataAssinatura": None, "dataFimVigencia": "2023-12-31"}) == "2023-01-01"


def test_extrair_competencia_fallback_ano_corrente():
    assert _extrair_competencia({}) == f"{date.today().year}-01-01"


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
