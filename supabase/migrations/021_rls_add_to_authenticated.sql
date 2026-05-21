-- supabase/migrations/021_rls_add_to_authenticated.sql
-- Add explicit TO authenticated to policies created in migration 002 without a TO clause.
-- Without TO, policies apply to PUBLIC (includes anon role). The USING clauses already
-- evaluate to false/null for anon (auth.uid() returns null), so no data is leaked today.
-- Adding TO authenticated makes the intent explicit and prevents future default-grant changes
-- from accidentally opening these tables to unauthenticated requests.
--
-- Note: diagnosticos_select, briefings_select, publicacoes_select were already replaced
-- by migrations 018, 019, 020 respectively and are not touched here.

-- profiles
DROP POLICY IF EXISTS "profiles_select" ON profiles;
CREATE POLICY profiles_select ON profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR _user_tipo() = 'admin');

-- contratos
DROP POLICY IF EXISTS "contratos_select" ON contratos;
CREATE POLICY contratos_select ON contratos FOR SELECT
  TO authenticated
  USING (profile_id = auth.uid() OR _user_tipo() = 'admin');

-- mapa_politico
DROP POLICY IF EXISTS "mapa_politico_select" ON mapa_politico;
CREATE POLICY mapa_politico_select ON mapa_politico FOR SELECT
  TO authenticated
  USING (parlamentar_id = _user_parlamentar() OR _user_tipo() = 'admin');

-- scores_municipio_parlamentar
DROP POLICY IF EXISTS "scores_select" ON scores_municipio_parlamentar;
CREATE POLICY scores_select ON scores_municipio_parlamentar FOR SELECT
  TO authenticated
  USING (parlamentar_id = _user_parlamentar() OR _user_tipo() = 'admin');

-- publicacoes_portal write policies (admin-only actions)
DROP POLICY IF EXISTS "publicacoes_insert" ON publicacoes_portal;
CREATE POLICY publicacoes_insert ON publicacoes_portal FOR INSERT
  TO authenticated
  WITH CHECK (_user_tipo() = 'admin');

DROP POLICY IF EXISTS "publicacoes_update" ON publicacoes_portal;
CREATE POLICY publicacoes_update ON publicacoes_portal FOR UPDATE
  TO authenticated
  USING (_user_tipo() = 'admin');
