-- supabase/migrations/007_drop_permissive_storage_insert.sql
-- Drop the overly permissive storage INSERT policy.
-- The service role (admin client) bypasses RLS for uploads, so no policy is needed.
-- Authenticated portal users (prefeito/oscip) must NOT be able to upload to this bucket.

DROP POLICY IF EXISTS "relatorios_insert_service" ON storage.objects;
