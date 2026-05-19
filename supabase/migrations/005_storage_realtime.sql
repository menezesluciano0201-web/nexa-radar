-- supabase/migrations/005_storage_realtime.sql

-- Habilitar Realtime na tabela diagnosticos
ALTER PUBLICATION supabase_realtime ADD TABLE diagnosticos;
