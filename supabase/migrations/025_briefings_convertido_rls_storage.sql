-- Atualiza RLS e storage para permitir acesso a briefings com status='convertido'.
-- Espelha migration 018/015 que fez o mesmo para diagnosticos.

-- 1. RLS policy: portal users podem ler briefings entregues ou convertidos
DROP POLICY IF EXISTS "briefings_select" ON briefings;
CREATE POLICY "briefings_select" ON briefings FOR SELECT
  TO authenticated
  USING (
    _user_tipo() = 'admin'
    OR (
      parlamentar_id = _user_parlamentar()
      AND status IN ('entregue', 'convertido')
    )
  );

-- 2. Storage policy: signed URL permitida para entregue ou convertido
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
        AND b.status IN ('entregue', 'convertido')
    )
  )
);
