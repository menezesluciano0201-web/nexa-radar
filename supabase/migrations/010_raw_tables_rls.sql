-- supabase/migrations/010_raw_tables_rls.sql
-- CRITICAL: Enable RLS on raw data tables that were intentionally left without RLS
-- but with Supabase's default grants giving `authenticated` full SELECT access.
-- These tables are only accessed via service role (API routes / scraper) — enabling
-- RLS with no policies means: service role bypasses (OK), authenticated is denied (correct).

ALTER TABLE transferencias_federais ENABLE ROW LEVEL SECURITY;
ALTER TABLE emendas_parlamentares   ENABLE ROW LEVEL SECURITY;

-- No SELECT policies = deny all for anon/authenticated.
-- Service role (admin client + scraper) bypasses RLS entirely and continues to work.

-- Add composite index for portal query pattern: diagnosticos by municipio ordered by date
CREATE INDEX IF NOT EXISTS idx_diagnosticos_ibge_data
  ON diagnosticos (municipio_ibge, criado_em DESC);
