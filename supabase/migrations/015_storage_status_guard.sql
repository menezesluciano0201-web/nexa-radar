-- supabase/migrations/015_storage_status_guard.sql
-- Tighten storage RLS: only allow signed URL generation for delivered diagnosticos.
-- Previously the policy allowed any municipio-scoped diagnostico regardless of status,
-- meaning a rascunho PDF could be accessed by a portal user who knew the UUID.

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
        AND d.status IN ('entregue', 'convertido')
    )
  )
);
