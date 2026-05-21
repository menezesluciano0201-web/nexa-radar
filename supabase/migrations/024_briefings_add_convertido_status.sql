-- Alinha o CHECK constraint de briefings.status com StatusBriefing TypeScript (que já inclui 'convertido').
-- Espelha o constraint de diagnosticos que já tinha 'convertido' desde migration 001.
ALTER TABLE briefings DROP CONSTRAINT IF EXISTS briefings_status_check;
ALTER TABLE briefings ADD CONSTRAINT briefings_status_check
  CHECK (status IN ('gerando','rascunho','entregue','convertido','erro'));
