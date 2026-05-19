# scraper/tests/test_processors.py
from datetime import date, timedelta
from unittest.mock import patch
from scraper.processors.calcular_subexecucao import (
    calcular_por_municipio,
    valor_total_em_risco,
)


def _mock_select(rows):
    """Returns a mock for scraper.supabase_client.select."""
    def _select(table, filters=None, columns="*"):
        return rows
    return _select


def test_programa_abaixo_de_70_pct_marcado_em_risco():
    rows = [{
        "programa": "SCFV",
        "fundo": "FNAS",
        "valor_empenhado": "1000000",
        "valor_pago": "500000",
        "percentual_execucao": "50.00",
        "prazo_limite": None,
    }]
    with patch("scraper.processors.calcular_subexecucao.select", side_effect=_mock_select(rows)):
        resultado = calcular_por_municipio("2803500")

    assert len(resultado) == 1
    assert resultado[0].programa == "SCFV"
    assert resultado[0].em_risco is True
    assert resultado[0].percentual_execucao == 50.0


def test_programa_acima_de_70_pct_sem_prazo_nao_aparece():
    rows = [{
        "programa": "PNAE",
        "fundo": "FNDE",
        "valor_empenhado": "100000",
        "valor_pago": "80000",
        "percentual_execucao": "80.00",
        "prazo_limite": None,
    }]
    with patch("scraper.processors.calcular_subexecucao.select", side_effect=_mock_select(rows)):
        resultado = calcular_por_municipio("2803500")

    assert resultado == []


def test_valor_total_em_risco_soma_diferenca():
    rows = [
        {"programa": "SCFV",  "fundo": "FNAS", "valor_empenhado": "1000000",
         "valor_pago": "400000", "percentual_execucao": "40.00", "prazo_limite": None},
        {"programa": "PNAE",  "fundo": "FNDE", "valor_empenhado": "200000",
         "valor_pago": "100000", "percentual_execucao": "50.00", "prazo_limite": None},
    ]
    with patch("scraper.processors.calcular_subexecucao.select", side_effect=_mock_select(rows)):
        total = valor_total_em_risco("2803500")

    assert total == 700_000.0  # (1M-400k) + (200k-100k)


def test_programa_acima_de_70_pct_com_prazo_proximo_marcado_em_risco():
    """Programa com alta execução mas prazo vencendo em 30 dias deve ser flagged."""
    prazo = (date.today() + timedelta(days=30)).isoformat()
    rows = [{
        "programa": "PNAE",
        "fundo": "FNDE",
        "valor_empenhado": "100000",
        "valor_pago": "80000",
        "percentual_execucao": "80.00",
        "prazo_limite": prazo,
    }]
    with patch("scraper.processors.calcular_subexecucao.select", side_effect=_mock_select(rows)):
        resultado = calcular_por_municipio("2803500")

    assert len(resultado) == 1
    assert resultado[0].em_risco is True
    assert resultado[0].prazo_limite == prazo


def test_programa_acima_de_70_pct_com_prazo_distante_nao_aparece():
    """Programa com alta execução e prazo distante (>90 dias) não é risco."""
    prazo = (date.today() + timedelta(days=120)).isoformat()
    rows = [{
        "programa": "PNAE",
        "fundo": "FNDE",
        "valor_empenhado": "100000",
        "valor_pago": "80000",
        "percentual_execucao": "80.00",
        "prazo_limite": prazo,
    }]
    with patch("scraper.processors.calcular_subexecucao.select", side_effect=_mock_select(rows)):
        resultado = calcular_por_municipio("2803500")

    assert resultado == []
