-- supabase/migrations/004_fix_transferencias_unique_constraint.sql
-- Fix: unique constraint on transferencias_federais must include competencia
-- to avoid multi-year data collapsing on weekly runs.

ALTER TABLE transferencias_federais
  DROP CONSTRAINT IF EXISTS uq_transferencias_ibge_programa_fonte;

ALTER TABLE transferencias_federais
  ADD CONSTRAINT uq_transferencias_ibge_programa_fonte
  UNIQUE (municipio_ibge, programa, fonte, competencia);
