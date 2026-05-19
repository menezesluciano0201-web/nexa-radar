-- supabase/migrations/002_rls_policies.sql

-- ─── HABILITAR RLS ───────────────────────────────────────────────────────────
ALTER TABLE profiles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE contratos             ENABLE ROW LEVEL SECURITY;
ALTER TABLE diagnosticos          ENABLE ROW LEVEL SECURITY;
ALTER TABLE briefings             ENABLE ROW LEVEL SECURITY;
ALTER TABLE mapa_politico         ENABLE ROW LEVEL SECURITY;
ALTER TABLE publicacoes_portal    ENABLE ROW LEVEL SECURITY;
ALTER TABLE scores_municipio_parlamentar ENABLE ROW LEVEL SECURITY;

-- transferencias_federais e emendas_parlamentares: sem acesso direto pelo cliente
-- Leitura apenas via API Route com service role — RLS não é habilitado nessas tabelas
-- para evitar exposição acidental de dados brutos no frontend.

-- ─── FUNÇÕES HELPER ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION _user_tipo()
RETURNS text LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT tipo FROM profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION _user_municipio()
RETURNS text LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT municipio_ibge FROM profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION _user_parlamentar()
RETURNS text LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT parlamentar_id FROM profiles WHERE id = auth.uid()
$$;

-- ─── PROFILES ────────────────────────────────────────────────────────────────
CREATE POLICY profiles_select ON profiles FOR SELECT
  USING (id = auth.uid() OR _user_tipo() = 'admin');

CREATE POLICY profiles_update ON profiles FOR UPDATE
  USING (id = auth.uid());

-- ─── CONTRATOS ───────────────────────────────────────────────────────────────
-- Cliente vê apenas o próprio contrato; admin vê todos
CREATE POLICY contratos_select ON contratos FOR SELECT
  USING (profile_id = auth.uid() OR _user_tipo() = 'admin');

-- INSERT/UPDATE/DELETE apenas via service role (API Routes)

-- ─── DIAGNÓSTICOS ────────────────────────────────────────────────────────────
-- Prefeito vê apenas o diagnóstico do próprio município
CREATE POLICY diagnosticos_select ON diagnosticos FOR SELECT
  USING (municipio_ibge = _user_municipio() OR _user_tipo() = 'admin');

-- INSERT/UPDATE/DELETE apenas via service role (API Routes)

-- ─── BRIEFINGS ───────────────────────────────────────────────────────────────
-- Deputado vê apenas os próprios briefings
CREATE POLICY briefings_select ON briefings FOR SELECT
  USING (parlamentar_id = _user_parlamentar() OR _user_tipo() = 'admin');

-- INSERT/UPDATE/DELETE apenas via service role (API Routes)

-- ─── MAPA POLÍTICO ───────────────────────────────────────────────────────────
-- Deputado vê apenas o próprio mapa; admin vê tudo
CREATE POLICY mapa_politico_select ON mapa_politico FOR SELECT
  USING (parlamentar_id = _user_parlamentar() OR _user_tipo() = 'admin');

-- INSERT/UPDATE via service role apenas

-- ─── SCORES ──────────────────────────────────────────────────────────────────
CREATE POLICY scores_select ON scores_municipio_parlamentar FOR SELECT
  USING (parlamentar_id = _user_parlamentar() OR _user_tipo() = 'admin');

-- ─── PUBLICAÇÕES PORTAL ──────────────────────────────────────────────────────
-- Leitura pública irrestrita
CREATE POLICY publicacoes_select ON publicacoes_portal FOR SELECT
  USING (true);

-- Apenas admin pode criar/editar/deletar publicações
CREATE POLICY publicacoes_insert ON publicacoes_portal FOR INSERT
  WITH CHECK (_user_tipo() = 'admin');

CREATE POLICY publicacoes_update ON publicacoes_portal FOR UPDATE
  USING (_user_tipo() = 'admin');

CREATE POLICY publicacoes_delete ON publicacoes_portal FOR DELETE
  USING (_user_tipo() = 'admin');
