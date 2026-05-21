-- supabase/migrations/022_publicacoes_delete_to_authenticated.sql
-- Migration 021 added TO authenticated to publicacoes_insert and publicacoes_update
-- but missed publicacoes_delete which was created in migration 002 without a TO clause.
-- Recreate with TO authenticated to match the companion write policies.

DROP POLICY IF EXISTS "publicacoes_delete" ON publicacoes_portal;

CREATE POLICY publicacoes_delete ON publicacoes_portal FOR DELETE
  TO authenticated
  USING (_user_tipo() = 'admin');
