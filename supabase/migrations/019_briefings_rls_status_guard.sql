-- supabase/migrations/019_briefings_rls_status_guard.sql
-- Tighten briefings_select RLS: portal users can only read delivered briefings.
-- Mirrors migration 018 which added the same guard to diagnosticos_select.
-- Previously a parlamentar who knew the UUID of a rascunho/gerando briefing could
-- read its full content (texto_ia, municipios_recomendados, pdf_url) via REST API.
-- Admins use the service-role client (bypasses RLS) but the policy also covers
-- the case where an admin calls the API with their authenticated JWT.

DROP POLICY IF EXISTS "briefings_select" ON briefings;

CREATE POLICY "briefings_select" ON briefings FOR SELECT
  TO authenticated
  USING (
    _user_tipo() = 'admin'
    OR (
      parlamentar_id = _user_parlamentar()
      AND status = 'entregue'
    )
  );
