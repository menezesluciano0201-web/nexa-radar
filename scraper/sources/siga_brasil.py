# scraper/sources/siga_brasil.py
"""
Coleta emendas parlamentares via SIGA Brasil SPARQL endpoint do Senado.
Endpoint: https://www12.senado.leg.br/orcamento/sparql
"""
import time
import logging
from SPARQLWrapper import SPARQLWrapper, JSON
from scraper.config import RATE_LIMIT_SECONDS, USER_AGENT, IBGE_ATIVOS

log = logging.getLogger(__name__)

SPARQL_ENDPOINT = "https://www12.senado.leg.br/orcamento/sparql"

def _build_query(ano: int, ibge_values: str) -> str:
    """Build SPARQL query with server-side IBGE filter to reduce transferred data."""
    return f"""
PREFIX : <http://www.siga.senado.leg.br/vocab#>
SELECT ?autoria ?nomeAutor ?codigoIbge ?area ?valorAutorizado ?valorEmpenhado
WHERE {{
  ?emenda a :EmendaIndividual ;
          :ano {ano} ;
          :autor ?autorURI ;
          :nomeAutor ?nomeAutor ;
          :localidade ?localidade ;
          :funcao ?funcao ;
          :valorAutorizado ?valorAutorizado ;
          :valorEmpenhado ?valorEmpenhado .
  ?autorURI :id ?autoria .
  ?localidade :codigoIbge ?codigoIbge .
  ?funcao :descricao ?area .
  VALUES ?codigoIbge {{ {ibge_values} }}
}}
LIMIT 10000
"""


def coletar_emendas_individuais(ano: int) -> list[dict]:
    """Retorna rows prontas para inserção em emendas_parlamentares."""
    if not (2000 <= ano <= 2100):
        raise ValueError(f"ano fora do intervalo esperado: {ano}")
    ibge_values = " ".join(f'"{ibge}"' for ibge in IBGE_ATIVOS)
    sparql = SPARQLWrapper(SPARQL_ENDPOINT)
    sparql.addCustomHttpHeader("User-Agent", USER_AGENT)
    sparql.setQuery(_build_query(ano, ibge_values))
    sparql.setReturnFormat(JSON)

    try:
        results = sparql.query().convert()
    except Exception as e:
        log.error("SIGA Brasil SPARQL erro: %s", e)
        return []
    finally:
        time.sleep(RATE_LIMIT_SECONDS)

    rows: list[dict] = []
    bindings: list[dict] = results.get("results", {}).get("bindings", [])
    if len(bindings) >= 10000:
        log.warning(
            "SIGA Brasil | %d | LIMIT 10000 atingido — emendas podem estar INCOMPLETAS. "
            "Implementar paginação OFFSET/LIMIT no SPARQL.",
            ano,
        )
    skipped_ibge = 0
    for b in bindings:
        ibge = b.get("codigoIbge", {}).get("value")
        if not ibge:
            continue  # skip emendas sem município vinculado
        if ibge not in IBGE_ATIVOS:
            skipped_ibge += 1
            continue  # skip municípios fora do escopo ativo
        parlamentar_id = b.get("autoria", {}).get("value")
        if not parlamentar_id:
            continue  # skip emendas sem autoria — evita colapso em DESCONHECIDO
        rows.append({
            "parlamentar_id":   parlamentar_id,
            "parlamentar_nome": b.get("nomeAutor", {}).get("value", ""),
            "tipo":             "RP6",
            "parlamentar_tipo": "individual",
            "municipio_ibge":   ibge,
            "area_tematica":    (b.get("area", {}).get("value") or "").lower(),
            "valor_autorizado": float((b.get("valorAutorizado") or {}).get("value") or 0),
            "valor_empenhado":  float((b.get("valorEmpenhado") or {}).get("value") or 0),
            "valor_executado":  0.0,  # SIGA SPARQL não expõe valor executado — percentual_execucao será 0%
            "exercicio":        ano,
            "fonte":            "siga_brasil",
        })
    log.info(
        "SIGA Brasil | %d | %d emendas | %d bindings brutos | %d ignorados (ibge fora do escopo)",
        ano, len(rows), len(bindings), skipped_ibge,
    )
    return rows
