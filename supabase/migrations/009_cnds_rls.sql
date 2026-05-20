-- supabase/migrations/009_cnds_rls.sql
-- Enable RLS on cnds_municipios (was missing from initial setup).
-- Table is currently empty but will be populated by the scraper's atualizar_habilitacao.py.

ALTER TABLE cnds_municipios ENABLE ROW LEVEL SECURITY;

-- Prefeito sees only their own municipality's CNDs; admin sees all
CREATE POLICY cnds_select ON cnds_municipios FOR SELECT
  TO authenticated
  USING (municipio_ibge = _user_municipio() OR _user_tipo() = 'admin');

-- INSERT/UPDATE/DELETE only via service role (scraper)
