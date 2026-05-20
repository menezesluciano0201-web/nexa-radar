-- supabase/migrations/011_storage_rls_name_guard.sql
-- Tighten relatorios_select_own policy: add explicit name LIKE guard so the
-- diagnosticos JOIN is only attempted for files matching the expected pattern,
-- avoiding the full join for every other object name in the bucket.

DROP POLICY IF EXISTS "relatorios_select_own" ON storage.objects;

CREATE POLICY "relatorios_select_own"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'relatorios'
  AND name LIKE 'diagnostico-%.pdf'
  AND (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND tipo = 'admin'
    )
    OR
    EXISTS (
      SELECT 1 FROM public.diagnosticos d
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE name = 'diagnostico-' || d.id::text || '.pdf'
        AND d.municipio_ibge = p.municipio_ibge
    )
  )
);
