-- 028_radar_indexes.sql
-- Índices para acelerar queries do M1 Radar de Subexecução.
-- A tabela transferencias_federais já existe (migration 001) e tem RLS admin-only.

-- Acelera agregação por município no feed principal
CREATE INDEX IF NOT EXISTS transferencias_municipio_pct_idx
  ON transferencias_federais (municipio_ibge, percentual_execucao);

-- Acelera filtro de prazo crítico (próximos 90 dias)
CREATE INDEX IF NOT EXISTS transferencias_prazo_idx
  ON transferencias_federais (prazo_limite)
  WHERE prazo_limite IS NOT NULL;

-- Acelera "freshness check" (MAX(coletado_em) para banner stale-data)
CREATE INDEX IF NOT EXISTS transferencias_coletado_idx
  ON transferencias_federais (coletado_em DESC);
