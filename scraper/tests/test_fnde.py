# scraper/tests/test_fnde.py
import responses as resp_mock
import requests as req_lib
from scraper.sources.fnde import coletar_fnde, PROGRAMAS_FNDE

BASE = "https://www.fnde.gov.br/sigetape/consultaPublica/get"


@resp_mock.activate
def test_coletar_fnde_retorna_rows_para_um_programa():
    # Mock PNAE 2024 with one record, all other programs empty
    for slug in PROGRAMAS_FNDE.values():
        if slug == "pnae":
            resp_mock.add(resp_mock.GET, f"{BASE}/{slug}",
                          json=[{"valorRepasse": "200000.00", "valorEfetivado": "150000.00"}],
                          status=200)
        else:
            resp_mock.add(resp_mock.GET, f"{BASE}/{slug}", json=[], status=200)

    rows = coletar_fnde("2803500", [2024])

    pnae_rows = [r for r in rows if r["programa"] == "PNAE"]
    assert len(pnae_rows) == 1
    assert pnae_rows[0]["municipio_ibge"] == "2803500"
    assert pnae_rows[0]["valor_empenhado"] == 200000.0
    assert pnae_rows[0]["competencia"] == "2024-01-01"
    assert pnae_rows[0]["fonte"] == "fnde"


@resp_mock.activate
def test_coletar_fnde_api_error_retorna_lista_vazia():
    for slug in PROGRAMAS_FNDE.values():
        resp_mock.add(resp_mock.GET, f"{BASE}/{slug}",
                      body=req_lib.exceptions.ConnectionError("timeout"))

    rows = coletar_fnde("2803500", [2024])

    assert rows == []
