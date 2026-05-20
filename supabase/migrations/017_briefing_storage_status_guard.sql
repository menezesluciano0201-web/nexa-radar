-- supabase/migrations/017_briefing_storage_status_guard.sql
-- Tighten storage RLS for briefing PDFs: only allow signed URL generation for delivered briefings.
-- Mirrors migration 015 which added the same guard for diagnostico PDFs.

DROP POLICY IF EXISTS "relatorios_select_briefings" ON storage.objects;

CREATE POLICY "relatorios_select_briefings"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'relatorios'
  AND name LIKE 'briefing-%.pdf'
  AND (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND tipo = 'admin'
    )
    OR
    EXISTS (
      SELECT 1 FROM public.briefings b
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE name = 'briefing-' || b.id::text || '.pdf'
        AND b.parlamentar_id = p.parlamentar_id
        AND b.status = 'entregue'
    )
  )
);
