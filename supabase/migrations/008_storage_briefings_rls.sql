-- supabase/migrations/008_storage_briefings_rls.sql
-- Proactive storage RLS for briefings PDFs (created before Plan 2c so the policy
-- is in place when generateBriefing starts uploading `briefing-{uuid}.pdf` files).

CREATE POLICY "relatorios_select_briefings"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'relatorios'
  AND name LIKE 'briefing-%.pdf'
  AND (
    -- Admin can read all briefings
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND tipo = 'admin'
    )
    OR
    -- Parlamentar can read their own briefings
    EXISTS (
      SELECT 1 FROM public.briefings b
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE name = 'briefing-' || b.id::text || '.pdf'
        AND b.parlamentar_id = p.parlamentar_id
    )
  )
);
