-- supabase/migrations/006_security_fixes.sql
-- Fix 1: profiles_update — lock municipio_ibge and parlamentar_id
-- A prefeito was able to UPDATE their own municipio_ibge to any value, then bypass
-- diagnosticos_select RLS and read every município's data.

DROP POLICY IF EXISTS profiles_update ON profiles;

CREATE POLICY profiles_update ON profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND tipo             IS NOT DISTINCT FROM (SELECT tipo             FROM public.profiles WHERE id = auth.uid())
    AND municipio_ibge   IS NOT DISTINCT FROM (SELECT municipio_ibge   FROM public.profiles WHERE id = auth.uid())
    AND parlamentar_id   IS NOT DISTINCT FROM (SELECT parlamentar_id   FROM public.profiles WHERE id = auth.uid())
  );

-- Fix 2: make relatorios bucket private
UPDATE storage.buckets SET public = false WHERE id = 'relatorios';

-- Fix 3: storage RLS — authenticated users may only read their own municipality's PDFs
CREATE POLICY "relatorios_select_own"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'relatorios'
  AND (
    -- Admin can read all
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND tipo = 'admin'
    )
    OR
    -- Client can read PDFs for their own municipality's diagnosticos
    EXISTS (
      SELECT 1 FROM public.diagnosticos d
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE name = 'diagnostico-' || d.id::text || '.pdf'
        AND d.municipio_ibge = p.municipio_ibge
    )
  )
);

-- Service role INSERT for uploads (already bypasses RLS, but explicit is clear)
CREATE POLICY "relatorios_insert_service"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'relatorios');
