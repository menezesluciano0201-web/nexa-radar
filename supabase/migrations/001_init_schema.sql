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
    'diagnostico','monitoramento_prefeito','monitoramento_parlamentar',
    'prestacao_contas','licenca_plataforma'
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
  cauc_regular          boolean NOT NULL DEFAULT true,
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
  score_politico       numeric CHECK (score_politico BETWEEN 0 AND 100),
  score_saude_alocacao numeric CHECK (score_saude_alocacao BETWEEN 0 AND 100),
  score_capacidade     numeric CHECK (score_capacidade BETWEEN 0 AND 100),
  score_impacto_visual numeric CHECK (score_impacto_visual BETWEEN 0 AND 100),
  score_idh            numeric CHECK (score_idh BETWEEN 0 AND 100),
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
  verificado_em   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (municipio_ibge, tipo)
);
-- dias_restantes e alerta são calculados na aplicação: (validade - CURRENT_DATE) e status != 'valida'
-- GENERATED ALWAYS AS STORED não suporta CURRENT_DATE (não-imutável no PostgreSQL 15)

-- ─── UNIQUE CONSTRAINTS PARA UPSERT DOS SCRAPERS ────────────────────────────
-- Necessário para on_conflict funcionar corretamente no supabase-py
ALTER TABLE transferencias_federais
  ADD CONSTRAINT uq_transferencias_ibge_programa_fonte
  UNIQUE (municipio_ibge, programa, fonte, competencia);
-- competencia = NULL groups all transfers without date into one slot (acceptable default)
-- Each source should populate competencia with the reference date (e.g., '2024-01-01')

ALTER TABLE emendas_parlamentares
  ADD CONSTRAINT uq_emendas_parlamentar_municipio_exercicio_fonte
  UNIQUE (parlamentar_id, municipio_ibge, exercicio, fonte);
