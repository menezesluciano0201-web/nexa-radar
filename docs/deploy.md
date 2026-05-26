# Deploy — Nexa Radar

Runbook para deploy do Nexa Radar em produção. Cobre EasyPanel + Supabase.

---

## 1. Variáveis de ambiente (produção)

Configure no EasyPanel (App → Environment Variables):

```env
NEXT_PUBLIC_SUPABASE_URL=https://sfzuoqnzdhknmqtprfly.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key do projeto>
SUPABASE_SERVICE_ROLE_KEY=<service role key — NUNCA expor>
ANTHROPIC_API_KEY=<chave Claude>
CLAUDE_MODEL=claude-sonnet-4-6              # opcional, default é claude-sonnet-4-6
NODE_ENV=production
```

> O `SUPABASE_SERVICE_ROLE_KEY` é usado apenas em API routes server-side (admin client). Nunca prefixar com `NEXT_PUBLIC_` — vazaria para o browser.

---

## 2. Supabase — configuração para produção

No painel Supabase → **Authentication → URL Configuration**:

### Site URL
```
https://nexa-radar.2.24.71.118.nip.io
```

### Redirect URLs (allow list)
```
https://nexa-radar.2.24.71.118.nip.io/auth/callback
https://nexa-radar.2.24.71.118.nip.io/**
```

> **Quando comprar domínio próprio** (ex: `nexaradar.com.br`), substituir as 3 URLs acima e atualizar `NEXT_PUBLIC_SITE_URL` no EasyPanel. nip.io é provisório.

Sem isso, o link de "Esqueci minha senha" enviado por email vai redirecionar para `localhost:3000` em vez do domínio de produção, e o reset não funciona.

### Email templates (opcional)
**Authentication → Email Templates → Reset Password**

Personalize o template em português, por exemplo:

```
Olá,

Você solicitou a redefinição de senha no Nexa Radar.
Clique no link abaixo para definir uma nova senha:

{{ .ConfirmationURL }}

Se você não solicitou isso, ignore este e-mail.

— Equipe Nexa Radar
```

---

## 3. Deploy no EasyPanel

### 3.1. Build command
```bash
npm install --legacy-peer-deps && npm run build
```

### 3.2. Start command
```bash
npm start
```

### 3.3. Health check
- Path: `/login`
- Esperado: HTTP 200

### 3.4. Persistência
- **Não precisa volume**: tudo persiste no Supabase (PostgreSQL + Storage).
- **EasyPanel always-on** é obrigatório porque o pipeline `generateProjeto`/`generateBriefing`/`generateDiagnostico` é fire-and-forget (precisa do processo Node vivo após a resposta 202). **NÃO** funciona em Vercel serverless.

---

## 4. Pós-deploy — checklist

- [ ] `https://<dominio>/login` carrega
- [ ] Login com admin funciona
- [ ] `/admin/projeto/novo` renderiza com diagnósticos e templates
- [ ] Geração de projeto completa (até 90s) e PDF/Word baixam
- [ ] "Esqueci minha senha" envia email e o link redireciona para `https://<dominio>/auth/callback` (não localhost)
- [ ] `/api/projeto/<uuid-inexistente>` retorna 404 (não 500)
- [ ] RLS: usuário não-admin recebe 403 ao chamar `/api/projeto`

---

## 5. Migrations Supabase

Migrations são aplicadas via MCP durante desenvolvimento. **Para deploy inicial em outro projeto Supabase**, rode em ordem:

```bash
supabase db push  # se usar Supabase CLI local
```

Ou aplique manualmente via SQL Editor cada arquivo em `supabase/migrations/` em ordem numérica (001 → 026).

A migration 026 cria o bucket `projetos` via `INSERT INTO storage.buckets ...` (idempotente com `ON CONFLICT`).

---

## 6. Monitoramento

### Logs do pipeline async
O pipeline `generateProjeto`/`generateBriefing`/`generateDiagnostico` loga erros via `console.error('[generateX] erro:', err)`. Em EasyPanel: **Logs** tab.

### Realtime
O hook `useGenerationPolling` subscreve `postgres_changes` em `projetos`/`briefings`/`diagnosticos`. Se Realtime estiver desabilitado no projeto Supabase, o fallback de polling de 5s assume.

### Timeouts
- Claude API: 65s (default em `claude.ts`) ou 180s (override em `gerarProjeto`)
- Frontend timeout: 120s (em `useGenerationPolling`)
- Pipeline total esperado: 30–90s

Se 120s não bastar para um template específico (raro), aumente em `src/hooks/useGenerationPolling.ts`.

---

## 7. Rollback

Cada migration tem número sequencial. Para reverter a 026:

```sql
DROP TABLE IF EXISTS projetos CASCADE;
DELETE FROM storage.buckets WHERE id = 'projetos';
```

Mas isso apaga dados — só faça com backup confirmado.

Para rollback de código no EasyPanel: redeploy do commit anterior.

---

## 8. Custos esperados (referência maio/2026)

- Claude Sonnet 4.6 input: ~$3/M tokens, output: ~$15/M tokens
- Projeto SCFV: ~3k input + 4k output = **~$0.07 por geração**
- Diagnóstico: ~2k input + 1.5k output = **~$0.03 por geração**
- Briefing: ~3k input + 2k output = **~$0.04 por geração**

Estimativa: 100 gerações/mês = **~$5 em Claude API**. Plus Supabase Pro ($25/mês) e EasyPanel (~$10/mês). **~$40/mês infra para começar**.
