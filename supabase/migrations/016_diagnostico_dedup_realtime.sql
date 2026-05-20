-- supabase/migrations/016_diagnostico_dedup_realtime.sql
-- 1. Partial unique index: only one diagnostico per municipio can be in 'gerando' at a time.
--    Makes the dedup check in POST /api/diagnostico atomic at the DB layer (mirrors migration 014 for briefings).
-- 2. Add briefings to Realtime publication so BriefingForm postgres_changes events fire.

CREATE UNIQUE INDEX diagnosticos_municipio_gerando_unique
  ON diagnosticos (municipio_ibge)
  WHERE status = 'gerando';

ALTER PUBLICATION supabase_realtime ADD TABLE briefings;
