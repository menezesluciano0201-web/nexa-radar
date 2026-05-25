-- 027_portal_transparencia.sql
-- M7 — Portal de Transparência Municipal
-- Adiciona: slug em municipios_habilitacao, expande publicacoes_portal,
--          cria municipios_branding + municipios_kpi_portal,
--          bucket portal-fotos público + RLS.

-- ════════════════════════════════════════════════════════════════
-- BUCKET STORAGE
-- ════════════════════════════════════════════════════════════════

INSERT INTO storage.buckets (id, name, public)
VALUES ('portal-fotos', 'portal-fotos', true)
ON CONFLICT (id) DO NOTHING;

-- Admin pode escrever no bucket. Leitura é pública (bucket público).
CREATE POLICY "portal_fotos_admin_write" ON storage.objects FOR ALL TO authenticated
USING (
  bucket_id = 'portal-fotos'
  AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND tipo = 'admin')
);

-- ════════════════════════════════════════════════════════════════
-- SLUG em municipios_habilitacao
-- Ordem importa: backfill + resolução de colisões ANTES do UNIQUE INDEX
-- e SET NOT NULL, senão a migration quebra em municípios homônimos.
-- ════════════════════════════════════════════════════════════════

ALTER TABLE municipios_habilitacao ADD COLUMN slug text;

-- Backfill: slugify(unaccent(lower(nome)))
UPDATE municipios_habilitacao
  SET slug = NULLIF(trim(both '-' from regexp_replace(
    translate(lower(nome),
      'áàâãäéèêëíìîïóòôõöúùûüçñ',
      'aaaaaeeeeiiiiooooouuuucn'),
    '[^a-z0-9]+', '-', 'g'
  )), '');

-- Fallback para nomes que sanitizam vazio (LC 14/1973 garante nomes alfabéticos,
-- então isso só dispara em data bug — preserva linha sem quebrar).
UPDATE municipios_habilitacao SET slug = ibge WHERE slug IS NULL;

-- Resolver colisões (mesmo UF + slugs iguais) com sufixo -2, -3, etc.
WITH ranked AS (
  SELECT ibge, slug, uf,
    ROW_NUMBER() OVER (PARTITION BY uf, slug ORDER BY ibge) AS rn
  FROM municipios_habilitacao
)
UPDATE municipios_habilitacao m
  SET slug = m.slug || '-' || ranked.rn
FROM ranked
WHERE m.ibge = ranked.ibge AND ranked.rn > 1;

CREATE UNIQUE INDEX municipios_habilitacao_uf_slug_unique
  ON municipios_habilitacao (uf, slug);

ALTER TABLE municipios_habilitacao ALTER COLUMN slug SET NOT NULL;

-- ════════════════════════════════════════════════════════════════
-- EXPANSÃO de publicacoes_portal
-- ════════════════════════════════════════════════════════════════

ALTER TABLE publicacoes_portal
  ADD COLUMN descricao text,
  ADD COLUMN valor_destaque text,
  ADD COLUMN fotos jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN lat numeric,
  ADD COLUMN lng numeric,
  ADD COLUMN data_evento date;

-- SELECT público (anônimos veem apenas ativo=true).
-- Policy existente para 'authenticated' continua válida.
CREATE POLICY publicacoes_select_public ON publicacoes_portal FOR SELECT TO anon
  USING (ativo = true);

-- ════════════════════════════════════════════════════════════════
-- TABELA municipios_branding
-- ════════════════════════════════════════════════════════════════

CREATE TABLE municipios_branding (
  municipio_ibge   text PRIMARY KEY REFERENCES municipios_habilitacao(ibge),
  logo_url         text,
  brasao_url       text,
  cor_primaria     text DEFAULT '#0284c7',  -- nexa-600
  prefeito_nome    text,
  prefeito_gestao  text,
  atualizado_em    timestamptz NOT NULL DEFAULT now(),
  atualizado_por   uuid REFERENCES auth.users(id)
);

ALTER TABLE municipios_branding ENABLE ROW LEVEL SECURITY;

CREATE POLICY branding_select_public ON municipios_branding FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY branding_admin_all ON municipios_branding FOR ALL TO authenticated
  USING (_user_tipo() = 'admin');

-- ════════════════════════════════════════════════════════════════
-- TABELA municipios_kpi_portal
-- ════════════════════════════════════════════════════════════════

CREATE TABLE municipios_kpi_portal (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  municipio_ibge  text NOT NULL REFERENCES municipios_habilitacao(ibge),
  ordem           int NOT NULL CHECK (ordem BETWEEN 1 AND 4),
  label           text NOT NULL,
  valor           text NOT NULL,
  sufixo          text,
  UNIQUE (municipio_ibge, ordem)
);

ALTER TABLE municipios_kpi_portal ENABLE ROW LEVEL SECURITY;

CREATE POLICY kpi_select_public ON municipios_kpi_portal FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY kpi_admin_all ON municipios_kpi_portal FOR ALL TO authenticated
  USING (_user_tipo() = 'admin');
