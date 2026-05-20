-- supabase/migrations/018_diagnosticos_rls_status_guard.sql
-- Tighten diagnosticos_select RLS: portal users (prefeito/senador) can only read
-- delivered diagnosticos. Previously the policy only filtered by municipio_ibge,
-- so a portal user with the UUID of a rascunho/gerando/erro diagnostico could read
-- its full content (texto_ia, programas_criticos, pdf_url) via the Supabase REST API.
-- Admins retain full access to all statuses.

DROP POLICY IF EXISTS "diagnosticos_select" ON diagnosticos;

CREATE POLICY "diagnosticos_select" ON diagnosticos FOR SELECT
  TO authenticated
  USING (
    _user_tipo() = 'admin'
    OR (
      municipio_ibge = _user_municipio()
      AND status IN ('entregue', 'convertido')
    )
  );
