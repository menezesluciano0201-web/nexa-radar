-- 026_projetos.sql
-- Tabela de projetos aprovávais gerados pelo M3
-- Cria também o bucket Storage 'projetos' (privado, admin-only).

-- Bucket Storage (não DDL puro, mas o helper Supabase MCP não expõe create_bucket)
INSERT INTO storage.buckets (id, name, public)
VALUES ('projetos', 'projetos', false)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE projetos (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnostico_id       uuid REFERENCES diagnosticos(id),
  municipio_ibge       text NOT NULL,
  gerado_por           uuid REFERENCES auth.users(id),
  template             text NOT NULL CHECK (template IN (
                         'scfv','tea','caps','idoso','esporte','saude_basica','educacao')),
  objeto               text,
  justificativa        text,
  num_beneficiarios    integer,
  valor_solicitado     numeric,
  valor_contrapartida  numeric,
  prazo_meses          integer,
  oscip_executora      text,
  capacidade_instalada text,
  campos_extras        jsonb,
  status               text NOT NULL DEFAULT 'gerando'
                         CHECK (status IN ('gerando','rascunho','erro')),
  secoes_ia            jsonb,
  pdf_url              text,
  docx_url             text,
  criado_em            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE projetos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "projetos_admin_all" ON projetos
  FOR ALL TO authenticated
  USING (_user_tipo() = 'admin');

CREATE INDEX ON projetos (municipio_ibge, criado_em DESC);
CREATE INDEX ON projetos (status) WHERE status = 'gerando';

-- Dedup guard: impede geração simultânea do mesmo par (município, template)
CREATE UNIQUE INDEX projetos_municipio_template_gerando_unique
  ON projetos (municipio_ibge, template) WHERE status = 'gerando';

-- Storage RLS para bucket 'projetos'
CREATE POLICY "projetos_storage_admin"
ON storage.objects FOR ALL TO authenticated
USING (
  bucket_id = 'projetos'
  AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND tipo = 'admin')
);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE projetos;
