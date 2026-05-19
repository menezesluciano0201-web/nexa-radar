"""
=============================================================
MÓDULO DE SCRAPING — INTELIGÊNCIA DE SUBEXECUÇÃO
Rastreador de Verbas Públicas por Eixo Temático
=============================================================
Fontes cobertas:
  - Portal da Transparência (API REST oficial)
  - SIOP (Sistema Integrado de Orçamento e Planejamento)
  - FNDE (transferências educação)
  - SIGA Brasil (emendas parlamentares)
  - Transferegov (convênios e instrumentos)
  - Fundos Estaduais AL / SE / PE (scraping HTML)
=============================================================
Requisitos:
  pip install requests pandas beautifulsoup4 lxml openpyxl
=============================================================
"""

import requests
import pandas as pd
import json
import time
import logging
from datetime import datetime, date
from typing import Optional
from bs4 import BeautifulSoup

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("subexecucao")

# ─────────────────────────────────────────────
# CONFIGURAÇÃO GLOBAL
# ─────────────────────────────────────────────

MUNICIPIOS_IBGE = {
    "Delmiro Gouveia - AL":      "2702207",
    "Palmeira dos Índios - AL":  "2705903",
    "Arapiraca - AL":            "2701209",
    "Nossa Sra. do Socorro - SE":"2804805",
    "Lagarto - SE":              "2803500",
    "Estância - SE":             "2802106",
    "Caruaru - PE":              "2604106",
    "Petrolina - PE":            "2611101",
    "Garanhuns - PE":            "2606002",
}

EIXOS = {
    "assistencia_social": ["SCFV", "IGD-SUAS", "BPC_ESCOLA", "CRIANCA_FELIZ", "PROTECAO_ESPECIAL", "TEA"],
    "saude":              ["ATENCAO_BASICA", "MEDIA_ALTA_COMPLEXIDADE", "VIGILANCIA", "CAPS", "REDE_CEGONHA"],
    "educacao":           ["PNAE", "PNATE", "PDDE", "BRASIL_ALFABETIZADO", "PROINFANCIA"],
    "esporte":            ["PELC", "VIDA_SAUDAVEL", "ESPORTE_ESCOLA"],
    "infraestrutura":     ["SANEAMENTO", "HABITACAO", "MOBILIDADE", "ILUMINACAO"],
    "emendas":            ["INDIVIDUAL_IMPOSITIVA", "BANCADA", "COMISSAO", "RELATOR"],
}

# ─────────────────────────────────────────────
# 1. PORTAL DA TRANSPARÊNCIA — API REST OFICIAL
#    Documentação: https://api.portaldatransparencia.gov.br/
#    Chave gratuita: https://portaldatransparencia.gov.br/api-de-dados/cadastrar
# ─────────────────────────────────────────────

PORTAL_BASE = "https://api.portaldatransparencia.gov.br/api-de-dados"

class PortalTransparenciaClient:
    def __init__(self, api_key: str):
        self.headers = {
            "chave-api-dados": api_key,
            "Accept": "application/json",
        }

    def _get(self, endpoint: str, params: dict) -> list:
        url = f"{PORTAL_BASE}/{endpoint}"
        results = []
        pagina = 1
        while True:
            params["pagina"] = pagina
            try:
                r = requests.get(url, headers=self.headers, params=params, timeout=30)
                r.raise_for_status()
                data = r.json()
                if not data:
                    break
                results.extend(data if isinstance(data, list) else [data])
                if len(data) < 500:
                    break
                pagina += 1
                time.sleep(0.3)
            except requests.HTTPError as e:
                log.error(f"HTTP {r.status_code} em {endpoint}: {e}")
                break
            except Exception as e:
                log.error(f"Erro em {endpoint}: {e}")
                break
        return results

    def transferencias_voluntarias(self, codigo_ibge: str, ano: int) -> pd.DataFrame:
        """Convênios e transferências voluntárias por município."""
        dados = self._get("transferencias-voluntarias", {
            "codigoMunicipio": codigo_ibge,
            "ano": ano,
            "tamanhoPagina": 500,
        })
        if not dados:
            return pd.DataFrame()
        df = pd.json_normalize(dados)
        df["saldo_nao_executado"] = df.get("valorEmpenhado", 0) - df.get("valorPago", 0)
        df["percentual_executado"] = (df.get("valorPago", 0) / df.get("valorEmpenhado", 1) * 100).round(1)
        return df

    def emendas_parlamentares(self, codigo_ibge: str, ano: int) -> pd.DataFrame:
        """Emendas parlamentares — individuais, bancada, comissão."""
        dados = self._get("emendas", {
            "codigoMunicipio": codigo_ibge,
            "ano": ano,
            "tamanhoPagina": 500,
        })
        if not dados:
            return pd.DataFrame()
        df = pd.json_normalize(dados)
        df["saldo_nao_pago"] = df.get("valorEmpenhado", 0) - df.get("valorPago", 0)
        df["urgente"] = df["saldo_nao_pago"] > 50_000
        return df

    def convenios_fundo_saude(self, codigo_ibge: str, ano: int) -> pd.DataFrame:
        """Repasses do Fundo Nacional de Saúde."""
        return self.transferencias_voluntarias(codigo_ibge, ano)

    def programas_sociais(self, codigo_ibge: str) -> pd.DataFrame:
        """Benefícios e programas sociais ativos no município."""
        dados = self._get("programas-sociais/beneficiarios", {
            "municipio": codigo_ibge,
            "tamanhoPagina": 500,
        })
        return pd.json_normalize(dados) if dados else pd.DataFrame()


# ─────────────────────────────────────────────
# 2. FNDE — FUNDO NACIONAL DE DESENVOLVIMENTO DA EDUCAÇÃO
#    Planilhas públicas: https://www.fnde.gov.br/index.php/financiamento/transferencias-automaticas
# ─────────────────────────────────────────────

FNDE_BASE = "https://www.fnde.gov.br/index.php/transferencias/transferencias-por-municipio"

FNDE_PROGRAMAS = {
    "PNAE":   "Programa Nacional de Alimentação Escolar",
    "PNATE":  "Transporte Escolar",
    "PDDE":   "Dinheiro Direto na Escola",
    "PROINFANCIA": "Construção de Creches",
}

def scrape_fnde_municipio(codigo_ibge: str, ano: int = None) -> pd.DataFrame:
    """
    Raspa dados de repasses do FNDE por município.
    Fonte: FNDE Dados Abertos (CSV por programa e ano).
    """
    if ano is None:
        ano = date.today().year
    resultados = []
    for sigla, nome in FNDE_PROGRAMAS.items():
        # URL pública de dados abertos FNDE
        url = f"https://www.fnde.gov.br/dadosabertos/{sigla.lower()}/municipio/{codigo_ibge}/{ano}"
        try:
            r = requests.get(url, timeout=20)
            if r.status_code == 200:
                data = r.json()
                for item in data.get("dados", []):
                    item["programa"] = sigla
                    item["nome_programa"] = nome
                    item["eixo"] = "educacao"
                    resultados.append(item)
        except Exception as e:
            log.warning(f"FNDE {sigla} indisponível: {e}")
            # Retorna estrutura vazia com metadados
            resultados.append({
                "programa": sigla,
                "nome_programa": nome,
                "eixo": "educacao",
                "status": "sem_dados",
                "municipio_ibge": codigo_ibge,
                "ano": ano,
            })
    return pd.DataFrame(resultados)


# ─────────────────────────────────────────────
# 3. SIGA BRASIL — EMENDAS PARLAMENTARES
#    Fonte: https://www12.senado.leg.br/orcamento/sigabrasil
#    API SPARQL pública disponível
# ─────────────────────────────────────────────

SIGA_BASE = "https://www12.senado.leg.br/orcamento/sparql"

def consultar_emendas_siga(codigo_ibge: str, ano: int = None) -> pd.DataFrame:
    """
    Consulta emendas parlamentares via SPARQL no SIGA Brasil.
    Retorna emendas empenhadas mas não pagas (dinheiro parado).
    """
    if ano is None:
        ano = date.today().year
    query = f"""
    PREFIX siab: <http://www.semanticweb.org/siab#>
    SELECT ?emenda ?parlamentar ?valor_empenhado ?valor_pago ?acao ?funcao
    WHERE {{
        ?emenda siab:municipio_ibge "{codigo_ibge}" ;
                siab:ano {ano} ;
                siab:valor_empenhado ?valor_empenhado ;
                siab:valor_pago ?valor_pago ;
                siab:nome_acao ?acao ;
                siab:funcao ?funcao .
        FILTER (?valor_empenhado > ?valor_pago)
    }}
    ORDER BY DESC(?valor_empenhado)
    """
    try:
        r = requests.get(SIGA_BASE, params={"query": query, "format": "json"}, timeout=30)
        r.raise_for_status()
        bindings = r.json().get("results", {}).get("bindings", [])
        rows = [{k: v["value"] for k, v in b.items()} for b in bindings]
        df = pd.DataFrame(rows)
        if not df.empty:
            df["saldo_parado"] = df["valor_empenhado"].astype(float) - df["valor_pago"].astype(float)
            df["eixo"] = "emendas"
        return df
    except Exception as e:
        log.warning(f"SIGA Brasil indisponível: {e}")
        return pd.DataFrame(columns=["emenda", "parlamentar", "valor_empenhado", "valor_pago", "acao", "saldo_parado", "eixo"])


# ─────────────────────────────────────────────
# 4. TRANSFEREGOV — CONVÊNIOS E INSTRUMENTOS
#    API REST pública (sem autenticação para leitura)
#    https://transferegov.sistema.gov.br/
# ─────────────────────────────────────────────

TRANSFEREGOV_BASE = "https://api.transferegov.sistema.gov.br/v1"

def buscar_convenios_transferegov(codigo_ibge: str, ano: int = None) -> pd.DataFrame:
    """
    Busca convênios ativos com baixa execução no Transferegov.
    """
    if ano is None:
        ano = date.today().year
    endpoint = f"{TRANSFEREGOV_BASE}/convenios"
    params = {
        "municipio": codigo_ibge,
        "situacao": "Em execução",
        "ano": ano,
        "limit": 200,
    }
    try:
        r = requests.get(endpoint, params=params, timeout=30)
        r.raise_for_status()
        dados = r.json().get("data", r.json() if isinstance(r.json(), list) else [])
        df = pd.json_normalize(dados)
        if not df.empty:
            df["saldo_nao_executado"] = df.get("vl_empenhado", 0) - df.get("vl_desembolsado", 0)
            df["percentual_exec"] = (df.get("vl_desembolsado", 0) / df.get("vl_empenhado", 1) * 100).round(1)
            df["alerta"] = df["percentual_exec"] < 30
            df["eixo"] = df.get("area_tematica", "outros")
        return df
    except Exception as e:
        log.warning(f"Transferegov indisponível para {codigo_ibge}: {e}")
        return pd.DataFrame()


# ─────────────────────────────────────────────
# 5. FUNDOS ESTADUAIS — AL, SE, PE
#    Scraping HTML dos portais de transparência estaduais
# ─────────────────────────────────────────────

PORTAIS_ESTADUAIS = {
    "AL": {
        "nome": "Portal Transparência Alagoas",
        "url_base": "https://transparencia.al.gov.br",
        "fundos": ["FEAC", "FEAS-AL", "FES-AL", "FECD"],
        "endpoint_repasses": "/repasses/municipios/{codigo_ibge}",
    },
    "SE": {
        "nome": "Portal Transparência Sergipe",
        "url_base": "https://www.transparencia.se.gov.br",
        "fundos": ["FEAS-SE", "FES-SE", "FEDUCA"],
        "endpoint_repasses": "/transparencia/repasses?municipio={codigo_ibge}",
    },
    "PE": {
        "nome": "Portal Transparência Pernambuco",
        "url_base": "https://www.transparencia.pe.gov.br",
        "fundos": ["FEAS-PE", "FES-PE", "FECP"],
        "endpoint_repasses": "/repasses-municipais/{codigo_ibge}",
    },
}

def scrape_fundo_estadual(estado: str, codigo_ibge: str) -> pd.DataFrame:
    """
    Raspa dados de repasses dos fundos estaduais via portal de transparência.
    """
    config = PORTAIS_ESTADUAIS.get(estado.upper())
    if not config:
        log.warning(f"Estado {estado} não configurado.")
        return pd.DataFrame()
    url = config["url_base"] + config["endpoint_repasses"].format(codigo_ibge=codigo_ibge)
    headers = {"User-Agent": "Mozilla/5.0 (pesquisa-publica/1.0)"}
    try:
        r = requests.get(url, headers=headers, timeout=20)
        r.raise_for_status()
        soup = BeautifulSoup(r.text, "lxml")
        # Tenta JSON embutido (padrão de vários portais gov)
        scripts = soup.find_all("script", type="application/json")
        for s in scripts:
            try:
                data = json.loads(s.string)
                return pd.json_normalize(data.get("repasses", data))
            except Exception:
                continue
        # Fallback: tabela HTML
        tabela = soup.find("table")
        if tabela:
            return pd.read_html(str(tabela))[0]
        return pd.DataFrame()
    except Exception as e:
        log.warning(f"Portal estadual {estado} indisponível: {e}")
        return pd.DataFrame({"fundo": config["fundos"], "estado": estado, "status": "pendente_acesso"})


# ─────────────────────────────────────────────
# 6. FUNDAÇÕES PRIVADAS — EDITAIS ABERTOS
#    Scraping de oportunidades de financiamento privado
# ─────────────────────────────────────────────

FUNDACOES = {
    "Itaú Social":      "https://www.itausocial.org.br/editais/",
    "Fundação Lemann":  "https://fundacaolemann.org.br/editais",
    "Instituto Natura": "https://www.natura.com.br/institucional/fundacao-natura/editais",
    "BNDES Social":     "https://www.bndes.gov.br/wps/portal/site/home/onde-atuamos/inovacao-e-desenvolvimento-social/editais-abertos",
    "Fundação Vale":    "https://www.vale.com/pt/fundacao-vale/editais",
}

def scrape_editais_privados() -> pd.DataFrame:
    """
    Raspa editais abertos de fundações privadas.
    Retorna lista de oportunidades com prazo e área temática.
    """
    resultados = []
    headers = {"User-Agent": "Mozilla/5.0 (pesquisa-publica/1.0)"}
    for nome, url in FUNDACOES.items():
        try:
            r = requests.get(url, headers=headers, timeout=15)
            soup = BeautifulSoup(r.text, "lxml")
            # Busca cards ou itens de editais (padrão comum)
            cards = soup.find_all(["article", "div"], class_=lambda c: c and (
                "edital" in c.lower() or "oportunidade" in c.lower() or "card" in c.lower()
            ))
            if cards:
                for card in cards[:5]:
                    titulo = card.find(["h2", "h3", "h4", "a"])
                    prazo  = card.find(text=lambda t: t and ("prazo" in t.lower() or "até" in t.lower()))
                    resultados.append({
                        "fonte": nome,
                        "titulo": titulo.text.strip() if titulo else "—",
                        "prazo": prazo.strip() if prazo else "Verificar site",
                        "url": url,
                        "tipo": "privado",
                        "eixo": "multi",
                    })
            else:
                resultados.append({"fonte": nome, "titulo": "Verificar manualmente", "url": url, "tipo": "privado"})
        except Exception as e:
            log.warning(f"Fundação {nome}: {e}")
            resultados.append({"fonte": nome, "titulo": "Indisponível", "url": url, "tipo": "privado"})
    return pd.DataFrame(resultados)


# ─────────────────────────────────────────────
# 7. MOTOR CENTRAL — RASTREADOR COMPLETO
# ─────────────────────────────────────────────

class RastreadorSubexecucao:
    """
    Orquestra todas as fontes e gera relatório consolidado
    de verbas dormentes por município e eixo temático.
    """
    def __init__(self, api_key_portal: str = "SUA_CHAVE_AQUI"):
        self.portal = PortalTransparenciaClient(api_key_portal)
        self.ano = date.today().year

    def diagnosticar_municipio(self, nome_municipio: str) -> dict:
        codigo = MUNICIPIOS_IBGE.get(nome_municipio)
        if not codigo:
            raise ValueError(f"Município '{nome_municipio}' não encontrado. Adicione em MUNICIPIOS_IBGE.")
        estado = nome_municipio.split(" - ")[-1]
        log.info(f"🔍 Iniciando diagnóstico: {nome_municipio} (IBGE: {codigo})")
        resultado = {
            "municipio": nome_municipio,
            "ibge": codigo,
            "estado": estado,
            "data_coleta": datetime.now().isoformat(),
            "fontes": {}
        }

        # Portal da Transparência
        log.info("  → Coletando Portal da Transparência...")
        df_transf = self.portal.transferencias_voluntarias(codigo, self.ano)
        df_emendas_portal = self.portal.emendas_parlamentares(codigo, self.ano)
        resultado["fontes"]["transferencias_voluntarias"] = self._resumir(df_transf, "saldo_nao_executado")
        resultado["fontes"]["emendas_portal"] = self._resumir(df_emendas_portal, "saldo_nao_pago")

        # FNDE
        log.info("  → Coletando FNDE...")
        df_fnde = scrape_fnde_municipio(codigo, self.ano)
        resultado["fontes"]["fnde_educacao"] = self._resumir(df_fnde)

        # SIGA Brasil
        log.info("  → Consultando SIGA Brasil (emendas)...")
        df_siga = consultar_emendas_siga(codigo, self.ano)
        resultado["fontes"]["emendas_siga"] = self._resumir(df_siga, "saldo_parado")

        # Transferegov
        log.info("  → Consultando Transferegov...")
        df_tgov = buscar_convenios_transferegov(codigo, self.ano)
        resultado["fontes"]["transferegov"] = self._resumir(df_tgov, "saldo_nao_executado")

        # Fundo Estadual
        log.info(f"  → Coletando fundo estadual {estado}...")
        df_estadual = scrape_fundo_estadual(estado, codigo)
        resultado["fontes"]["fundo_estadual"] = self._resumir(df_estadual)

        # Total consolidado
        saldos = [
            resultado["fontes"]["transferencias_voluntarias"].get("total_parado", 0),
            resultado["fontes"]["emendas_portal"].get("total_parado", 0),
            resultado["fontes"]["emendas_siga"].get("total_parado", 0),
            resultado["fontes"]["transferegov"].get("total_parado", 0),
        ]
        resultado["total_dormentes_consolidado"] = sum(saldos)
        log.info(f"✅ Diagnóstico concluído. Total dormente: R$ {resultado['total_dormentes_consolidado']:,.0f}")
        return resultado

    def _resumir(self, df: pd.DataFrame, coluna_saldo: str = None) -> dict:
        if df is None or df.empty:
            return {"registros": 0, "total_parado": 0, "status": "sem_dados"}
        resumo = {"registros": len(df), "status": "ok"}
        if coluna_saldo and coluna_saldo in df.columns:
            resumo["total_parado"] = float(df[coluna_saldo].sum())
            resumo["top_criticos"] = df.nlargest(3, coluna_saldo)[
                [c for c in ["nome_acao", "programa", "nome_programa", coluna_saldo] if c in df.columns]
            ].to_dict("records")
        return resumo

    def varredura_regional(self, municipios: list) -> pd.DataFrame:
        """Varre lista de municípios e retorna ranking de subexecução."""
        registros = []
        for m in municipios:
            try:
                diag = self.diagnosticar_municipio(m)
                registros.append({
                    "municipio": m,
                    "estado": diag["estado"],
                    "total_dormente": diag["total_dormentes_consolidado"],
                    "fontes_ativas": sum(1 for f in diag["fontes"].values() if f.get("registros", 0) > 0),
                })
                time.sleep(1)  # Respeita rate limit das APIs
            except Exception as e:
                log.error(f"Erro em {m}: {e}")
        df = pd.DataFrame(registros).sort_values("total_dormente", ascending=False)
        return df

    def exportar_relatorio(self, resultado: dict, path: str = "relatorio_subexecucao.xlsx"):
        """Exporta diagnóstico completo para Excel com múltiplas abas."""
        with pd.ExcelWriter(path, engine="openpyxl") as writer:
            resumo = pd.DataFrame([{
                "Campo": k, "Valor": v
                for k, v in resultado.items() if k != "fontes"
            }])
            resumo.to_excel(writer, sheet_name="Resumo", index=False)
            for fonte, dados in resultado["fontes"].items():
                linha = pd.DataFrame([dados])
                linha.to_excel(writer, sheet_name=fonte[:31], index=False)
        log.info(f"📄 Relatório exportado: {path}")


# ─────────────────────────────────────────────
# 8. AGENDADOR — MONITORAMENTO CONTÍNUO
# ─────────────────────────────────────────────

def monitorar_continuamente(municipios: list, api_key: str, intervalo_dias: int = 7):
    """
    Executa varredura semanal e salva histórico.
    Ideal para rodar como cron job ou serviço.

    Cron example (Linux):
        0 6 * * 1 python scraper_fontes.py  # toda segunda, 6h
    """
    rastreador = RastreadorSubexecucao(api_key)
    log.info(f"⏱ Iniciando monitoramento — {len(municipios)} municípios — ciclo: {intervalo_dias} dias")
    historico = []
    while True:
        df = rastreador.varredura_regional(municipios)
        df["data_coleta"] = datetime.now().isoformat()
        historico.append(df)
        pd.concat(historico).to_csv("historico_subexecucao.csv", index=False)
        log.info(f"💾 Histórico salvo. Próxima varredura em {intervalo_dias} dias.")
        time.sleep(intervalo_dias * 86400)


# ─────────────────────────────────────────────
# EXECUÇÃO DIRETA (MVP)
# ─────────────────────────────────────────────

if __name__ == "__main__":
    # 1. Configure sua chave da API do Portal da Transparência
    #    (gratuita em: https://portaldatransparencia.gov.br/api-de-dados/cadastrar)
    API_KEY = "SUA_CHAVE_AQUI"

    # 2. Lista de municípios para varrer
    MUNICIPIOS_ALVO = [
        "Delmiro Gouveia - AL",
        "Nossa Sra. do Socorro - SE",
        "Lagarto - SE",
        "Caruaru - PE",
    ]

    # 3. Inicializa rastreador
    rastreador = RastreadorSubexecucao(API_KEY)

    # 4. Diagnóstico individual (mais detalhado)
    print("\n=== DIAGNÓSTICO INDIVIDUAL ===")
    diag = rastreador.diagnosticar_municipio("Lagarto - SE")
    print(json.dumps(diag, indent=2, ensure_ascii=False, default=str))

    # 5. Varredura regional (ranking)
    print("\n=== RANKING REGIONAL DE SUBEXECUÇÃO ===")
    ranking = rastreador.varredura_regional(MUNICIPIOS_ALVO)
    print(ranking.to_string(index=False))

    # 6. Editais privados abertos
    print("\n=== EDITAIS PRIVADOS ABERTOS ===")
    editais = scrape_editais_privados()
    print(editais[["fonte", "titulo", "prazo"]].to_string(index=False))

    # 7. Exporta relatório Excel
    rastreador.exportar_relatorio(diag, "relatorio_lagarto_se.xlsx")
