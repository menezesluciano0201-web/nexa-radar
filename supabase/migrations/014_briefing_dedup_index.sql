-- supabase/migrations/014_briefing_dedup_index.sql
-- Partial unique index: only one briefing per parlamentar can be in 'gerando' state at a time.
-- Makes the dedup check in POST /api/briefing atomic at the DB layer.

CREATE UNIQUE INDEX briefings_parlamentar_gerando_unique
  ON briefings (parlamentar_id)
  WHERE status = 'gerando';
