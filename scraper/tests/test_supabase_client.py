# scraper/tests/test_supabase_client.py
"""
Unit tests for supabase_client.py — pagination and error handling.
Mocks at the requests layer to avoid any network access.
"""
import responses as resp_mock
import requests as req_lib
from scraper.supabase_client import select, upsert

TABLE_URL = "https://test.supabase.co/rest/v1/transferencias_federais"
MUNICIPIOS_URL = "https://test.supabase.co/rest/v1/municipios_habilitacao"


@resp_mock.activate
def test_select_paginacao_para_em_416():
    """When PostgREST returns 416 (range beyond last row), loop stops cleanly."""
    # First page: full 1000 rows
    resp_mock.add(resp_mock.GET, TABLE_URL,
                  json=[{"id": str(i)} for i in range(1000)],
                  status=206)
    # Second page: 416 — range beyond end
    resp_mock.add(resp_mock.GET, TABLE_URL, json={}, status=416)

    rows = select("transferencias_federais")

    assert len(rows) == 1000  # only first page, no crash


@resp_mock.activate
def test_select_paginacao_multiplas_paginas():
    """select() fetches all pages when each page is full."""
    resp_mock.add(resp_mock.GET, TABLE_URL,
                  json=[{"id": str(i)} for i in range(1000)], status=206)
    resp_mock.add(resp_mock.GET, TABLE_URL,
                  json=[{"id": str(i)} for i in range(500)], status=206)

    rows = select("transferencias_federais")

    assert len(rows) == 1500


@resp_mock.activate
def test_select_pagina_unica():
    """select() works correctly when all results fit in one page."""
    resp_mock.add(resp_mock.GET, TABLE_URL,
                  json=[{"id": "1"}, {"id": "2"}], status=200)

    rows = select("transferencias_federais")

    assert len(rows) == 2


@resp_mock.activate
def test_select_erro_loga_e_levanta():
    """select() logs error and raises on unexpected non-2xx status."""
    resp_mock.add(resp_mock.GET, TABLE_URL, json={"message": "unauthorized"}, status=401)

    try:
        select("transferencias_federais")
        assert False, "Should have raised"
    except req_lib.exceptions.HTTPError:
        pass


@resp_mock.activate
def test_upsert_aceita_204():
    """upsert() does not log error on 204 No Content (PostgREST update path)."""
    resp_mock.add(resp_mock.POST, MUNICIPIOS_URL, status=204)

    # Should not raise
    upsert("municipios_habilitacao", [{"ibge": "2803500", "cauc_regular": False}],
           on_conflict="ibge")
