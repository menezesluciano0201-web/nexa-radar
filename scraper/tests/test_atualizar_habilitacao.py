# scraper/tests/test_atualizar_habilitacao.py
from unittest.mock import patch, call
from scraper.processors.atualizar_habilitacao import (
    atualizar_programas_habilitados,
    marcar_cauc_irregular,
)


def _mock_select_returns(rows):
    def _select(table, filters=None, columns="*"):
        if table == "municipios_habilitacao":
            return [{"ibge": "2803500"}]  # municipality exists
        return rows
    return _select


def _mock_select_empty():
    def _select(table, filters=None, columns="*"):
        return []  # municipality NOT in table
    return _select


def test_atualizar_programas_habilitados_upsert_com_programas():
    transfer_rows = [
        {"programa": "SCFV", "valor_empenhado": "500000"},
        {"programa": "PNAE", "valor_empenhado": "200000"},
        {"programa": "CAPS", "valor_empenhado": "0"},  # zero — should be excluded
    ]
    with patch("scraper.processors.atualizar_habilitacao.select",
               side_effect=_mock_select_returns(transfer_rows)) as mock_sel, \
         patch("scraper.processors.atualizar_habilitacao.upsert") as mock_ups:

        atualizar_programas_habilitados("2803500")

    mock_ups.assert_called_once()
    call_args = mock_ups.call_args
    payload = call_args[0][1][0]
    assert set(payload["programas_habilitados"]) == {"SCFV", "PNAE"}
    assert "ultima_verificacao" in payload


def test_atualizar_programas_municipio_nao_encontrado_nao_upserta():
    with patch("scraper.processors.atualizar_habilitacao.select",
               side_effect=_mock_select_empty()), \
         patch("scraper.processors.atualizar_habilitacao.upsert") as mock_ups:

        atualizar_programas_habilitados("9999999")

    mock_ups.assert_not_called()


def test_marcar_cauc_irregular_chama_upsert():
    with patch("scraper.processors.atualizar_habilitacao.select",
               side_effect=_mock_select_returns([])), \
         patch("scraper.processors.atualizar_habilitacao.upsert") as mock_ups:

        marcar_cauc_irregular("2803500")

    mock_ups.assert_called_once()
    payload = mock_ups.call_args[0][1][0]
    assert payload["cauc_regular"] is False
