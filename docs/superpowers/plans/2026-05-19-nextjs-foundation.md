# Nexa Radar — Plano 2a: Next.js Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Configurar o projeto Next.js completo com autenticação Supabase, tipos TypeScript do domínio, clientes Supabase (browser/server/admin), middleware de proteção de rotas, e layouts base para admin e portal do cliente.

**Architecture:** Next.js 15 App Router com TypeScript strict. Autenticação via Supabase Auth usando `@supabase/ssr` para cookies em server components. Três clientes Supabase: browser (anon key, RLS ativo), server (anon key + cookies do usuário, RLS ativo), admin (service role, RLS bypass para API routes). Middleware protege `/admin` e `/portal`, redirecionando para `/login` se não autenticado.

**Tech Stack:** Next.js 15, TypeScript 5, Tailwind CSS 3, @supabase/supabase-js 2, @supabase/ssr 0.5, @anthropic-ai/sdk 0.30, lucide-react, Node.js 24.

**Este plano produz:** projeto Next.js funcionando com login, redirecionamento por perfil (admin/prefeito/deputado), layout admin com sidebar, layout portal, sem nenhuma feature de produto ainda.

**Planos dependentes:** Plano 2b (Diagnóstico Municipal) e Plano 2c (Briefing + Portal) dependem deste.

---

## Mapa de Arquivos

| Arquivo | Responsabilidade |
|---|---|
| `package.json` | Dependências e scripts |
| `next.config.ts` | Config Next.js (sem edge runtime em rotas de PDF) |
| `tsconfig.json` | TypeScript strict, paths alias `@/` |
| `tailwind.config.ts` | Paleta de cores Nexa Radar |
| `postcss.config.mjs` | PostCSS para Tailwind |
| `src/types/index.ts` | Tipos TypeScript do domínio (Profile, Diagnostico, etc.) |
| `src/lib/supabase/client.ts` | Browser client (anon key, RLS ativo) |
| `src/lib/supabase/server.ts` | Server client (anon key + cookies) |
| `src/lib/supabase/admin.ts` | Admin client (service role, API routes only) |
| `src/lib/claude.ts` | Wrapper Claude API (servidor only) |
| `src/middleware.ts` | Proteção `/admin` e `/portal` → `/login` |
| `src/app/globals.css` | Tailwind base + variáveis CSS |
| `src/app/layout.tsx` | Root layout (html, body, font) |
| `src/app/page.tsx` | Root redirect (/ → /admin ou /portal ou /login) |
| `src/app/login/page.tsx` | Login form (email/senha) |
| `src/app/login/actions.ts` | Server actions: signIn, signOut |
| `src/app/admin/layout.tsx` | Admin shell: sidebar + auth guard |
| `src/app/admin/page.tsx` | Admin home (placeholder) |
| `src/app/portal/layout.tsx` | Portal shell: auth guard para cliente |
| `src/app/portal/page.tsx` | Portal home (placeholder) |

---

## Task 1: Inicializar projeto Next.js

**Files:**
- Create: `package.json`
- Create: `next.config.ts`
- Create: `tsconfig.json`
- Create: `tailwind.config.ts`
- Create: `postcss.config.mjs`

- [ ] **Step 1: Criar `package.json`**

```json
{
  "name": "nexa-radar",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "15.3.2",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@supabase/supabase-js": "^2.49.8",
    "@supabase/ssr": "^0.5.2",
    "@anthropic-ai/sdk": "^0.30.0",
    "@react-pdf/renderer": "^4.3.0",
    "lucide-react": "^0.511.0",
    "recharts": "^2.15.3",
    "clsx": "^2.1.1"
  },
  "devDependencies": {
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "eslint": "^9",
    "eslint-config-next": "15.3.2",
    "postcss": "^8",
    "tailwindcss": "^3.4.17",
    "typescript": "^5"
  }
}
```

- [ ] **Step 2: Criar `next.config.ts`**

```typescript
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // @react-pdf/renderer requires Node.js runtime — never use Edge runtime for PDF routes
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
}

export default nextConfig
```

- [ ] **Step 3: Criar `tsconfig.json`**

```json
{
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules", "scraper"]
}
```

- [ ] **Step 4: Criar `tailwind.config.ts`**

```typescript
import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        nexa: {
          50:  '#f0f9ff',
          100: '#e0f2fe',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          900: '#0c4a6e',
        },
        risk: {
          low:  '#22c55e',
          mid:  '#f59e0b',
          high: '#ef4444',
        },
      },
    },
  },
  plugins: [],
}

export default config
```

- [ ] **Step 5: Criar `postcss.config.mjs`**

```javascript
const config = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}

export default config
```

- [ ] **Step 6: Instalar dependências**

```bash
cd /Users/lucianomenezes/Nexanegocios
npm install
```

Esperado: `node_modules/` criado, sem erros.

- [ ] **Step 7: Criar diretórios do projeto**

```bash
mkdir -p src/types src/lib/supabase src/components/ui \
  src/app/login src/app/admin src/app/portal
```

- [ ] **Step 8: Commit**

```bash
git add package.json next.config.ts tsconfig.json tailwind.config.ts postcss.config.mjs
git commit -m "feat: initialize Next.js 15 project with TypeScript and Tailwind"
```

---

## Task 2: Tipos TypeScript do domínio

**Files:**
- Create: `src/types/index.ts`

- [ ] **Step 1: Escrever `src/types/index.ts`**

```typescript
// src/types/index.ts
// Domain types matching the Supabase schema in supabase/migrations/001_init_schema.sql

export type UserTipo = 'admin' | 'prefeito' | 'deputado' | 'senador' | 'oscip'

export interface Profile {
  id: string
  tipo: UserTipo
  nome: string
  municipio_ibge: string | null
  parlamentar_id: string | null
  created_at: string
}

export type TipoProduto =
  | 'diagnostico'
  | 'monitoramento_prefeito'
  | 'monitoramento_parlamentar'
  | 'prestacao_contas'
  | 'licenca_plataforma'

export type StatusContrato = 'ativo' | 'suspenso' | 'encerrado'

export interface Contrato {
  id: string
  profile_id: string
  tipo_produto: TipoProduto
  status: StatusContrato
  valor_mensal: number | null
  data_inicio: string
  data_fim: string | null
  criado_em: string
}

export interface MunicipioHabilitacao {
  ibge: string
  nome: string
  uf: string
  populacao: number | null
  idh: number | null
  cauc_regular: boolean
  ultima_verificacao: string | null
  programas_habilitados: string[]
  programas_bloqueados: string[]
}

export interface TransferenciaFederal {
  id: string
  municipio_ibge: string
  programa: string
  fundo: string
  valor_empenhado: number
  valor_liquidado: number
  valor_pago: number
  percentual_execucao: number
  competencia: string | null
  prazo_limite: string | null
  fonte: string
  coletado_em: string
}

export interface EmendaParlamentar {
  id: string
  parlamentar_id: string
  parlamentar_nome: string | null
  tipo: 'RP6' | 'RP7' | 'RP8' | 'PIX'
  parlamentar_tipo: 'individual' | 'bancada' | 'comissao'
  municipio_ibge: string | null
  area_tematica: string | null
  valor_autorizado: number
  valor_empenhado: number
  valor_executado: number
  percentual_execucao: number
  prazo_limite: string | null
  status_cauc: boolean | null
  exercicio: number
  fonte: string
  coletado_em: string
}

export type StatusDiagnostico = 'gerando' | 'rascunho' | 'entregue' | 'convertido' | 'erro'

export interface ProgramaCritico {
  programa: string
  fundo: string
  valor_empenhado: number
  valor_pago: number
  percentual_execucao: number
  prazo_limite: string | null
}

export interface Diagnostico {
  id: string
  municipio_ibge: string
  gerado_por: string
  valor_total_identificado: number
  valor_em_risco: number
  programas_criticos: ProgramaCritico[]
  acoes_recomendadas: string[]
  texto_ia: string | null
  pdf_url: string | null
  status: StatusDiagnostico
  criado_em: string
}

export type StatusBriefing = 'gerando' | 'rascunho' | 'entregue' | 'erro'

export interface MunicipioRecomendado {
  ibge: string
  nome: string
  score_total: number
  justificativa: string
}

export interface Briefing {
  id: string
  parlamentar_id: string
  gerado_por: string
  valor_total_emendas: number
  valor_em_risco: number
  municipios_recomendados: MunicipioRecomendado[]
  texto_ia: string | null
  pdf_url: string | null
  status: StatusBriefing
  criado_em: string
}

export type RelacaoPolitica = 'aliado_forte' | 'aliado' | 'neutro' | 'oposicao'
export type OrigemMapa = 'manual' | 'inferido'

export interface MapaPolitico {
  id: string
  parlamentar_id: string
  municipio_ibge: string
  relacao: RelacaoPolitica
  liderancas_locais: string | null
  notas: string | null
  origem: OrigemMapa
  confianca_inferencia: number | null
  confirmado_pelo_assessor: boolean
  criado_por: string
  atualizado_em: string
}

export interface ScoreMunicipio {
  id: string
  parlamentar_id: string
  municipio_ibge: string
  score_total: number | null
  score_politico: number | null
  score_saude_alocacao: number | null
  score_capacidade: number | null
  score_impacto_visual: number | null
  score_idh: number | null
  calculado_em: string
}
```

- [ ] **Step 2: Verificar compilação TypeScript**

```bash
cd /Users/lucianomenezes/Nexanegocios
npx tsc --noEmit --skipLibCheck 2>&1 | head -20
```

Esperado: sem erros de compilação nos tipos.

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add TypeScript domain types matching Supabase schema"
```

---

## Task 3: Clientes Supabase (browser, server, admin)

**Files:**
- Create: `src/lib/supabase/client.ts`
- Create: `src/lib/supabase/server.ts`
- Create: `src/lib/supabase/admin.ts`

**Context:** `@supabase/ssr` provides `createBrowserClient` (for client components) and `createServerClient` (for server components/routes, requires cookie handling). The admin client uses the service role key and bypasses RLS — only use in API Routes, never in components.

- [ ] **Step 1: Criar `src/lib/supabase/client.ts`**

```typescript
// src/lib/supabase/client.ts
// Browser client — used in Client Components ('use client')
// Uses anon key. RLS is active — user sees only their own data.
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 2: Criar `src/lib/supabase/server.ts`**

```typescript
// src/lib/supabase/server.ts
// Server client — used in Server Components, Route Handlers, Server Actions
// Uses anon key + user cookies. RLS is active.
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // setAll called from a Server Component — ignored (middleware handles refresh)
          }
        },
      },
    }
  )
}
```

- [ ] **Step 3: Criar `src/lib/supabase/admin.ts`**

```typescript
// src/lib/supabase/admin.ts
// Admin client — uses service role key, bypasses RLS.
// ONLY use in API Routes (route.ts). NEVER import in components or pages.
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/supabase/
git commit -m "feat: add Supabase browser, server, and admin clients"
```

---

## Task 4: Wrapper Claude API

**Files:**
- Create: `src/lib/claude.ts`

- [ ] **Step 1: Criar `src/lib/claude.ts`**

```typescript
// src/lib/claude.ts
// Claude API wrapper — server-side only, never import in client components.
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

const MODEL = 'claude-sonnet-4-20250514'
const MAX_TOKENS = 4096

export async function gerarTexto(prompt: string): Promise<string> {
  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    messages: [{ role: 'user', content: prompt }],
  })

  const block = message.content[0]
  if (block.type !== 'text') {
    throw new Error(`Unexpected Claude response type: ${block.type}`)
  }
  return block.text
}

export async function gerarDiagnostico(dados: {
  municipio: string
  uf: string
  programasCriticos: Array<{
    programa: string
    fundo: string
    valor_empenhado: number
    valor_pago: number
    percentual_execucao: number
    prazo_limite: string | null
  }>
  valorTotalEmRisco: number
}): Promise<string> {
  const programasFormatados = dados.programasCriticos
    .map(
      (p) =>
        `- ${p.programa} (${p.fundo}): ${p.percentual_execucao.toFixed(1)}% executado` +
        `, R$ ${(p.valor_empenhado - p.valor_pago).toLocaleString('pt-BR')} parado` +
        (p.prazo_limite ? `, prazo: ${p.prazo_limite}` : '')
    )
    .join('\n')

  const prompt = `Você é um especialista em gestão de recursos públicos municipais no Brasil.
Analise os dados de subexecução abaixo e gere um diagnóstico executivo para o gestor municipal.

MUNICÍPIO: ${dados.municipio} - ${dados.uf}
VALOR TOTAL EM RISCO: R$ ${dados.valorTotalEmRisco.toLocaleString('pt-BR')}

PROGRAMAS COM SUBEXECUÇÃO:
${programasFormatados}

Gere um diagnóstico em 4 blocos com linguagem direta, objetiva e politicamente inteligente:

1. SITUAÇÃO ATUAL (2-3 frases resumindo o cenário com os números reais)
2. O QUE ESTÁ EM RISCO (prazo, valor, impacto político — seja específico)
3. OPORTUNIDADE IDENTIFICADA (o que pode ser feito nos próximos 30-60 dias)
4. PRÓXIMO PASSO (ação específica e urgente — uma frase)

IMPORTANTE:
- Use os valores reais em reais
- Seja direto — fale como consultor experiente, não como burocracia
- O gestor tem pouco tempo — cada bloco máximo 3 frases
- Não use jargão técnico desnecessário
- DISCLAIMER ao final: "Este diagnóstico foi gerado por inteligência artificial e deve ser revisado por especialista antes de qualquer decisão."
`

  return gerarTexto(prompt)
}

export async function gerarBriefingParlamentar(dados: {
  parlamentarNome: string
  totalEmendas: number
  valorEmRisco: number
  percentualExecutado: number
  emendaVencendoMaisUrgente: { municipio: string; prazo: string; valor: number } | null
  top5Municipios: Array<{ nome: string; score: number; justificativa: string }>
}): Promise<string> {
  const urgente = dados.emendaVencendoMaisUrgente
    ? `\nEMENDA MAIS URGENTE: ${dados.emendaVencendoMaisUrgente.municipio} — R$ ${dados.emendaVencendoMaisUrgente.valor.toLocaleString('pt-BR')}, prazo ${dados.emendaVencendoMaisUrgente.prazo}`
    : ''

  const top5 = dados.top5Municipios
    .map((m, i) => `${i + 1}. ${m.nome} (score ${m.score}/100) — ${m.justificativa}`)
    .join('\n')

  const prompt = `Você é um especialista em emendas parlamentares e política municipal no Brasil.
Gere um briefing político para o(a) parlamentar abaixo.

PARLAMENTAR: ${dados.parlamentarNome}
TOTAL DE EMENDAS INDIVIDUAIS: R$ ${dados.totalEmendas.toLocaleString('pt-BR')}
PERCENTUAL EXECUTADO: ${dados.percentualExecutado.toFixed(1)}%
VALOR EM RISCO DE DEVOLUÇÃO: R$ ${dados.valorEmRisco.toLocaleString('pt-BR')}${urgente}

TOP 5 MUNICÍPIOS RECOMENDADOS PARA DIRECIONAMENTO:
${top5}

Gere um briefing com 3 seções:

1. SITUAÇÃO DAS EMENDAS (estado atual, risco eleitoral, comparativo com pares)
2. MUNICÍPIOS PRIORITÁRIOS (argumento político para cada um do top 5)
3. AÇÕES PRÓXIMAS 30/60/90 DIAS (cronograma de ações específicas)

Tom: direto, orientado a resultado político, linguagem de assessoria parlamentar experiente.
Máximo 400 palavras no total.
DISCLAIMER ao final: "Gerado por inteligência artificial — revisar com equipe antes de usar."
`

  return gerarTexto(prompt)
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/claude.ts
git commit -m "feat: add Claude API wrapper with diagnostico and briefing generators"
```

---

## Task 5: Variáveis de ambiente

**Files:**
- Create: `.env.local` (não commitado — instrução para o dev)

- [ ] **Step 1: Criar `.env.local` com as credenciais do projeto**

```bash
cat > .env.local << 'EOF'
# Supabase (projeto sfzuoqnzdhknmqtprfly)
NEXT_PUBLIC_SUPABASE_URL=https://sfzuoqnzdhknmqtprfly.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNmenVvcW56ZGhrbm1xdHByZmx5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5NjYxNDcsImV4cCI6MjA5MzU0MjE0N30.HZNXMhFDXVXp0Sfi61hS4vWWs2mopmvCpVBPF6-zH0M
SUPABASE_SERVICE_ROLE_KEY=sb_secret_ctWRkl1DE2ztz1fxjAF1Ug_SNY-JTfh

# Claude API — obter em console.anthropic.com
ANTHROPIC_API_KEY=sk-ant-SEU_KEY_AQUI
EOF
```

- [ ] **Step 2: Verificar que `.env.local` está no `.gitignore`**

```bash
grep ".env.local" .gitignore
```

Esperado: `.env.local` aparece na saída.

- [ ] **Step 3: Verificar que `.env.local` NÃO está staged**

```bash
git status | grep ".env.local"
```

Esperado: nenhuma saída (arquivo ignorado pelo git).

---

## Task 6: Middleware de proteção de rotas

**Files:**
- Create: `src/middleware.ts`

- [ ] **Step 1: Criar `src/middleware.ts`**

```typescript
// src/middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session — required for Server Components to read auth state
  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Public routes — no auth required
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/municipio') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon')
  ) {
    return supabaseResponse
  }

  // Protected routes — redirect to login if not authenticated
  if (!user) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Admin routes — only 'admin' tipo allowed
  if (pathname.startsWith('/admin')) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('tipo')
      .eq('id', user.id)
      .single()

    if (!profile || profile.tipo !== 'admin') {
      const portalUrl = request.nextUrl.clone()
      portalUrl.pathname = '/portal'
      return NextResponse.redirect(portalUrl)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

- [ ] **Step 2: Commit**

```bash
git add src/middleware.ts
git commit -m "feat: add middleware for route protection (/admin requires admin tipo)"
```

---

## Task 7: Root layout, globals.css e root page

**Files:**
- Create: `src/app/globals.css`
- Create: `src/app/layout.tsx`
- Create: `src/app/page.tsx`

- [ ] **Step 1: Criar `src/app/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --background: #0f172a;
  --foreground: #f1f5f9;
}

body {
  background-color: var(--background);
  color: var(--foreground);
}
```

- [ ] **Step 2: Criar `src/app/layout.tsx`**

```typescript
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Nexa Radar',
  description: 'Inteligência de subexecução de recursos públicos',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
```

- [ ] **Step 3: Criar `src/app/page.tsx`**

```typescript
// src/app/page.tsx
// Root redirect — sends authenticated users to the correct dashboard
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function RootPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('tipo')
    .eq('id', user.id)
    .single()

  if (profile?.tipo === 'admin') {
    redirect('/admin')
  }

  redirect('/portal')
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.css src/app/layout.tsx src/app/page.tsx
git commit -m "feat: add root layout, global styles, and root redirect page"
```

---

## Task 8: Login page com server action

**Files:**
- Create: `src/app/login/actions.ts`
- Create: `src/app/login/page.tsx`

- [ ] **Step 1: Criar `src/app/login/actions.ts`**

```typescript
// src/app/login/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function signIn(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    redirect('/login?error=Credenciais inválidas')
  }

  revalidatePath('/', 'layout')
  redirect('/')
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}
```

- [ ] **Step 2: Criar `src/app/login/page.tsx`**

```typescript
// src/app/login/page.tsx
import { signIn } from './actions'

interface LoginPageProps {
  searchParams: Promise<{ error?: string; next?: string }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams
  const errorMsg = params.error

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900">
      <div className="w-full max-w-sm space-y-8 px-4">
        {/* Logo */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-nexa-500">Nexa Radar</h1>
          <p className="mt-2 text-sm text-slate-400">
            Inteligência de recursos públicos
          </p>
        </div>

        {/* Error message */}
        {errorMsg && (
          <div className="rounded-md bg-red-900/50 border border-red-700 px-4 py-3 text-sm text-red-300">
            {decodeURIComponent(errorMsg)}
          </div>
        )}

        {/* Login form */}
        <form action={signIn} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-slate-300 mb-1"
            >
              E-mail
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-nexa-500 focus:outline-none focus:ring-1 focus:ring-nexa-500"
              placeholder="seu@email.com"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-slate-300 mb-1"
            >
              Senha
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-nexa-500 focus:outline-none focus:ring-1 focus:ring-nexa-500"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-md bg-nexa-600 px-4 py-2 text-sm font-semibold text-white hover:bg-nexa-700 focus:outline-none focus:ring-2 focus:ring-nexa-500 focus:ring-offset-2 focus:ring-offset-slate-900 transition-colors"
          >
            Entrar
          </button>
        </form>

        <p className="text-center text-xs text-slate-500">
          Acesso restrito à equipe Nexa Radar e clientes autorizados
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/login/
git commit -m "feat: add login page with email/password server action"
```

---

## Task 9: Admin layout com sidebar

**Files:**
- Create: `src/app/admin/layout.tsx`
- Create: `src/app/admin/page.tsx`

- [ ] **Step 1: Criar `src/app/admin/layout.tsx`**

```typescript
// src/app/admin/layout.tsx
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { signOut } from '@/app/login/actions'
import {
  LayoutDashboard,
  Users,
  MapPin,
  FileText,
  Users2,
  Activity,
  Bell,
  LogOut,
} from 'lucide-react'

const NAV_ITEMS = [
  { href: '/admin', label: 'Visão Geral', icon: LayoutDashboard },
  { href: '/admin/clientes', label: 'Clientes', icon: Users },
  { href: '/admin/municipios', label: 'Municípios', icon: MapPin },
  { href: '/admin/diagnostico/novo', label: 'Novo Diagnóstico', icon: FileText },
  { href: '/admin/parlamentar', label: 'Parlamentares', icon: Users2 },
  { href: '/admin/coleta', label: 'Coleta de Dados', icon: Activity },
  { href: '/admin/alertas', label: 'Alertas', icon: Bell },
]

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('nome, tipo')
    .eq('id', user.id)
    .single()

  if (!profile || profile.tipo !== 'admin') redirect('/portal')

  return (
    <div className="flex h-screen bg-slate-900">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 border-r border-slate-800 flex flex-col">
        {/* Logo */}
        <div className="px-6 py-5 border-b border-slate-800">
          <span className="text-xl font-bold text-nexa-500">Nexa Radar</span>
          <p className="text-xs text-slate-500 mt-0.5">Painel Admin</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {label}
            </Link>
          ))}
        </nav>

        {/* User + signout */}
        <div className="px-3 py-4 border-t border-slate-800">
          <div className="px-3 py-2 text-xs text-slate-500 truncate">
            {profile.nome}
          </div>
          <form action={signOut}>
            <button
              type="submit"
              className="flex w-full items-center gap-3 px-3 py-2 rounded-md text-sm text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </button>
          </form>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-8">{children}</div>
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Criar `src/app/admin/page.tsx`**

```typescript
// src/app/admin/page.tsx
export default function AdminHomePage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-100 mb-2">Visão Geral</h1>
      <p className="text-slate-400 text-sm">
        Dashboard admin — módulos serão adicionados no Plano 2b e 2c.
      </p>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/
git commit -m "feat: add admin layout with sidebar navigation and auth guard"
```

---

## Task 10: Portal do cliente layout

**Files:**
- Create: `src/app/portal/layout.tsx`
- Create: `src/app/portal/page.tsx`

- [ ] **Step 1: Criar `src/app/portal/layout.tsx`**

```typescript
// src/app/portal/layout.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { signOut } from '@/app/login/actions'
import { LogOut, Home, FileText, Bell, TrendingDown } from 'lucide-react'
import Link from 'next/link'
import type { UserTipo } from '@/types'

function getNavItems(tipo: UserTipo) {
  const base = [
    { href: '/portal', label: 'Início', icon: Home },
    { href: '/portal/alertas', label: 'Alertas', icon: Bell },
  ]
  if (tipo === 'prefeito' || tipo === 'senador') {
    base.push({ href: '/portal/diagnostico', label: 'Diagnóstico', icon: FileText })
  }
  if (tipo === 'deputado' || tipo === 'senador') {
    base.push({ href: '/portal/emendas', label: 'Emendas', icon: TrendingDown })
  }
  return base
}

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('nome, tipo')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')
  if (profile.tipo === 'admin') redirect('/admin')

  const navItems = getNavItems(profile.tipo as UserTipo)

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Top bar */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <span className="font-bold text-nexa-500">Nexa Radar</span>
            <nav className="flex items-center gap-1">
              {navItems.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500 truncate max-w-[140px]">
              {profile.nome}
            </span>
            <form action={signOut}>
              <button
                type="submit"
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-100 transition-colors"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sair
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
    </div>
  )
}
```

- [ ] **Step 2: Criar `src/app/portal/page.tsx`**

```typescript
// src/app/portal/page.tsx
import { createClient } from '@/lib/supabase/server'

export default async function PortalHomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('nome, tipo, municipio_ibge, parlamentar_id')
    .eq('id', user!.id)
    .single()

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-100 mb-2">
        Olá, {profile?.nome}
      </h1>
      <p className="text-slate-400 text-sm">
        Seu portal está sendo configurado. As funcionalidades serão adicionadas em breve.
      </p>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/portal/
git commit -m "feat: add client portal layout with profile-based navigation"
```

---

## Task 11: Criar usuário admin inicial no Supabase

O sistema depende de um usuário admin existente. Este passo cria o primeiro via SQL no Supabase.

- [ ] **Step 1: Criar usuário admin via Supabase Dashboard**

No painel Supabase → Authentication → Users → Add user:
- Email: `admin@nexaradar.com.br`
- Password: (senha forte de sua escolha)
- Auto Confirm: ON

Copiar o UUID gerado (aparece na lista de usuários após criar).

- [ ] **Step 2: Inserir profile admin via SQL Editor**

No painel Supabase → SQL Editor, executar (substituindo `SEU-UUID` pelo UUID do passo anterior):

```sql
INSERT INTO profiles (id, tipo, nome, municipio_ibge, parlamentar_id)
VALUES (
  'SEU-UUID-DO-PASSO-1',
  'admin',
  'Nexa Radar Admin',
  NULL,
  NULL
);
```

- [ ] **Step 3: Verificar acesso**

```bash
npm run dev
```

Abrir `http://localhost:3000/login` e fazer login com as credenciais criadas.

Esperado: redirecionamento para `/admin` com sidebar visível.

---

## Task 12: Build e verificação final

- [ ] **Step 1: Verificar tipos TypeScript**

```bash
cd /Users/lucianomenezes/Nexanegocios
npx tsc --noEmit 2>&1
```

Esperado: 0 erros.

- [ ] **Step 2: Build de produção**

```bash
npm run build 2>&1 | tail -20
```

Esperado: `Route (app)` table sem erros de build.

- [ ] **Step 3: Testar fluxo completo**

```bash
npm run dev
```

Verificar manualmente:
1. `http://localhost:3000` → redireciona para `/login`
2. Login com admin → vai para `/admin` com sidebar
3. Clicar "Sair" → volta para `/login`
4. Tentar acessar `/admin` sem login → redireciona para `/login`

- [ ] **Step 4: Commit final**

```bash
git add -A
git status  # verificar que .env.local NÃO aparece
git commit -m "feat: complete Next.js foundation — auth, layouts, types, Supabase clients"
```

---

## Validação Final do Plano 2a

Ao completar todas as tasks, verificar:

- [ ] `npm run build` sem erros TypeScript
- [ ] Login funciona com email/senha
- [ ] `/` redireciona para `/admin` (admin) ou `/portal` (cliente)
- [ ] `/admin` sem login → redireciona para `/login`
- [ ] `/portal` sem login → redireciona para `/login`
- [ ] Sidebar admin com todos os 7 links
- [ ] Portal mostra nav adaptado ao tipo do usuário
- [ ] `.env.local` não está no git

**Próximo:** Plano 2b — Diagnóstico Municipal (API routes, Claude AI, PDF, Realtime).
