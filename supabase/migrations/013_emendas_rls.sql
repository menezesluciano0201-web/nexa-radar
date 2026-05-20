-- supabase/migrations/013_emendas_rls.sql
-- Allow authenticated users to SELECT their own emendas.
-- emendas_parlamentares was RLS-enabled with no policies (migration 010).
-- Admin reads all; parlamentar reads own.

CREATE POLICY emendas_select ON emendas_parlamentares FOR SELECT
  TO authenticated
  USING (parlamentar_id = _user_parlamentar() OR _user_tipo() = 'admin');
