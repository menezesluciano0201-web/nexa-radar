-- supabase/migrations/020_publicacoes_portal_rls_explicit.sql
-- Make publicacoes_portal SELECT policy explicit about roles.
-- Migration 002 created it without a TO clause (defaulting to PUBLIC = anon + authenticated).
-- The intent is public read ("Leitura pública irrestrita") — portais embed this content.
-- Adding TO anon, authenticated makes the design decision visible during security audits.

DROP POLICY IF EXISTS publicacoes_select ON publicacoes_portal;

CREATE POLICY publicacoes_select ON publicacoes_portal FOR SELECT
  TO anon, authenticated
  USING (true);
