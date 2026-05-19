# scraper/sources/siga_brasil.py
"""
Coleta emendas parlamentares via SIGA Brasil SPARQL endpoint do Senado.
Endpoint: https://www12.senado.leg.br/orcamento/sparql
"""
import time
import logging
from SPARQLWrapper import SPARQLWrapper, JSON
from scraper.config import RATE_LIMIT_SECONDS, USER_AGENT

log = logging.getLogger(__name__)

SPARQL_ENDPOINT = "https://www12.senado.leg.br/orcamento/sparql"

QUERY_EMENDAS = """
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
}}
LIMIT 10000
"""


def coletar_emendas_individuais(ano: int) -> list[dict]:
    """Retorna rows prontas para inserção em emendas_parlamentares."""
    sparql = SPARQLWrapper(SPARQL_ENDPOINT)
    sparql.addCustomHttpHeader("User-Agent", USER_AGENT)
    sparql.setQuery(QUERY_EMENDAS.format(ano=ano))
    sparql.setReturnFormat(JSON)

    try:
        results = sparql.query().convert()
    except Exception as e:
        log.error("SIGA Brasil SPARQL erro: %s", e)
        return []

    time.sleep(RATE_LIMIT_SECONDS)

    rows: list[dict] = []
    for b in results["results"]["bindings"]:
        ibge = b.get("codigoIbge", {}).get("value")
        if not ibge:
            continue  # skip emendas sem município vinculado
        rows.append({
            "parlamentar_id":   b.get("autoria", {}).get("value", "DESCONHECIDO"),
            "parlamentar_nome": b.get("nomeAutor", {}).get("value", ""),
            "tipo":             "RP6",
            "parlamentar_tipo": "individual",
            "municipio_ibge":   ibge,
            "area_tematica":    (b.get("area", {}).get("value") or "").lower(),
            "valor_autorizado": float((b.get("valorAutorizado") or {}).get("value") or 0),
            "valor_empenhado":  float((b.get("valorEmpenhado") or {}).get("value") or 0),
            "valor_executado":  0.0,
            "exercicio":        ano,
            "fonte":            "siga_brasil",
        })
    log.info("SIGA Brasil | %d | %d emendas individuais", ano, len(rows))
    return rows
