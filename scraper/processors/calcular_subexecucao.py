# scraper/processors/calcular_subexecucao.py
"""
Calcula subexecução por município/programa e identifica valores em risco.
Opera sobre dados já inseridos em transferencias_federais no Supabase.
"""
import logging
from dataclasses import dataclass
from datetime import date
from typing import Optional
from scraper.supabase_client import select

log = logging.getLogger(__name__)

PRAZO_ALERTA_DIAS = 90   # programas com prazo nos próximos 90 dias = em risco


@dataclass
class SubexecucaoPrograma:
    municipio_ibge: str
    programa: str
    fundo: str
    valor_empenhado: float
    valor_pago: float
    percentual_execucao: float
    prazo_limite: Optional[str]
    em_risco: bool


def calcular_por_municipio(ibge: str) -> list[SubexecucaoPrograma]:
    """
    Retorna programas com subexecução para o município.
    Definição de 'em risco': execução < 70% OU prazo nos próximos 90 dias.
    """
    rows = select(
        "transferencias_federais",
        filters={"municipio_ibge": ibge},
        columns="programa,fundo,valor_empenhado,valor_pago,percentual_execucao,prazo_limite",
    )

    resultado: list[SubexecucaoPrograma] = []
    for r in rows:
        if not r.get("valor_empenhado"):
            continue
        pct = float(r.get("percentual_execucao") or 0)
        prazo = r.get("prazo_limite")

        em_risco = pct < 70.0
        if prazo:
            dias = (date.fromisoformat(prazo) - date.today()).days
            if dias <= PRAZO_ALERTA_DIAS:
                em_risco = True

        if em_risco:
            resultado.append(SubexecucaoPrograma(
                municipio_ibge=ibge,
                programa=r["programa"],
                fundo=r["fundo"],
                valor_empenhado=float(r["valor_empenhado"]),
                valor_pago=float(r.get("valor_pago") or 0),
                percentual_execucao=pct,
                prazo_limite=prazo,
                em_risco=True,
            ))

    resultado.sort(key=lambda x: x.percentual_execucao)
    log.info("Subexecução | %s | %d programas em risco", ibge, len(resultado))
    return resultado


def valor_total_em_risco(ibge: str) -> float:
    """Soma dos valores empenhados não pagos nos programas em risco."""
    programas = calcular_por_municipio(ibge)
    return sum(p.valor_empenhado - p.valor_pago for p in programas)
