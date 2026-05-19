# Nexa Radar — Foundation: Supabase + Python Scrapers

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Configurar o banco de dados Supabase com schema completo, RLS e seed de municípios, e construir os scrapers Python que populam as tabelas com dados federais reais.

**Architecture:** Supabase Cloud hospeda o PostgreSQL com RLS por row. Scripts Python independentes coletam dados das APIs federais (Portal da Transparência, SIGA Brasil, Transferegov, FNDE) e escrevem nas tabelas via `supabase-py` com service role. Processadores calculam subexecução e habilitação após cada coleta. O scraper roda totalmente separado do Next.js — não há dependência entre os dois planos.

**Tech Stack:** Python 3.11+, supabase-py 2.x, requests, SPARQLWrapper, pytest, responses (mock HTTP), Supabase CLI para migrations.

**Plano 2:** Next.js App (dashboard admin, portal cliente, IA, PDF) — começa após este plano estar funcionando.

---

## Mapa de Arquivos

| Arquivo | Responsabilidade |
|---|---|
| `supabase/migrations/001_init_schema.sql` | DDL de todas as tabelas |
| `supabase/migrations/002_rls_policies.sql` | Políticas RLS por tabela |
| `supabase/migrations/003_indexes.sql` | Índices de performance + GIN |
| `supabase/seed.sql` | Gerado pelo script `scripts/gerar_seed.py` |
| `scripts/gerar_seed.py` | Gera seed de 5.570 municípios via API IBGE |
| `scraper/requirements.txt` | Dependências Python do scraper |
| `scraper/config.py` | Constantes, códigos IBGE, eixos temáticos |
| `scraper/supabase_client.py` | Client Supabase com service role |
| `scraper/sources/portal_transparencia.py` | Coleta transferências federais |
| `scraper/sources/siga_brasil.py` | Coleta emendas parlamentares (SPARQL) |
| `scraper/sources/transferegov.py` | Coleta convênios e instrumentos |
| `scraper/sources/fnde.py` | Coleta PNAE, PNATE, PDDE, Proinfância |
| `scraper/sources/portais_estaduais.py` | Stub AL/SE/PE + registro para validação manual |
| `scraper/processors/calcular_subexecucao.py` | Calcula % execução e valor em risco |
| `scraper/processors/atualizar_habilitacao.py` | Atualiza CAUC e programas habilitados |
| `scraper/run.py` | Entry point do cron com logging estruturado |
| `scraper/tests/test_portal_transparencia.py` | Testes unitários com HTTP mockado |
| `scraper/tests/test_siga_brasil.py` | Testes unitários SPARQL mockado |
| `scraper/tests/test_processors.py` | Testes unitários dos processadores |

---

## Task 1: Inicializar estrutura do projeto e repositório git

**Files:**
- Create: `scraper/requirements.txt`
- Create: `scripts/` (diretório)
- Create: `.env.example`
- Create: `.gitignore`

- [ ] **Step 1: Criar estrutura de diretórios**

```bash
mkdir -p scraper/sources scraper/processors scraper/tests scripts supabase/migrations
touch scraper/__init__.py scraper/sources/__init__.py scraper/processors/__init__.py scraper/tests/__init__.py
```

- [ ] **Step 2: Criar `.gitignore`**

```
# env
.env
.env.local
.env.*.local

# Python
__pycache__/
*.py[cod]
.pytest_cache/
.venv/
venv/

# Node
node_modules/
.next/

# OS
.DS_Store

# Supabase
supabase/.branches
supabase/.temp
```

- [ ] **Step 3: Criar `.env.example`**

```bash
# Supabase
SUPABASE_URL=https://SEU_PROJETO.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
NEXT_PUBLIC_SUPABASE_URL=https://SEU_PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# APIs governamentais
PORTAL_TRANSPARENCIA_API_KEY=sua_chave_aqui

# IA
ANTHROPIC_API_KEY=sk-ant-...
```

- [ ] **Step 4: Criar `scraper/requirements.txt`**

```
supabase==2.9.0
requests==2.32.3
SPARQLWrapper==2.0.0
pandas==2.2.2
python-dotenv==1.0.1
pytest==8.2.2
responses==0.25.3
```

- [ ] **Step 5: Verificar estrutura**

```bash
find . -type f | grep -v ".git" | grep -v "__pycache__" | sort
```

Esperado: ver os arquivos criados nos diretórios corretos.

- [ ] **Step 6: Inicializar git e primeiro commit**

```bash
git init
git add .gitignore .env.example scraper/requirements.txt
git commit -m "chore: initialize project structure"
```

---

## Task 2: Migration 001 — Schema completo

**Files:**
- Create: `supabase/migrations/001_init_schema.sql`

- [ ] **Step 1: Escrever migration 001**

```sql
-- supabase/migrations/001_init_schema.sql

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── PROFILES ───────────────────────────────────────────────────────────────
CREATE TABLE profiles (
  id          uuid REFERENCES auth.users NOT NULL PRIMARY KEY,
  tipo        text NOT NULL CHECK (tipo IN ('admin','prefeito','deputado','senador','oscip')),
  nome        text NOT NULL,
  municipio_ibge text,
  parlamentar_id text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ─── CONTRATOS ──────────────────────────────────────────────────────────────
CREATE TABLE contratos (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id   uuid REFERENCES profiles NOT NULL,
  tipo_produto text NOT NULL CHECK (tipo_produto IN (
    'diagnostico','monitoramento_prefeito','monitoramento_parlamentar'
  )),
  status       text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','suspenso','encerrado')),
  valor_mensal numeric,
  data_inicio  date NOT NULL,
  data_fim     date,
  criado_em    timestamptz NOT NULL DEFAULT now()
);
-- 1 contrato ativo por profile
CREATE UNIQUE INDEX contratos_profile_ativo_unique
  ON contratos (profile_id) WHERE status = 'ativo';

-- ─── TRANSFERÊNCIAS FEDERAIS ─────────────────────────────────────────────────
CREATE TABLE transferencias_federais (
  id                   uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  municipio_ibge       text NOT NULL,
  programa             text NOT NULL,
  fundo                text NOT NULL,
  valor_empenhado      numeric NOT NULL DEFAULT 0,
  valor_liquidado      numeric NOT NULL DEFAULT 0,
  valor_pago           numeric NOT NULL DEFAULT 0,
  percentual_execucao  numeric GENERATED ALWAYS AS (
    CASE WHEN valor_empenhado > 0
         THEN ROUND((valor_pago / valor_empenhado * 100)::numeric, 2)
         ELSE 0 END
  ) STORED,
  competencia          date,
  prazo_limite         date,
  fonte                text NOT NULL,
  raw_json             jsonb,
  coletado_em          timestamptz NOT NULL DEFAULT now()
);

-- ─── EMENDAS PARLAMENTARES ───────────────────────────────────────────────────
CREATE TABLE emendas_parlamentares (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  parlamentar_id      text NOT NULL,
  parlamentar_nome    text,
  tipo                text NOT NULL CHECK (tipo IN ('RP6','RP7','RP8','PIX')),
  parlamentar_tipo    text NOT NULL CHECK (parlamentar_tipo IN ('individual','bancada','comissao')),
  municipio_ibge      text,
  area_tematica       text,
  valor_autorizado    numeric NOT NULL DEFAULT 0,
  valor_empenhado     numeric NOT NULL DEFAULT 0,
  valor_executado     numeric NOT NULL DEFAULT 0,
  percentual_execucao numeric GENERATED ALWAYS AS (
    CASE WHEN valor_autorizado > 0
         THEN ROUND((valor_executado / valor_autorizado * 100)::numeric, 2)
         ELSE 0 END
  ) STORED,
  prazo_limite        date,
  status_cauc         boolean,
  exercicio           int NOT NULL,
  fonte               text NOT NULL,
  coletado_em         timestamptz NOT NULL DEFAULT now()
);

-- ─── MUNICÍPIOS HABILITAÇÃO ──────────────────────────────────────────────────
CREATE TABLE municipios_habilitacao (
  ibge                  text PRIMARY KEY,
  nome                  text NOT NULL,
  uf                    text NOT NULL,
  populacao             int,
  idh                   numeric,
  cauc_regular          boolean DEFAULT true,
  ultima_verificacao    timestamptz,
  programas_habilitados text[] NOT NULL DEFAULT '{}',
  programas_bloqueados  text[] NOT NULL DEFAULT '{}'
);

-- ─── DIAGNÓSTICOS ────────────────────────────────────────────────────────────
CREATE TABLE diagnosticos (
  id                      uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  municipio_ibge          text NOT NULL,
  gerado_por              uuid REFERENCES profiles NOT NULL,
  valor_total_identificado numeric NOT NULL DEFAULT 0,
  valor_em_risco          numeric NOT NULL DEFAULT 0,
  programas_criticos      jsonb NOT NULL DEFAULT '[]',
  acoes_recomendadas      jsonb NOT NULL DEFAULT '[]',
  texto_ia                text,
  pdf_url                 text,
  status                  text NOT NULL DEFAULT 'gerando' CHECK (status IN (
    'gerando','rascunho','entregue','convertido','erro'
  )),
  criado_em               timestamptz NOT NULL DEFAULT now()
);

-- ─── BRIEFINGS ───────────────────────────────────────────────────────────────
CREATE TABLE briefings (
  id                    uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  parlamentar_id        text NOT NULL,
  gerado_por            uuid REFERENCES profiles NOT NULL,
  valor_total_emendas   numeric NOT NULL DEFAULT 0,
  valor_em_risco        numeric NOT NULL DEFAULT 0,
  municipios_recomendados jsonb NOT NULL DEFAULT '[]',
  texto_ia              text,
  pdf_url               text,
  status                text NOT NULL DEFAULT 'gerando' CHECK (status IN (
    'gerando','rascunho','entregue','erro'
  )),
  criado_em             timestamptz NOT NULL DEFAULT now()
);

-- ─── MAPA POLÍTICO ───────────────────────────────────────────────────────────
CREATE TABLE mapa_politico (
  id                        uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  parlamentar_id            text NOT NULL,
  municipio_ibge            text NOT NULL,
  relacao                   text NOT NULL CHECK (relacao IN ('aliado_forte','aliado','neutro','oposicao')),
  liderancas_locais         text,
  notas                     text,
  origem                    text NOT NULL DEFAULT 'manual' CHECK (origem IN ('manual','inferido')),
  confianca_inferencia      numeric CHECK (confianca_inferencia BETWEEN 0 AND 100),
  confirmado_pelo_assessor  boolean NOT NULL DEFAULT false,
  criado_por                uuid REFERENCES profiles NOT NULL,
  atualizado_em             timestamptz NOT NULL DEFAULT now(),
  UNIQUE (parlamentar_id, municipio_ibge)
);

-- ─── SCORES MUNICÍPIO × PARLAMENTAR ─────────────────────────────────────────
CREATE TABLE scores_municipio_parlamentar (
  id                   uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  parlamentar_id       text NOT NULL,
  municipio_ibge       text NOT NULL,
  score_total          numeric CHECK (score_total BETWEEN 0 AND 100),
  score_politico       numeric,
  score_saude_alocacao numeric,
  score_capacidade     numeric,
  score_impacto_visual numeric,
  score_idh            numeric,
  calculado_em         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (parlamentar_id, municipio_ibge)
);

-- ─── PUBLICAÇÕES PORTAL ──────────────────────────────────────────────────────
CREATE TABLE publicacoes_portal (
  id               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  municipio_ibge   text NOT NULL,
  aprovado_por     uuid REFERENCES profiles NOT NULL,
  titulo           text NOT NULL,
  resumo_execucao  jsonb NOT NULL DEFAULT '{}',
  publicado_em     timestamptz NOT NULL DEFAULT now(),
  ativo            boolean NOT NULL DEFAULT true
);

-- ─── CNDs (reservada para M1+) ───────────────────────────────────────────────
CREATE TABLE cnds_municipios (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  municipio_ibge  text NOT NULL,
  tipo            text NOT NULL,
  status          text NOT NULL CHECK (status IN ('valida','irregular','vencendo','vencida')),
  validade        date,
  dias_restantes  int GENERATED ALWAYS AS (
    CASE WHEN validade IS NOT NULL THEN (validade - CURRENT_DATE) ELSE NULL END
  ) STORED,
  alerta          boolean GENERATED ALWAYS AS (
    status != 'valida' OR (validade IS NOT NULL AND (validade - CURRENT_DATE) < 30)
  ) STORED,
  verificado_em   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (municipio_ibge, tipo)
);
```

- [ ] **Step 2: Verificar SQL (sem aplicar ainda)**

```bash
# Verificação local de sintaxe — requer psql instalado
# Se não tiver psql, pule este step e aplique direto no Supabase
cat supabase/migrations/001_init_schema.sql | wc -l
```

Esperado: ~120 linhas.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/001_init_schema.sql
git commit -m "feat: add database schema migration 001"
```

---

## Task 3: Migration 002 — RLS Policies

**Files:**
- Create: `supabase/migrations/002_rls_policies.sql`

- [ ] **Step 1: Escrever migration 002**

```sql
-- supabase/migrations/002_rls_policies.sql

-- ─── HABILITAR RLS ───────────────────────────────────────────────────────────
ALTER TABLE profiles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE contratos             ENABLE ROW LEVEL SECURITY;
ALTER TABLE diagnosticos          ENABLE ROW LEVEL SECURITY;
ALTER TABLE briefings             ENABLE ROW LEVEL SECURITY;
ALTER TABLE mapa_politico         ENABLE ROW LEVEL SECURITY;
ALTER TABLE publicacoes_portal    ENABLE ROW LEVEL SECURITY;
ALTER TABLE scores_municipio_parlamentar ENABLE ROW LEVEL SECURITY;

-- transferencias_federais e emendas_parlamentares: sem acesso direto pelo cliente
-- Leitura apenas via API Route com service role — RLS não é habilitado nessas tabelas
-- para evitar exposição acidental de dados brutos no frontend.

-- ─── FUNÇÕES HELPER ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION _user_tipo()
RETURNS text LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT tipo FROM profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION _user_municipio()
RETURNS text LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT municipio_ibge FROM profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION _user_parlamentar()
RETURNS text LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT parlamentar_id FROM profiles WHERE id = auth.uid()
$$;

-- ─── PROFILES ────────────────────────────────────────────────────────────────
CREATE POLICY profiles_select ON profiles FOR SELECT
  USING (id = auth.uid() OR _user_tipo() = 'admin');

CREATE POLICY profiles_update ON profiles FOR UPDATE
  USING (id = auth.uid());

-- ─── CONTRATOS ───────────────────────────────────────────────────────────────
-- Cliente vê apenas o próprio contrato; admin vê todos
CREATE POLICY contratos_select ON contratos FOR SELECT
  USING (profile_id = auth.uid() OR _user_tipo() = 'admin');

-- INSERT/UPDATE/DELETE apenas via service role (API Routes)

-- ─── DIAGNÓSTICOS ────────────────────────────────────────────────────────────
-- Prefeito vê apenas o diagnóstico do próprio município
CREATE POLICY diagnosticos_select ON diagnosticos FOR SELECT
  USING (municipio_ibge = _user_municipio() OR _user_tipo() = 'admin');

-- INSERT/UPDATE/DELETE apenas via service role (API Routes)

-- ─── BRIEFINGS ───────────────────────────────────────────────────────────────
-- Deputado vê apenas os próprios briefings
CREATE POLICY briefings_select ON briefings FOR SELECT
  USING (parlamentar_id = _user_parlamentar() OR _user_tipo() = 'admin');

-- INSERT/UPDATE/DELETE apenas via service role (API Routes)

-- ─── MAPA POLÍTICO ───────────────────────────────────────────────────────────
-- Deputado vê apenas o próprio mapa; admin vê tudo
CREATE POLICY mapa_politico_select ON mapa_politico FOR SELECT
  USING (parlamentar_id = _user_parlamentar() OR _user_tipo() = 'admin');

-- INSERT/UPDATE via service role apenas

-- ─── SCORES ──────────────────────────────────────────────────────────────────
CREATE POLICY scores_select ON scores_municipio_parlamentar FOR SELECT
  USING (parlamentar_id = _user_parlamentar() OR _user_tipo() = 'admin');

-- ─── PUBLICAÇÕES PORTAL ──────────────────────────────────────────────────────
-- Leitura pública irrestrita
CREATE POLICY publicacoes_select ON publicacoes_portal FOR SELECT
  USING (true);

-- Apenas admin pode criar/editar/deletar publicações
CREATE POLICY publicacoes_insert ON publicacoes_portal FOR INSERT
  WITH CHECK (_user_tipo() = 'admin');

CREATE POLICY publicacoes_update ON publicacoes_portal FOR UPDATE
  USING (_user_tipo() = 'admin');

CREATE POLICY publicacoes_delete ON publicacoes_portal FOR DELETE
  USING (_user_tipo() = 'admin');
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/002_rls_policies.sql
git commit -m "feat: add RLS policies migration 002"
```

---

## Task 4: Migration 003 — Indexes

**Files:**
- Create: `supabase/migrations/003_indexes.sql`

- [ ] **Step 1: Escrever migration 003**

```sql
-- supabase/migrations/003_indexes.sql

-- GIN para queries em arrays de programas
CREATE INDEX idx_habilitacao_programas
  ON municipios_habilitacao USING GIN(programas_habilitados);
CREATE INDEX idx_habilitacao_programas_bloqueados
  ON municipios_habilitacao USING GIN(programas_bloqueados);

-- Transferências — buscas frequentes por município, programa e prazo
CREATE INDEX idx_transferencias_ibge    ON transferencias_federais(municipio_ibge);
CREATE INDEX idx_transferencias_programa ON transferencias_federais(programa);
CREATE INDEX idx_transferencias_prazo   ON transferencias_federais(prazo_limite)
  WHERE prazo_limite IS NOT NULL;
CREATE INDEX idx_transferencias_comp    ON transferencias_federais(competencia);

-- Emendas — buscas por parlamentar, município e exercício
CREATE INDEX idx_emendas_parlamentar ON emendas_parlamentares(parlamentar_id);
CREATE INDEX idx_emendas_municipio   ON emendas_parlamentares(municipio_ibge);
CREATE INDEX idx_emendas_tipo        ON emendas_parlamentares(parlamentar_tipo);
CREATE INDEX idx_emendas_exercicio   ON emendas_parlamentares(exercicio);

-- Diagnósticos e briefings — busca por status (alertas de 'gerando' travado)
CREATE INDEX idx_diagnosticos_ibge   ON diagnosticos(municipio_ibge);
CREATE INDEX idx_diagnosticos_status ON diagnosticos(status);
CREATE INDEX idx_briefings_parl      ON briefings(parlamentar_id);
CREATE INDEX idx_briefings_status    ON briefings(status);

-- Mapa político e scores
CREATE INDEX idx_mapa_parlamentar  ON mapa_politico(parlamentar_id);
CREATE INDEX idx_scores_parlamentar ON scores_municipio_parlamentar(parlamentar_id);
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/003_indexes.sql
git commit -m "feat: add performance indexes migration 003"
```

---

## Task 5: Seed — 5.570 municípios IBGE

**Files:**
- Create: `scripts/gerar_seed.py`
- Create: `supabase/seed.sql` (gerado pelo script)

- [ ] **Step 1: Escrever script gerador**

```python
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
    return m["microrregiao"]["mesorregiao"]["UF"]["sigla"]


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
```

- [ ] **Step 2: Executar o script**

```bash
cd /Users/lucianomenezes/Nexanegocios
pip install requests --quiet
python scripts/gerar_seed.py
```

Esperado: `5570 municípios encontrados` e arquivo `supabase/seed.sql` criado.

- [ ] **Step 3: Verificar seed**

```bash
head -5 supabase/seed.sql
wc -l supabase/seed.sql
```

Esperado: cabeçalho SQL + ~5.573 linhas (header + 5570 valores + 1 ponto-e-vírgula).

- [ ] **Step 4: Commit**

```bash
git add scripts/gerar_seed.py supabase/seed.sql
git commit -m "feat: add IBGE municipalities seed (5570 municípios)"
```

---

## Task 6: Aplicar migrations no Supabase e verificar schema

**Pré-requisito:** Supabase CLI instalado (`npm install -g supabase`) e projeto criado em supabase.com.

- [ ] **Step 1: Instalar Supabase CLI se necessário**

```bash
npm install -g supabase
supabase --version
```

Esperado: versão 1.x ou superior.

- [ ] **Step 2: Linkar projeto local ao Supabase**

```bash
supabase login
supabase link --project-ref SEU_PROJECT_REF
```

`SEU_PROJECT_REF` está na URL do projeto Supabase: `https://supabase.com/dashboard/project/SEU_PROJECT_REF`

- [ ] **Step 3: Aplicar migration 001**

```bash
supabase db push --file supabase/migrations/001_init_schema.sql
```

Esperado: `Applying migration... done` sem erros.

- [ ] **Step 4: Aplicar migration 002**

```bash
supabase db push --file supabase/migrations/002_rls_policies.sql
```

- [ ] **Step 5: Aplicar migration 003**

```bash
supabase db push --file supabase/migrations/003_indexes.sql
```

- [ ] **Step 6: Aplicar seed**

```bash
supabase db push --file supabase/seed.sql
```

- [ ] **Step 7: Verificar tabelas no painel Supabase**

Abrir `https://supabase.com/dashboard/project/SEU_PROJECT_REF/editor` e executar:

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

Esperado: 11 tabelas listadas (briefings, cnds_municipios, contratos, diagnosticos, emendas_parlamentares, mapa_politico, municipios_habilitacao, profiles, publicacoes_portal, scores_municipio_parlamentar, transferencias_federais).

- [ ] **Step 8: Verificar seed**

```sql
SELECT COUNT(*) FROM municipios_habilitacao;
```

Esperado: 5570.

- [ ] **Step 9: Criar Storage bucket para PDFs**

No painel Supabase → Storage → New bucket:
- Name: `relatorios`
- Public: **false** (acesso via signed URL)

- [ ] **Step 10: Anotar variáveis de ambiente**

No painel Supabase → Settings → API, copiar:
- `URL` → `SUPABASE_URL`
- `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `service_role` → `SUPABASE_SERVICE_ROLE_KEY`

Criar `.env` na raiz do projeto (não commitar):
```bash
SUPABASE_URL=https://SEU_PROJETO.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
PORTAL_TRANSPARENCIA_API_KEY=sua_chave_aqui
```

Chave do Portal da Transparência: cadastro gratuito em `portaldatransparencia.gov.br/api-de-dados/cadastrar`

---

## Task 7: Ambiente Python do scraper

**Files:**
- Create: `scraper/config.py`

- [ ] **Step 1: Criar ambiente virtual e instalar dependências**

```bash
python3 -m venv scraper/.venv
source scraper/.venv/bin/activate
pip install -r scraper/requirements.txt
```

Esperado: instalação sem erros.

- [ ] **Step 2: Escrever `scraper/config.py`**

```python
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
# Chave: "Nome - UF", Valor: código IBGE
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
```

- [ ] **Step 3: Verificar importação**

```bash
cd /Users/lucianomenezes/Nexanegocios
source scraper/.venv/bin/activate
python -c "from scraper.config import MUNICIPIOS_ATIVOS; print(len(MUNICIPIOS_ATIVOS), 'municípios')"
```

Esperado: `9 municípios`.

- [ ] **Step 4: Commit**

```bash
git add scraper/config.py
git commit -m "feat: add scraper config and municipality registry"
```

---

## Task 8: supabase_client.py

**Files:**
- Create: `scraper/supabase_client.py`

- [ ] **Step 1: Escrever `scraper/supabase_client.py`**

```python
# scraper/supabase_client.py
from supabase import create_client, Client
from scraper.config import SUPABASE_URL, SUPABASE_KEY

_client: Client | None = None


def get_client() -> Client:
    global _client
    if _client is None:
        _client = create_client(SUPABASE_URL, SUPABASE_KEY)
    return _client


def upsert(table: str, rows: list[dict], on_conflict: str) -> None:
    """Insere ou atualiza rows na tabela. on_conflict: coluna(s) de conflito."""
    if not rows:
        return
    get_client().table(table).upsert(rows, on_conflict=on_conflict).execute()
```

- [ ] **Step 2: Verificar conexão com Supabase**

```bash
source scraper/.venv/bin/activate
python -c "
from scraper.supabase_client import get_client
r = get_client().table('municipios_habilitacao').select('ibge').limit(1).execute()
print('Conexão OK, ibge:', r.data[0]['ibge'])
"
```

Esperado: `Conexão OK, ibge: 1100015` (ou qualquer código IBGE válido).

- [ ] **Step 3: Commit**

```bash
git add scraper/supabase_client.py
git commit -m "feat: add Supabase client wrapper with upsert helper"
```

---

## Task 9: Source — Portal da Transparência

**Files:**
- Create: `scraper/sources/portal_transparencia.py`

- [ ] **Step 1: Escrever o source**

```python
# scraper/sources/portal_transparencia.py
"""
Coleta transferências voluntárias federais por município via Portal da Transparência API.
Documentação: https://api.portaldatransparencia.gov.br/swagger-ui.html
"""
import time
import logging
import requests
from scraper.config import PORTAL_API_KEY, RATE_LIMIT_SECONDS, USER_AGENT

log = logging.getLogger(__name__)

BASE_URL = "https://api.portaldatransparencia.gov.br/api-de-dados"


class PortalTransparenciaClient:
    def __init__(self) -> None:
        self.headers = {
            "chave-api-dados": PORTAL_API_KEY,
            "Accept": "application/json",
            "User-Agent": USER_AGENT,
        }

    def _get_paginated(self, endpoint: str, params: dict) -> list[dict]:
        url = f"{BASE_URL}/{endpoint}"
        results: list[dict] = []
        pagina = 1
        while True:
            params["pagina"] = pagina
            try:
                r = requests.get(url, headers=self.headers, params=params, timeout=30)
                r.raise_for_status()
                data = r.json()
            except requests.RequestException as e:
                log.error("Portal Transparência erro em %s: %s", endpoint, e)
                break
            if not data:
                break
            results.extend(data)
            pagina += 1
            time.sleep(RATE_LIMIT_SECONDS)
        return results

    def transferencias_por_municipio(self, ibge: str, ano: int) -> list[dict]:
        """Retorna lista de transferências voluntárias para o município no ano."""
        return self._get_paginated(
            "transferencias-voluntarias",
            {"codigoIbge": ibge, "ano": ano},
        )


def coletar_transferencias(ibge: str, anos: list[int]) -> list[dict]:
    """
    Retorna rows prontas para inserção em transferencias_federais.
    Cada transferência do Portal vira uma row com campos normalizados.
    """
    client = PortalTransparenciaClient()
    rows: list[dict] = []
    for ano in anos:
        registros = client.transferencias_por_municipio(ibge, ano)
        log.info("  %s | %d | %d registros", ibge, ano, len(registros))
        for r in registros:
            rows.append({
                "municipio_ibge":   ibge,
                "programa":         r.get("programa", {}).get("nome", "DESCONHECIDO"),
                "fundo":            r.get("orgaoSuperior", {}).get("nome", "FEDERAL"),
                "valor_empenhado":  float(r.get("valorEmpenhado") or 0),
                "valor_liquidado":  float(r.get("valorLiquidado") or 0),
                "valor_pago":       float(r.get("valorPago") or 0),
                "fonte":            "portal_transparencia",
                "raw_json":         r,
            })
    return rows
```

- [ ] **Step 2: Commit**

```bash
git add scraper/sources/portal_transparencia.py
git commit -m "feat: add Portal da Transparência source"
```

---

## Task 10: Source — SIGA Brasil (SPARQL)

**Files:**
- Create: `scraper/sources/siga_brasil.py`

- [ ] **Step 1: Escrever o source**

```python
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
        rows.append({
            "parlamentar_id":   b["autoria"]["value"],
            "parlamentar_nome": b["nomeAutor"]["value"],
            "tipo":             "RP6",
            "parlamentar_tipo": "individual",
            "municipio_ibge":   b["codigoIbge"]["value"],
            "area_tematica":    b["area"]["value"].lower(),
            "valor_autorizado": float(b["valorAutorizado"]["value"] or 0),
            "valor_empenhado":  float(b["valorEmpenhado"]["value"] or 0),
            "valor_executado":  0.0,
            "exercicio":        ano,
            "fonte":            "siga_brasil",
        })
    log.info("SIGA Brasil | %d | %d emendas individuais", ano, len(rows))
    return rows
```

- [ ] **Step 2: Commit**

```bash
git add scraper/sources/siga_brasil.py
git commit -m "feat: add SIGA Brasil SPARQL source"
```

---

## Task 11: Source — Transferegov

**Files:**
- Create: `scraper/sources/transferegov.py`

- [ ] **Step 1: Escrever o source**

```python
# scraper/sources/transferegov.py
"""
Coleta convênios e instrumentos via API Transferegov.
Sem autenticação para leitura pública.
"""
import time
import logging
import requests
from scraper.config import RATE_LIMIT_SECONDS, USER_AGENT

log = logging.getLogger(__name__)

BASE_URL = "https://api.transferegov.sistema.gov.br/api"
HEADERS = {"Accept": "application/json", "User-Agent": USER_AGENT}


def _get(endpoint: str, params: dict) -> list[dict]:
    results: list[dict] = []
    pagina = 1
    while True:
        params["pagina"] = pagina
        params["tamanhoPagina"] = 100
        try:
            r = requests.get(
                f"{BASE_URL}/{endpoint}",
                headers=HEADERS,
                params=params,
                timeout=30,
            )
            r.raise_for_status()
            data = r.json()
        except requests.RequestException as e:
            log.error("Transferegov erro em %s: %s", endpoint, e)
            break
        items = data if isinstance(data, list) else data.get("data", [])
        if not items:
            break
        results.extend(items)
        pagina += 1
        time.sleep(RATE_LIMIT_SECONDS)
    return results


def coletar_convenios(ibge: str) -> list[dict]:
    """Retorna rows prontas para inserção em transferencias_federais."""
    registros = _get("convenios", {"codigoMunicipioIbge": ibge})
    rows: list[dict] = []
    for r in registros:
        rows.append({
            "municipio_ibge":  ibge,
            "programa":        r.get("objeto", "CONVENIO")[:100],
            "fundo":           r.get("orgaoSuperior", {}).get("nome", "FEDERAL"),
            "valor_empenhado": float(r.get("valorGlobal") or 0),
            "valor_liquidado": float(r.get("valorDesembolsado") or 0),
            "valor_pago":      float(r.get("valorDesembolsado") or 0),
            "fonte":           "transferegov",
            "raw_json":        r,
        })
    log.info("Transferegov | %s | %d convênios", ibge, len(rows))
    return rows
```

- [ ] **Step 2: Commit**

```bash
git add scraper/sources/transferegov.py
git commit -m "feat: add Transferegov source"
```

---

## Task 12: Source — FNDE

**Files:**
- Create: `scraper/sources/fnde.py`

- [ ] **Step 1: Escrever o source**

```python
# scraper/sources/fnde.py
"""
Coleta transferências FNDE: PNAE, PNATE, PDDE, Proinfância.
API: https://www.fnde.gov.br/dadosabertos
"""
import time
import logging
import requests
from scraper.config import RATE_LIMIT_SECONDS, USER_AGENT

log = logging.getLogger(__name__)

BASE_URL = "https://www.fnde.gov.br/sigetape/consultaPublica/get"
HEADERS = {"Accept": "application/json", "User-Agent": USER_AGENT}

PROGRAMAS_FNDE = {
    "PNAE":      "pnae",
    "PNATE":     "pnate",
    "PDDE":      "pdde",
    "PROINFANCIA": "proinfancia",
}


def _get_programa(programa_slug: str, ibge: str, ano: int) -> list[dict]:
    try:
        r = requests.get(
            f"{BASE_URL}/{programa_slug}",
            headers=HEADERS,
            params={"codigoIbge": ibge, "anoReferencia": ano},
            timeout=30,
        )
        r.raise_for_status()
        return r.json() if isinstance(r.json(), list) else []
    except requests.RequestException as e:
        log.warning("FNDE %s | %s | %s", programa_slug, ibge, e)
        return []
    finally:
        time.sleep(RATE_LIMIT_SECONDS)


def coletar_fnde(ibge: str, anos: list[int]) -> list[dict]:
    """Retorna rows prontas para inserção em transferencias_federais."""
    rows: list[dict] = []
    for programa_nome, slug in PROGRAMAS_FNDE.items():
        for ano in anos:
            registros = _get_programa(slug, ibge, ano)
            for r in registros:
                rows.append({
                    "municipio_ibge":  ibge,
                    "programa":        programa_nome,
                    "fundo":           "FNDE",
                    "valor_empenhado": float(r.get("valorRepasse") or 0),
                    "valor_liquidado": float(r.get("valorEfetivado") or 0),
                    "valor_pago":      float(r.get("valorEfetivado") or 0),
                    "fonte":           "fnde",
                    "raw_json":        r,
                })
    log.info("FNDE | %s | %d registros", ibge, len(rows))
    return rows
```

- [ ] **Step 2: Commit**

```bash
git add scraper/sources/fnde.py
git commit -m "feat: add FNDE source (PNAE, PNATE, PDDE, Proinfância)"
```

---

## Task 13: Source — Portais Estaduais (stub + fluxo manual)

**Files:**
- Create: `scraper/sources/portais_estaduais.py`

- [ ] **Step 1: Escrever o source**

```python
# scraper/sources/portais_estaduais.py
"""
Portais estaduais AL/SE/PE — Camada 2 (semi-automática).
O scraper tenta coletar; analista Nexa valida antes de publicar no painel.
Erros de scraping são esperados — portais mudam de layout sem aviso.
"""
import logging
import requests
from scraper.config import RATE_LIMIT_SECONDS, USER_AGENT

log = logging.getLogger(__name__)

PORTAIS = {
    "AL": "https://transparencia.al.gov.br",
    "SE": "https://transparencia.se.gov.br",
    "PE": "https://transparencia.pe.gov.br",
}


def tentar_coletar_estadual(uf: str, ibge: str) -> list[dict]:
    """
    Tenta scraping do portal estadual. Retorna lista vazia se falhar.
    Resultado desta função DEVE ser validado manualmente antes de inserção.
    """
    if uf not in PORTAIS:
        log.warning("UF %s não mapeada nos portais estaduais", uf)
        return []

    url = PORTAIS[uf]
    try:
        r = requests.get(
            url,
            headers={"User-Agent": USER_AGENT},
            timeout=15,
        )
        r.raise_for_status()
        # TODO: implementar parsing HTML específico por portal quando layout estiver estável
        log.info("Portal %s respondeu (status %s) — parsing pendente de implementação", uf, r.status_code)
        return []
    except requests.RequestException as e:
        log.warning("Portal estadual %s indisponível: %s — requer validação manual", uf, e)
        return []


def registrar_pendencia_manual(ibge: str, uf: str, descricao: str) -> None:
    """
    Registra no log uma pendência para o analista Nexa tratar manualmente.
    Em versões futuras, escrever numa tabela de pendencias_manuais no Supabase.
    """
    log.warning(
        "PENDÊNCIA MANUAL | ibge=%s | uf=%s | %s",
        ibge, uf, descricao,
    )
```

- [ ] **Step 2: Commit**

```bash
git add scraper/sources/portais_estaduais.py
git commit -m "feat: add portais estaduais stub with manual validation flow"
```

---

## Task 14: Processor — calcular_subexecucao

**Files:**
- Create: `scraper/processors/calcular_subexecucao.py`

- [ ] **Step 1: Escrever o processor**

```python
# scraper/processors/calcular_subexecucao.py
"""
Calcula subexecução por município/programa e identifica valores em risco.
Opera sobre dados já inseridos em transferencias_federais no Supabase.
"""
import logging
from dataclasses import dataclass
from scraper.supabase_client import get_client

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
    prazo_limite: str | None
    em_risco: bool


def calcular_por_municipio(ibge: str) -> list[SubexecucaoPrograma]:
    """
    Retorna programas com subexecução para o município.
    Definição de 'em risco': execução < 70% OU prazo nos próximos 90 dias.
    """
    client = get_client()
    rows = (
        client.table("transferencias_federais")
        .select("programa,fundo,valor_empenhado,valor_pago,percentual_execucao,prazo_limite")
        .eq("municipio_ibge", ibge)
        .gt("valor_empenhado", 0)
        .execute()
        .data
    )

    resultado: list[SubexecucaoPrograma] = []
    for r in rows:
        pct = float(r["percentual_execucao"] or 0)
        prazo = r.get("prazo_limite")

        em_risco = pct < 70.0
        if prazo:
            from datetime import date
            dias = (date.fromisoformat(prazo) - date.today()).days
            if dias <= PRAZO_ALERTA_DIAS:
                em_risco = True

        if em_risco:
            resultado.append(SubexecucaoPrograma(
                municipio_ibge=ibge,
                programa=r["programa"],
                fundo=r["fundo"],
                valor_empenhado=float(r["valor_empenhado"]),
                valor_pago=float(r["valor_pago"]),
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
```

- [ ] **Step 2: Commit**

```bash
git add scraper/processors/calcular_subexecucao.py
git commit -m "feat: add subexecucao processor"
```

---

## Task 15: Processor — atualizar_habilitacao

**Files:**
- Create: `scraper/processors/atualizar_habilitacao.py`

- [ ] **Step 1: Escrever o processor**

```python
# scraper/processors/atualizar_habilitacao.py
"""
Atualiza a tabela municipios_habilitacao com programas habilitados
baseado nos dados coletados de transferencias_federais.
"""
import logging
from datetime import datetime, timezone
from scraper.supabase_client import get_client, upsert

log = logging.getLogger(__name__)

PROGRAMAS_SAUDE = {"ATENCAO_BASICA", "MEDIA_ALTA_COMPLEXIDADE", "CAPS", "REDE_CEGONHA", "VIGILANCIA"}
PROGRAMAS_EDUCACAO = {"PNAE", "PNATE", "PDDE", "PROINFANCIA"}
PROGRAMAS_ASSISTENCIA = {"SCFV", "IGD-SUAS", "BPC_ESCOLA", "CRIANCA_FELIZ", "TEA"}


def atualizar_programas_habilitados(ibge: str) -> None:
    """
    Infere programas habilitados a partir dos programas que já tiveram
    transferências no histórico. Atualiza municipios_habilitacao.
    """
    client = get_client()
    programas_com_historico = (
        client.table("transferencias_federais")
        .select("programa")
        .eq("municipio_ibge", ibge)
        .gt("valor_empenhado", 0)
        .execute()
        .data
    )

    habilitados = list({r["programa"] for r in programas_com_historico})

    upsert(
        "municipios_habilitacao",
        [{
            "ibge": ibge,
            "programas_habilitados": habilitados,
            "ultima_verificacao": datetime.now(timezone.utc).isoformat(),
        }],
        on_conflict="ibge",
    )
    log.info("Habilitação | %s | %d programas", ibge, len(habilitados))


def marcar_cauc_irregular(ibge: str) -> None:
    """Marca município como irregular no CAUC após verificação manual."""
    upsert(
        "municipios_habilitacao",
        [{"ibge": ibge, "cauc_regular": False,
          "ultima_verificacao": datetime.now(timezone.utc).isoformat()}],
        on_conflict="ibge",
    )
    log.warning("CAUC irregular marcado | %s", ibge)
```

- [ ] **Step 2: Commit**

```bash
git add scraper/processors/atualizar_habilitacao.py
git commit -m "feat: add habilitacao processor"
```

---

## Task 16: run.py — Entry point

**Files:**
- Create: `scraper/run.py`

- [ ] **Step 1: Escrever `scraper/run.py`**

```python
# scraper/run.py
"""
Entry point do cron job semanal.
Execução: python -m scraper.run
"""
import logging
import sys
from datetime import datetime

from scraper.config import MUNICIPIOS_ATIVOS
from scraper.supabase_client import upsert
from scraper.sources.portal_transparencia import coletar_transferencias
from scraper.sources.siga_brasil import coletar_emendas_individuais
from scraper.sources.transferegov import coletar_convenios
from scraper.sources.fnde import coletar_fnde
from scraper.sources.portais_estaduais import tentar_coletar_estadual, registrar_pendencia_manual
from scraper.processors.calcular_subexecucao import calcular_por_municipio
from scraper.processors.atualizar_habilitacao import atualizar_programas_habilitados

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
log = logging.getLogger("nexaradar.run")

ANOS = [datetime.now().year, datetime.now().year - 1]


def coletar_municipio(ibge: str, nome: str) -> None:
    log.info("=== Iniciando coleta | %s (%s) ===", nome, ibge)

    # Transferências Portal Transparência
    rows_portal = coletar_transferencias(ibge, ANOS)
    if rows_portal:
        upsert("transferencias_federais", rows_portal, on_conflict="municipio_ibge,programa,fonte")

    # Convênios Transferegov
    rows_tgov = coletar_convenios(ibge)
    if rows_tgov:
        upsert("transferencias_federais", rows_tgov, on_conflict="municipio_ibge,programa,fonte")

    # FNDE
    rows_fnde = coletar_fnde(ibge, ANOS)
    if rows_fnde:
        upsert("transferencias_federais", rows_fnde, on_conflict="municipio_ibge,programa,fonte")

    # Portais estaduais (semi-automático)
    uf = nome.split(" - ")[-1] if " - " in nome else ""
    estadual = tentar_coletar_estadual(uf, ibge)
    if not estadual:
        registrar_pendencia_manual(ibge, uf, "Coleta estadual requer validação manual")

    # Processar
    atualizar_programas_habilitados(ibge)
    em_risco = calcular_por_municipio(ibge)
    log.info("  %d programas em risco identificados", len(em_risco))


def coletar_emendas(ano: int) -> None:
    log.info("=== Coletando emendas SIGA Brasil | %d ===", ano)
    rows = coletar_emendas_individuais(ano)
    if rows:
        upsert("emendas_parlamentares", rows, on_conflict="parlamentar_id,municipio_ibge,exercicio,fonte")


def main() -> None:
    log.info("Nexa Radar — Início da coleta %s", datetime.now().isoformat())

    for nome, ibge in MUNICIPIOS_ATIVOS.items():
        try:
            coletar_municipio(ibge, nome)
        except Exception as e:
            log.error("Falha em %s (%s): %s", nome, ibge, e, exc_info=True)

    for ano in ANOS:
        try:
            coletar_emendas(ano)
        except Exception as e:
            log.error("Falha emendas %d: %s", ano, e, exc_info=True)

    log.info("Nexa Radar — Coleta concluída")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Commit**

```bash
git add scraper/run.py
git commit -m "feat: add scraper run.py entry point with structured logging"
```

---

## Task 17: Testes unitários com HTTP mockado

**Files:**
- Create: `scraper/tests/test_portal_transparencia.py`
- Create: `scraper/tests/test_siga_brasil.py`
- Create: `scraper/tests/test_processors.py`

- [ ] **Step 1: Escrever testes do Portal da Transparência**

```python
# scraper/tests/test_portal_transparencia.py
import responses as resp_mock
import pytest
from scraper.sources.portal_transparencia import coletar_transferencias

PORTAL_URL = "https://api.portaldatransparencia.gov.br/api-de-dados/transferencias-voluntarias"

MOCK_RESPONSE = [
    {
        "programa": {"nome": "SCFV"},
        "orgaoSuperior": {"nome": "MDS"},
        "valorEmpenhado": "500000.00",
        "valorLiquidado": "300000.00",
        "valorPago": "250000.00",
    }
]


@resp_mock.activate
def test_coletar_transferencias_retorna_rows_normalizadas():
    resp_mock.add(resp_mock.GET, PORTAL_URL, json=MOCK_RESPONSE, status=200)
    resp_mock.add(resp_mock.GET, PORTAL_URL, json=[], status=200)  # fim da paginação

    rows = coletar_transferencias("2803500", [2024])

    assert len(rows) == 1
    assert rows[0]["municipio_ibge"] == "2803500"
    assert rows[0]["programa"] == "SCFV"
    assert rows[0]["valor_empenhado"] == 500000.0
    assert rows[0]["valor_pago"] == 250000.0
    assert rows[0]["fonte"] == "portal_transparencia"


@resp_mock.activate
def test_coletar_transferencias_api_indisponivel_retorna_lista_vazia():
    resp_mock.add(resp_mock.GET, PORTAL_URL, body=Exception("timeout"))

    rows = coletar_transferencias("2803500", [2024])

    assert rows == []


@resp_mock.activate
def test_coletar_transferencias_resposta_vazia():
    resp_mock.add(resp_mock.GET, PORTAL_URL, json=[], status=200)

    rows = coletar_transferencias("2803500", [2024])

    assert rows == []
```

- [ ] **Step 2: Escrever testes do SIGA Brasil**

```python
# scraper/tests/test_siga_brasil.py
from unittest.mock import patch, MagicMock
from scraper.sources.siga_brasil import coletar_emendas_individuais

MOCK_SPARQL_RESULT = {
    "results": {
        "bindings": [
            {
                "autoria":        {"value": "DEP12345"},
                "nomeAutor":      {"value": "João Silva"},
                "codigoIbge":     {"value": "2803500"},
                "area":           {"value": "Saúde"},
                "valorAutorizado": {"value": "1000000.00"},
                "valorEmpenhado":  {"value": "800000.00"},
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
```

- [ ] **Step 3: Escrever testes dos processors**

```python
# scraper/tests/test_processors.py
from unittest.mock import patch, MagicMock
from scraper.processors.calcular_subexecucao import (
    calcular_por_municipio,
    valor_total_em_risco,
)


def _mock_client(rows: list[dict]):
    client = MagicMock()
    (client.table.return_value
           .select.return_value
           .eq.return_value
           .gt.return_value
           .execute.return_value
           .data) = rows
    return client


def test_programa_abaixo_de_70_pct_marcado_em_risco():
    rows = [{
        "programa": "SCFV",
        "fundo": "FNAS",
        "valor_empenhado": "1000000",
        "valor_pago": "500000",
        "percentual_execucao": "50.00",
        "prazo_limite": None,
    }]
    with patch("scraper.processors.calcular_subexecucao.get_client", return_value=_mock_client(rows)):
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
    with patch("scraper.processors.calcular_subexecucao.get_client", return_value=_mock_client(rows)):
        resultado = calcular_por_municipio("2803500")

    assert resultado == []


def test_valor_total_em_risco_soma_diferenca():
    rows = [
        {"programa": "SCFV",  "fundo": "FNAS", "valor_empenhado": "1000000",
         "valor_pago": "400000", "percentual_execucao": "40.00", "prazo_limite": None},
        {"programa": "PNAE",  "fundo": "FNDE", "valor_empenhado": "200000",
         "valor_pago": "100000", "percentual_execucao": "50.00", "prazo_limite": None},
    ]
    with patch("scraper.processors.calcular_subexecucao.get_client", return_value=_mock_client(rows)):
        total = valor_total_em_risco("2803500")

    assert total == 700_000.0  # (1M-400k) + (200k-100k)
```

- [ ] **Step 4: Rodar todos os testes**

```bash
source scraper/.venv/bin/activate
cd /Users/lucianomenezes/Nexanegocios
pytest scraper/tests/ -v
```

Esperado:
```
test_portal_transparencia.py::test_coletar_transferencias_retorna_rows_normalizadas PASSED
test_portal_transparencia.py::test_coletar_transferencias_api_indisponivel_retorna_lista_vazia PASSED
test_portal_transparencia.py::test_coletar_transferencias_resposta_vazia PASSED
test_siga_brasil.py::test_coletar_emendas_retorna_rows_normalizadas PASSED
test_siga_brasil.py::test_coletar_emendas_sparql_erro_retorna_lista_vazia PASSED
test_processors.py::test_programa_abaixo_de_70_pct_marcado_em_risco PASSED
test_processors.py::test_programa_acima_de_70_pct_sem_prazo_nao_aparece PASSED
test_processors.py::test_valor_total_em_risco_soma_diferenca PASSED
8 passed
```

- [ ] **Step 5: Commit**

```bash
git add scraper/tests/
git commit -m "test: add unit tests for scrapers and processors (8 tests, all mocked)"
```

---

## Task 18: Smoke test com dados reais (escopo pequeno)

**Objetivo:** Confirmar que o pipeline funciona de ponta a ponta com APIs reais antes do deploy.

- [ ] **Step 1: Rodar coleta apenas para Lagarto-SE**

```bash
source scraper/.venv/bin/activate
python -c "
import logging
logging.basicConfig(level=logging.INFO)
from scraper.sources.portal_transparencia import coletar_transferencias
from scraper.supabase_client import upsert

rows = coletar_transferencias('2803500', [2024])
print(f'{len(rows)} transferências coletadas para Lagarto-SE')
if rows:
    print('Exemplo:', rows[0]['programa'], rows[0]['valor_pago'])
    upsert('transferencias_federais', rows[:5], on_conflict='municipio_ibge,programa,fonte')
    print('5 rows inseridas no Supabase')
"
```

Esperado: número de transferências > 0 e confirmação de inserção.

- [ ] **Step 2: Verificar no Supabase**

No painel Supabase → Table Editor → `transferencias_federais`:

```sql
SELECT municipio_ibge, programa, valor_empenhado, valor_pago, percentual_execucao
FROM transferencias_federais
WHERE municipio_ibge = '2803500'
LIMIT 5;
```

Esperado: 5 linhas com dados reais de Lagarto-SE.

- [ ] **Step 3: Rodar processor**

```bash
python -c "
from scraper.processors.calcular_subexecucao import calcular_por_municipio, valor_total_em_risco
programas = calcular_por_municipio('2803500')
total = valor_total_em_risco('2803500')
print(f'{len(programas)} programas em risco')
print(f'R\$ {total:,.2f} em risco total')
"
```

Esperado: saída com número de programas e valor total.

---

## Task 19: Commit final e setup EasyPanel

- [ ] **Step 1: Commit final da foundation**

```bash
git add -A
git status  # verificar que .env não está incluído
git commit -m "feat: complete foundation — Supabase schema + Python scrapers"
```

- [ ] **Step 2: Push para repositório remoto**

```bash
git remote add origin https://github.com/SEU_USUARIO/nexa-radar.git
git push -u origin main
```

- [ ] **Step 3: Criar serviço scraper no EasyPanel**

No painel EasyPanel:
1. New App → From GitHub → selecionar repositório `nexa-radar`
2. Nome: `nexa-radar-scraper`
3. Root Directory: `scraper/`
4. Start Command: `python run.py`
5. Environment Variables: adicionar `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `PORTAL_TRANSPARENCIA_API_KEY`
6. **Não** ativar deploy automático — scraper roda por cron, não por webhook

- [ ] **Step 4: Configurar cron no VPS**

Via SSH no VPS do EasyPanel:

```bash
ssh root@SEU_VPS_IP
crontab -e
```

Adicionar linha (toda segunda-feira às 6h):
```
0 6 * * 1 docker exec nexa-radar-scraper python run.py >> /var/log/nexa-scraper.log 2>&1
```

- [ ] **Step 5: Verificar nome do container**

```bash
docker ps | grep scraper
```

Usar o nome exato retornado no crontab.

---

## Validação Final da Foundation

Ao completar todas as tasks, verificar:

- [ ] 11 tabelas criadas no Supabase com schema correto
- [ ] RLS habilitado nas tabelas sensíveis (profiles, contratos, diagnosticos, briefings, mapa_politico, publicacoes_portal, scores)
- [ ] 5.570 municípios no seed
- [ ] 8 testes passando (`pytest scraper/tests/ -v`)
- [ ] Smoke test: dados reais de Lagarto-SE inseridos no Supabase
- [ ] Cron configurado no VPS

**Próximo passo:** Plano 2 — Next.js Application (dashboard admin, portal cliente, geração de diagnósticos e briefings com Claude API, PDF).
