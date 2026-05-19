# scripts/gerar_seed.py
"""
Gera supabase/seed.sql com todos os municípios brasileiros via API IBGE.
Execução única: python scripts/gerar_seed.py
"""
import json
import time
import requests
from pathlib import Path

IBGE_URL = "https://servicodados.ibge.gov.br/api/v1/localidades/municipios"
OUT = Path("supabase/seed.sql")


def fetch_municipios() -> list[dict]:
    r = requests.get(IBGE_URL, timeout=30)
    r.raise_for_status()
    return r.json()


def uf_from_municipio(m: dict) -> str:
    # Caminho principal: microrregiao > mesorregiao > UF
    if m.get("microrregiao") and m["microrregiao"].get("mesorregiao"):
        return m["microrregiao"]["mesorregiao"]["UF"]["sigla"]
    # Fallback: regiao-imediata > regiao-intermediaria > UF (para municípios sem microrregião)
    regiao_imediata = m.get("regiao-imediata") or {}
    regiao_intermediaria = regiao_imediata.get("regiao-intermediaria") or {}
    uf = regiao_intermediaria.get("UF", {}).get("sigla")
    if not uf:
        raise ValueError(f"Não foi possível resolver UF para: {m['nome']} (id={m['id']})")
    return uf


def build_sql(municipios: list[dict]) -> str:
    linhas = [
        "-- Seed: municípios brasileiros (IBGE SIDRA)",
        "-- Gerado automaticamente por scripts/gerar_seed.py",
        "INSERT INTO municipios_habilitacao (ibge, nome, uf, cauc_regular) VALUES"
    ]
    valores = []
    for m in municipios:
        ibge = str(m["id"])
        nome = m["nome"].replace("'", "''")
        uf   = uf_from_municipio(m)
        valores.append(f"  ('{ibge}', '{nome}', '{uf}', true)")
    linhas.append(",\n".join(valores) + ";")
    return "\n".join(linhas)


def main() -> None:
    print("Buscando municípios da API IBGE...")
    municipios = fetch_municipios()
    print(f"  {len(municipios)} municípios encontrados")

    sql = build_sql(municipios)
    OUT.write_text(sql, encoding="utf-8")
    print(f"  Seed escrito em {OUT}")


if __name__ == "__main__":
    main()
