# scraper/tests/test_siga_brasil.py
from unittest.mock import patch, MagicMock
from scraper.sources.siga_brasil import coletar_emendas_individuais

MOCK_SPARQL_RESULT = {
    "results": {
        "bindings": [
            {
                "autoria":         {"value": "DEP12345"},
                "nomeAutor":       {"value": "João Silva"},
                "codigoIbge":      {"value": "2803500"},
                "area":            {"value": "Saúde"},
                "valorAutorizado": {"value": "1000000.00"},
                "valorEmpenhado":  {"value": "800000.00"},
            }
        ]
    }
}

MOCK_SPARQL_MISSING_IBGE = {
    "results": {
        "bindings": [
            {
                "autoria":         {"value": "DEP99999"},
                "nomeAutor":       {"value": "Maria Santos"},
                # codigoIbge absent — should be skipped
                "area":            {"value": "Educação"},
                "valorAutorizado": {"value": "500000.00"},
                "valorEmpenhado":  {"value": "400000.00"},
            }
        ]
    }
}


def test_coletar_emendas_retorna_rows_normalizadas():
    with patch("scraper.sources.siga_brasil.SPARQLWrapper") as mock_sparql:
        instance = MagicMock()
        instance.query.return_value.convert.return_value = MOCK_SPARQL_RESULT
        mock_sparql.return_value = instance

        rows = coletar_emendas_individuais(2024)

    assert len(rows) == 1
    assert rows[0]["parlamentar_id"] == "DEP12345"
    assert rows[0]["municipio_ibge"] == "2803500"
    assert rows[0]["tipo"] == "RP6"
    assert rows[0]["parlamentar_tipo"] == "individual"
    assert rows[0]["valor_autorizado"] == 1_000_000.0
    assert rows[0]["exercicio"] == 2024
    assert rows[0]["fonte"] == "siga_brasil"


def test_coletar_emendas_sparql_erro_retorna_lista_vazia():
    with patch("scraper.sources.siga_brasil.SPARQLWrapper") as mock_sparql:
        instance = MagicMock()
        instance.query.side_effect = Exception("connection refused")
        mock_sparql.return_value = instance

        rows = coletar_emendas_individuais(2024)

    assert rows == []


def test_coletar_emendas_sem_ibge_e_ignorada():
    """Binding sem codigoIbge deve ser ignorada silenciosamente."""
    with patch("scraper.sources.siga_brasil.SPARQLWrapper") as mock_sparql:
        instance = MagicMock()
        instance.query.return_value.convert.return_value = MOCK_SPARQL_MISSING_IBGE
        mock_sparql.return_value = instance

        rows = coletar_emendas_individuais(2024)

    assert rows == []
