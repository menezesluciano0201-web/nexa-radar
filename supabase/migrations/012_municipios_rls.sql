-- supabase/migrations/012_municipios_rls.sql
-- Enable RLS on municipios_habilitacao.
-- Data is public-domain government seed (IBGE + CAUC), so all authenticated users
-- may read — this makes the permission explicit rather than relying on Supabase's
-- default grants. Anonymous access remains blocked.

ALTER TABLE municipios_habilitacao ENABLE ROW LEVEL SECURITY;

CREATE POLICY municipios_select ON municipios_habilitacao FOR SELECT
  TO authenticated USING (true);

-- INSERT/UPDATE only via service role (scraper atualizar_habilitacao.py)
