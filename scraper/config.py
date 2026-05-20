# scraper/config.py
import os
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL: str = os.environ["SUPABASE_URL"]
SUPABASE_KEY: str = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
PORTAL_API_KEY: str = os.environ.get("PORTAL_TRANSPARENCIA_API_KEY", "")

RATE_LIMIT_SECONDS: float = 0.3   # 300ms entre requests

USER_AGENT = "nexaradar-pesquisa-publica/1.0"

# Municípios ativos (expandir conforme base de clientes cresce)
MUNICIPIOS_ATIVOS: dict[str, str] = {
    "Delmiro Gouveia - AL":       "2702207",
    "Palmeira dos Índios - AL":   "2705903",
    "Arapiraca - AL":             "2701209",
    "Nossa Sra. do Socorro - SE": "2804805",
    "Lagarto - SE":               "2803500",
    "Estância - SE":              "2802106",
    "Caruaru - PE":               "2604106",
    "Petrolina - PE":             "2611101",
    "Garanhuns - PE":             "2606002",
}

EIXOS: dict[str, list[str]] = {
    "assistencia_social": ["SCFV", "IGD-SUAS", "BPC_ESCOLA", "CRIANCA_FELIZ", "PROTECAO_ESPECIAL", "TEA"],
    "saude":              ["ATENCAO_BASICA", "MEDIA_ALTA_COMPLEXIDADE", "VIGILANCIA", "CAPS", "REDE_CEGONHA"],
    "educacao":           ["PNAE", "PNATE", "PDDE", "BRASIL_ALFABETIZADO", "PROINFANCIA"],
    "esporte":            ["PELC", "VIDA_SAUDAVEL", "ESPORTE_ESCOLA"],
    "infraestrutura":     ["SANEAMENTO", "HABITACAO", "MOBILIDADE", "ILUMINACAO"],
    "emendas":            ["INDIVIDUAL_IMPOSITIVA", "BANCADA", "COMISSAO", "RELATOR"],
}

AREA_TEMATICA_POR_PROGRAMA: dict[str, str] = {
    p: eixo for eixo, programas in EIXOS.items() for p in programas
}

# UF por código IBGE — derivado de MUNICIPIOS_ATIVOS (evita string splitting em run.py)
IBGE_TO_UF: dict[str, str] = {
    ibge: nome.rsplit(" - ", 1)[-1]
    for nome, ibge in MUNICIPIOS_ATIVOS.items()
}

# Conjunto de IBGEs ativos para filtragem rápida nos scrapers
IBGE_ATIVOS: frozenset[str] = frozenset(MUNICIPIOS_ATIVOS.values())
