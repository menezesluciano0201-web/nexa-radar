# Nexa Radar — Plano 2b: Diagnóstico Municipal

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar o módulo M2 completo: o admin seleciona um município, a IA gera um diagnóstico de subexecução com texto + PDF em background (async 202 → Realtime → polling fallback), e o cliente vê o resultado no portal.

**Architecture:** API route POST `/api/diagnostico` cria o registro com status='gerando' e dispara `generateDiagnostico()` em fire-and-forget (funciona porque o deploy é EasyPanel com Node.js always-on, não Vercel serverless). O cliente se inscreve no Supabase Realtime e faz polling a cada 5s como fallback. PDF gerado server-side com `@react-pdf/renderer` e armazenado no Supabase Storage (bucket público). RLS já existente: cliente vê apenas diagnósticos do seu município; admin vê todos via service role.

**Tech Stack:** Next.js 15 App Router, TypeScript strict, @react-pdf/renderer 4.x, @supabase/ssr, Supabase Realtime (postgres_changes), Vitest, Node.js runtime (obrigatório para PDF).

**Planos dependentes:** Plano 2c (Briefing Parlamentar) usa o mesmo padrão de geração async.

**Pré-requisito:** Plano 2a completo (autenticação, layouts, tipos, clientes Supabase já existem).

---

## Mapa de Arquivos

| Arquivo | Responsabilidade |
|---|---|
| `src/lib/diagnostico.ts` | Lógica pura: identificar programas críticos, calcular risco (testável) |
| `src/lib/generateDiagnostico.tsx` | Pipeline de geração: fetch → compute → Claude → PDF → Storage → DB |
| `src/lib/pdf/diagnostico-pdf.tsx` | Template PDF com @react-pdf/renderer |
| `src/lib/__tests__/diagnostico.test.ts` | Testes Vitest para lógica pura |
| `vitest.config.ts` | Config Vitest com alias @/ |
| `src/test/setup.ts` | Setup de testes (globals) |
| `src/app/api/diagnostico/route.ts` | POST: criar + disparar geração, retornar 202 |
| `src/app/api/diagnostico/[id]/route.ts` | GET: retornar status atual (para polling) |
| `src/app/admin/diagnostico/novo/page.tsx` | Server component: formulário com lista de municípios |
| `src/app/admin/diagnostico/[id]/page.tsx` | Admin: ver resultado + "Marcar como Entregue" |
| `src/app/admin/diagnostico/[id]/actions.ts` | Server action: marcarDiagnosticoEntregue |
| `src/components/diagnostico/DiagnosticoForm.tsx` | Client component: select + submit + Realtime + polling |
| `src/app/portal/diagnostico/page.tsx` | Portal: listar diagnósticos do município do cliente |
| `src/app/portal/diagnostico/[id]/page.tsx` | Portal: ver diagnóstico + botão PDF |

---

## Task 1: Supabase — Storage bucket + Realtime

**Files:**
- Create: `supabase/migrations/005_storage_realtime.sql`

O bucket `relatorios` armazena PDFs com acesso público (URLs são UUIDs — suficientemente obscuras para MVP). Realtime é habilitado na tabela `diagnosticos` para as subscriptions do cliente.

- [ ] **Step 1: Criar migration SQL**

```sql
-- supabase/migrations/005_storage_realtime.sql

-- Habilitar Realtime na tabela diagnosticos
ALTER PUBLICATION supabase_realtime ADD TABLE diagnosticos;
```

Salvar o arquivo exatamente em `supabase/migrations/005_storage_realtime.sql`.

- [ ] **Step 2: Aplicar migration via MCP**

Aplicar via Supabase MCP `apply_migration` com o conteúdo acima no projeto `sfzuoqnzdhknmqtprfly`.

- [ ] **Step 3: Criar bucket `relatorios` via SQL Editor do Supabase**

Executar no SQL Editor do Supabase:

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('relatorios', 'relatorios', true)
ON CONFLICT (id) DO NOTHING;
```

- [ ] **Step 4: Verificar bucket criado**

```sql
SELECT id, name, public FROM storage.buckets WHERE id = 'relatorios';
```

Esperado: uma linha com `public = true`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/005_storage_realtime.sql
git commit -m "feat: enable Realtime on diagnosticos, create relatorios storage bucket"
```

---

## Task 2: Vitest — setup de testes

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `src/test/setup.ts`

- [ ] **Step 1: Instalar dependências**

```bash
npm install --save-dev vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom
```

Esperado: pacotes instalados sem erros fatais.

- [ ] **Step 2: Criar `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

- [ ] **Step 3: Criar `src/test/setup.ts`**

```typescript
import '@testing-library/jest-dom'
```

- [ ] **Step 4: Adicionar scripts ao `package.json`**

No objeto `"scripts"`, adicionar:
```json
"test": "vitest run",
"test:watch": "vitest"
```

O `package.json` completo (seção scripts) deve ficar:
```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "next lint",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

- [ ] **Step 5: Escrever teste de smoke para verificar setup**

Criar `src/test/smoke.test.ts`:

```typescript
import { describe, test, expect } from 'vitest'

describe('vitest setup', () => {
  test('1 + 1 = 2', () => {
    expect(1 + 1).toBe(2)
  })
})
```

- [ ] **Step 6: Rodar testes**

```bash
npm test 2>&1
```

Esperado: `1 passed`.

- [ ] **Step 7: Commit**

```bash
git add vitest.config.ts src/test/ package.json package-lock.json
git commit -m "feat: add Vitest test setup with jsdom and @testing-library"
```

---

## Task 3: Lógica de negócio — `src/lib/diagnostico.ts` (TDD)

**Files:**
- Create: `src/lib/__tests__/diagnostico.test.ts`
- Create: `src/lib/diagnostico.ts`

Funções puras que identificam programas em risco e calculam o valor total. São as únicas partes facilmente testáveis em isolamento.

- [ ] **Step 1: Criar diretório de testes**

```bash
mkdir -p src/lib/__tests__
```

- [ ] **Step 2: Escrever os testes ANTES da implementação**

Criar `src/lib/__tests__/diagnostico.test.ts`:

```typescript
import { describe, test, expect } from 'vitest'
import { identificarProgramasCriticos, calcularRisco } from '@/lib/diagnostico'
import type { TransferenciaFederal } from '@/types'

function makeTransferencia(overrides: Partial<TransferenciaFederal> = {}): TransferenciaFederal {
  return {
    id: '1',
    municipio_ibge: '2803500',
    programa: 'SCFV',
    fundo: 'FNAS',
    valor_empenhado: 100_000,
    valor_liquidado: 60_000,
    valor_pago: 60_000,
    percentual_execucao: 60,
    competencia: '2024-01-01',
    prazo_limite: null,
    fonte: 'portal_transparencia',
    coletado_em: '2024-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('identificarProgramasCriticos', () => {
  test('percentual < 70% é crítico', () => {
    const t = [makeTransferencia({ percentual_execucao: 60 })]
    const criticos = identificarProgramasCriticos(t)
    expect(criticos).toHaveLength(1)
    expect(criticos[0].programa).toBe('SCFV')
  })

  test('percentual >= 70% sem prazo não é crítico', () => {
    const t = [makeTransferencia({ percentual_execucao: 80, prazo_limite: null })]
    expect(identificarProgramasCriticos(t)).toHaveLength(0)
  })

  test('percentual >= 70% com prazo > 90 dias não é crítico', () => {
    const future = new Date()
    future.setDate(future.getDate() + 120)
    const prazo = future.toISOString().split('T')[0]
    const t = [makeTransferencia({ percentual_execucao: 80, prazo_limite: prazo })]
    expect(identificarProgramasCriticos(t)).toHaveLength(0)
  })

  test('percentual >= 70% com prazo <= 90 dias é crítico', () => {
    const soon = new Date()
    soon.setDate(soon.getDate() + 60)
    const prazo = soon.toISOString().split('T')[0]
    const t = [makeTransferencia({ percentual_execucao: 75, prazo_limite: prazo })]
    const criticos = identificarProgramasCriticos(t)
    expect(criticos).toHaveLength(1)
    expect(criticos[0].percentual_execucao).toBe(75)
  })

  test('lista vazia retorna vazia', () => {
    expect(identificarProgramasCriticos([])).toHaveLength(0)
  })

  test('mapeia campos corretamente para ProgramaCritico', () => {
    const t = [makeTransferencia({
      percentual_execucao: 50,
      programa: 'CAPS',
      fundo: 'FNS',
      valor_empenhado: 200_000,
      valor_pago: 100_000,
      prazo_limite: '2025-12-31',
    })]
    const criticos = identificarProgramasCriticos(t)
    expect(criticos[0]).toMatchObject({
      programa: 'CAPS',
      fundo: 'FNS',
      valor_empenhado: 200_000,
      valor_pago: 100_000,
      percentual_execucao: 50,
      prazo_limite: '2025-12-31',
    })
  })
})

describe('calcularRisco', () => {
  test('soma correta de dois programas', () => {
    const criticos = [
      {
        programa: 'SCFV', fundo: 'FNAS',
        valor_empenhado: 100_000, valor_pago: 60_000,
        percentual_execucao: 60, prazo_limite: null,
      },
      {
        programa: 'ATENCAO_BASICA', fundo: 'FNS',
        valor_empenhado: 200_000, valor_pago: 150_000,
        percentual_execucao: 75, prazo_limite: null,
      },
    ]
    const { valorTotalIdentificado, valorEmRisco } = calcularRisco(criticos)
    expect(valorTotalIdentificado).toBe(300_000)
    expect(valorEmRisco).toBe(90_000) // (100k-60k) + (200k-150k)
  })

  test('lista vazia retorna zeros', () => {
    const { valorTotalIdentificado, valorEmRisco } = calcularRisco([])
    expect(valorTotalIdentificado).toBe(0)
    expect(valorEmRisco).toBe(0)
  })
})
```

- [ ] **Step 3: Rodar testes para confirmar que FALHAM**

```bash
npm test 2>&1 | tail -15
```

Esperado: FAIL com "Cannot find module '@/lib/diagnostico'".

- [ ] **Step 4: Implementar `src/lib/diagnostico.ts`**

```typescript
// src/lib/diagnostico.ts
import type { TransferenciaFederal, ProgramaCritico } from '@/types'

const PCT_EXECUCAO_CRITICO = 70
const DIAS_PRAZO_CRITICO = 90

export function identificarProgramasCriticos(
  transferencias: TransferenciaFederal[]
): ProgramaCritico[] {
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)

  return transferencias
    .filter((t) => {
      if (t.percentual_execucao < PCT_EXECUCAO_CRITICO) return true
      if (!t.prazo_limite) return false
      const prazo = new Date(t.prazo_limite)
      const diasRestantes = Math.floor(
        (prazo.getTime() - hoje.getTime()) / 86_400_000
      )
      return diasRestantes <= DIAS_PRAZO_CRITICO
    })
    .map((t) => ({
      programa: t.programa,
      fundo: t.fundo,
      valor_empenhado: t.valor_empenhado,
      valor_pago: t.valor_pago,
      percentual_execucao: t.percentual_execucao,
      prazo_limite: t.prazo_limite,
    }))
}

export function calcularRisco(criticos: ProgramaCritico[]): {
  valorTotalIdentificado: number
  valorEmRisco: number
} {
  return {
    valorTotalIdentificado: criticos.reduce((s, p) => s + p.valor_empenhado, 0),
    valorEmRisco: criticos.reduce((s, p) => s + (p.valor_empenhado - p.valor_pago), 0),
  }
}
```

- [ ] **Step 5: Rodar testes para confirmar que PASSAM**

```bash
npm test 2>&1 | tail -15
```

Esperado: `8 passed` (6 testes de identificarProgramasCriticos + 2 de calcularRisco + 1 smoke = 9 total).

- [ ] **Step 6: Verificar TypeScript**

```bash
npx tsc --noEmit --skipLibCheck 2>&1 | head -10
```

Esperado: 0 erros.

- [ ] **Step 7: Commit**

```bash
git add src/lib/diagnostico.ts src/lib/__tests__/diagnostico.test.ts
git commit -m "feat: add diagnostico business logic (TDD) — identificarProgramasCriticos, calcularRisco"
```

---

## Task 4: PDF template — `src/lib/pdf/diagnostico-pdf.tsx`

**Files:**
- Create: `src/lib/pdf/diagnostico-pdf.tsx`

Template com @react-pdf/renderer. Este arquivo é importado apenas pelo pipeline de geração (server-side Node.js). **Nunca importar em Client Components ou Edge runtime.**

- [ ] **Step 1: Criar diretório**

```bash
mkdir -p src/lib/pdf
```

- [ ] **Step 2: Criar `src/lib/pdf/diagnostico-pdf.tsx`**

```typescript
// src/lib/pdf/diagnostico-pdf.tsx
// Node.js only — used by generateDiagnostico.tsx via renderToBuffer
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from '@react-pdf/renderer'
import type { ProgramaCritico } from '@/types'

const styles = StyleSheet.create({
  page:         { padding: 48, fontFamily: 'Helvetica', backgroundColor: '#ffffff', color: '#1e293b' },
  brand:        { fontSize: 9, color: '#0284c7', letterSpacing: 2, marginBottom: 4 },
  title:        { fontSize: 22, fontFamily: 'Helvetica-Bold', color: '#0f172a', marginBottom: 4 },
  subtitle:     { fontSize: 11, color: '#64748b' },
  divider:      { borderBottom: 1, borderColor: '#e2e8f0', marginVertical: 16 },
  section:      { marginBottom: 20 },
  sectionTitle: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#0284c7', letterSpacing: 1, marginBottom: 8 },
  body:         { fontSize: 10, lineHeight: 1.6, color: '#334155' },
  summaryRow:   { flexDirection: 'row', gap: 32, marginTop: 8 },
  summaryBox:   { flex: 1 },
  summaryLabel: { fontSize: 9, color: '#64748b', marginBottom: 2 },
  summaryValue: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: '#0f172a' },
  summaryRisk:  { fontSize: 18, fontFamily: 'Helvetica-Bold', color: '#ef4444' },
  tableHeader:  { flexDirection: 'row', borderBottom: 2, borderColor: '#0284c7', paddingBottom: 4, marginBottom: 2 },
  tableRow:     { flexDirection: 'row', borderBottom: 1, borderColor: '#f1f5f9', paddingVertical: 5 },
  col40:        { width: '40%', fontSize: 9, color: '#334155' },
  col20:        { width: '20%', fontSize: 9, color: '#334155', textAlign: 'right' },
  colHead:      { fontFamily: 'Helvetica-Bold', color: '#64748b', fontSize: 9 },
  colRisk:      { color: '#ef4444' },
  disclaimer:   { marginTop: 24, fontSize: 8, color: '#94a3b8', fontStyle: 'italic' },
  footer:       { position: 'absolute', bottom: 32, left: 48, right: 48, fontSize: 8, color: '#94a3b8', textAlign: 'center' },
})

function brl(value: number) {
  return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
}

export interface DiagnosticoPDFProps {
  municipioNome: string
  uf: string
  valorTotalIdentificado: number
  valorEmRisco: number
  programasCriticos: ProgramaCritico[]
  textoIA: string
  geradoEm: string
}

export function DiagnosticoPDF({
  municipioNome,
  uf,
  valorTotalIdentificado,
  valorEmRisco,
  programasCriticos,
  textoIA,
  geradoEm,
}: DiagnosticoPDFProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Cabeçalho */}
        <View style={styles.section}>
          <Text style={styles.brand}>NEXA RADAR</Text>
          <Text style={styles.title}>Diagnóstico de Subexecução</Text>
          <Text style={styles.subtitle}>{municipioNome} — {uf}</Text>
          <Text style={{ ...styles.subtitle, marginTop: 2, fontSize: 9 }}>
            Gerado em {geradoEm}
          </Text>
        </View>

        <View style={styles.divider} />

        {/* Resumo */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>RESUMO EXECUTIVO</Text>
          <View style={styles.summaryRow}>
            <View style={styles.summaryBox}>
              <Text style={styles.summaryLabel}>Total identificado</Text>
              <Text style={styles.summaryValue}>{brl(valorTotalIdentificado)}</Text>
            </View>
            <View style={styles.summaryBox}>
              <Text style={styles.summaryLabel}>Em risco de devolução</Text>
              <Text style={styles.summaryRisk}>{brl(valorEmRisco)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Tabela de programas */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>PROGRAMAS COM SUBEXECUÇÃO</Text>
          <View style={styles.tableHeader}>
            <Text style={{ ...styles.col40, ...styles.colHead }}>Programa</Text>
            <Text style={{ ...styles.col20, ...styles.colHead }}>Empenhado</Text>
            <Text style={{ ...styles.col20, ...styles.colHead }}>Pago</Text>
            <Text style={{ ...styles.col20, ...styles.colHead }}>Execução</Text>
          </View>
          {programasCriticos.map((p, i) => (
            <View key={i} style={styles.tableRow}>
              <Text style={styles.col40}>{p.programa} ({p.fundo})</Text>
              <Text style={styles.col20}>{brl(p.valor_empenhado)}</Text>
              <Text style={styles.col20}>{brl(p.valor_pago)}</Text>
              <Text style={{ ...styles.col20, ...styles.colRisk }}>
                {p.percentual_execucao.toFixed(1)}%
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.divider} />

        {/* Análise IA */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ANÁLISE E RECOMENDAÇÕES</Text>
          <Text style={styles.body}>{textoIA}</Text>
        </View>

        <Text style={styles.disclaimer}>
          Este diagnóstico foi gerado por inteligência artificial e deve ser revisado
          por especialista antes de qualquer decisão.
        </Text>

        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
          fixed
        />
      </Page>
    </Document>
  )
}
```

- [ ] **Step 3: Verificar TypeScript**

```bash
npx tsc --noEmit --skipLibCheck 2>&1 | head -10
```

Esperado: 0 erros.

- [ ] **Step 4: Commit**

```bash
git add src/lib/pdf/diagnostico-pdf.tsx
git commit -m "feat: add DiagnosticoPDF template with @react-pdf/renderer"
```

---

## Task 5: Pipeline de geração — `src/lib/generateDiagnostico.tsx`

**Files:**
- Create: `src/lib/generateDiagnostico.tsx`

Orquestra: busca dados no Supabase → computa programas críticos → chama Claude → renderiza PDF → faz upload para Storage → atualiza o registro `diagnosticos`. Usa `.tsx` porque importa JSX do template PDF.

- [ ] **Step 1: Criar `src/lib/generateDiagnostico.tsx`**

```typescript
// src/lib/generateDiagnostico.tsx
// Node.js only — never import in browser or Edge runtime.
// Used by /api/diagnostico route.ts via fire-and-forget.
import { renderToBuffer } from '@react-pdf/renderer'
import React from 'react'
import { createAdminClient } from '@/lib/supabase/admin'
import { identificarProgramasCriticos, calcularRisco } from '@/lib/diagnostico'
import { gerarDiagnostico } from '@/lib/claude'
import { DiagnosticoPDF } from '@/lib/pdf/diagnostico-pdf'
import type { TransferenciaFederal } from '@/types'

function brl(value: number) {
  return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
}

export async function generateDiagnostico(
  id: string,
  municipioIbge: string
): Promise<void> {
  const admin = createAdminClient()

  try {
    // 1. Buscar transferências e dados do município
    const [{ data: transferencias, error: te }, { data: municipio, error: me }] =
      await Promise.all([
        admin
          .from('transferencias_federais')
          .select('*')
          .eq('municipio_ibge', municipioIbge),
        admin
          .from('municipios_habilitacao')
          .select('nome, uf')
          .eq('ibge', municipioIbge)
          .single(),
      ])

    if (te) throw te
    if (me || !municipio) throw me ?? new Error(`Município ${municipioIbge} não encontrado`)

    // 2. Computar programas críticos e risco
    const programasCriticos = identificarProgramasCriticos(
      (transferencias ?? []) as TransferenciaFederal[]
    )
    const { valorTotalIdentificado, valorEmRisco } = calcularRisco(programasCriticos)

    // 3. Gerar texto com Claude (pode levar 15-30s)
    const textoIA = await gerarDiagnostico({
      municipio: municipio.nome,
      uf: municipio.uf,
      programasCriticos,
      valorTotalEmRisco: valorEmRisco,
    })

    // 4. Gerar PDF
    const geradoEm = new Date().toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })

    const pdfBuffer = await renderToBuffer(
      React.createElement(DiagnosticoPDF, {
        municipioNome: municipio.nome,
        uf: municipio.uf,
        valorTotalIdentificado,
        valorEmRisco,
        programasCriticos,
        textoIA,
        geradoEm,
      })
    )

    // 5. Upload para Supabase Storage
    const filename = `diagnostico-${id}.pdf`
    const { error: uploadError } = await admin.storage
      .from('relatorios')
      .upload(filename, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true,
      })

    if (uploadError) throw uploadError

    const {
      data: { publicUrl },
    } = admin.storage.from('relatorios').getPublicUrl(filename)

    // 6. Ações recomendadas (top 5 programas críticos)
    const acoes = programasCriticos.slice(0, 5).map(
      (p) =>
        `Regularizar execução de ${p.programa}: ${brl(p.valor_empenhado - p.valor_pago)} parado`
    )

    // 7. Atualizar registro no Supabase
    const { error: updateError } = await admin
      .from('diagnosticos')
      .update({
        status: 'rascunho',
        texto_ia: textoIA,
        pdf_url: publicUrl,
        valor_total_identificado: valorTotalIdentificado,
        valor_em_risco: valorEmRisco,
        programas_criticos: programasCriticos,
        acoes_recomendadas: acoes,
      })
      .eq('id', id)

    if (updateError) throw updateError
  } catch (err) {
    console.error(`[generateDiagnostico] id=${id}:`, err)
    // Marcar como erro para o cliente saber que falhou
    await admin
      .from('diagnosticos')
      .update({ status: 'erro' })
      .eq('id', id)
      .catch(() => {}) // silencia erro secundário
  }
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit --skipLibCheck 2>&1 | head -10
```

Esperado: 0 erros.

- [ ] **Step 3: Commit**

```bash
git add src/lib/generateDiagnostico.tsx
git commit -m "feat: add generateDiagnostico pipeline (fetch → Claude → PDF → Storage → DB)"
```

---

## Task 6: API routes — POST e GET

**Files:**
- Create: `src/app/api/diagnostico/route.ts`
- Create: `src/app/api/diagnostico/[id]/route.ts`

Ambas as rotas precisam de `export const runtime = 'nodejs'` pois são importadas (indiretamente) pelo pipeline PDF que requer Node.js.

- [ ] **Step 1: Criar diretórios**

```bash
mkdir -p src/app/api/diagnostico/\[id\]
```

- [ ] **Step 2: Criar `src/app/api/diagnostico/route.ts`**

```typescript
// src/app/api/diagnostico/route.ts
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateDiagnostico } from '@/lib/generateDiagnostico'

export async function POST(request: NextRequest) {
  // 1. Autenticar
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Verificar tipo admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('tipo')
    .eq('id', user.id)
    .single()

  if (!profile || profile.tipo !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // 3. Validar body
  const body = (await request.json()) as { municipio_ibge?: string }
  if (!body.municipio_ibge) {
    return NextResponse.json({ error: 'municipio_ibge required' }, { status: 400 })
  }

  // 4. Criar registro com status='gerando'
  const admin = createAdminClient()
  const { data: diagnostico, error } = await admin
    .from('diagnosticos')
    .insert({
      municipio_ibge: body.municipio_ibge,
      gerado_por: user.id,
      status: 'gerando',
    })
    .select('id')
    .single()

  if (error || !diagnostico) {
    console.error('[POST /api/diagnostico] insert error:', error)
    return NextResponse.json({ error: 'Failed to create' }, { status: 500 })
  }

  // 5. Fire-and-forget (funciona em EasyPanel/Node.js always-on)
  generateDiagnostico(diagnostico.id, body.municipio_ibge).catch((err) =>
    console.error('[POST /api/diagnostico] generation error:', err)
  )

  return NextResponse.json({ id: diagnostico.id }, { status: 202 })
}
```

- [ ] **Step 3: Criar `src/app/api/diagnostico/[id]/route.ts`**

```typescript
// src/app/api/diagnostico/[id]/route.ts
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('diagnosticos')
    .select(
      'id, status, municipio_ibge, valor_total_identificado, valor_em_risco, pdf_url, criado_em'
    )
    .eq('id', id)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json(data)
}
```

- [ ] **Step 4: Verificar TypeScript e build**

```bash
npx tsc --noEmit --skipLibCheck 2>&1 | head -10
```

Esperado: 0 erros.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/
git commit -m "feat: add POST /api/diagnostico (202 async) and GET /api/diagnostico/[id] (status poll)"
```

---

## Task 7: Admin form — página Novo Diagnóstico

**Files:**
- Create: `src/app/admin/diagnostico/novo/page.tsx`

Server component que carrega a lista de municípios e renderiza o DiagnosticoForm (client component criado na Task 8). O link `/admin/diagnostico/novo` já existe na sidebar do admin layout.

- [ ] **Step 1: Criar diretório**

```bash
mkdir -p src/app/admin/diagnostico/novo
```

- [ ] **Step 2: Criar `src/app/admin/diagnostico/novo/page.tsx`**

```typescript
// src/app/admin/diagnostico/novo/page.tsx
import { createAdminClient } from '@/lib/supabase/admin'
import DiagnosticoForm from '@/components/diagnostico/DiagnosticoForm'

export default async function NovoDiagnosticoPage() {
  const admin = createAdminClient()

  const { data: municipios } = await admin
    .from('municipios_habilitacao')
    .select('ibge, nome, uf')
    .order('nome')
    .limit(300)

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold text-slate-100 mb-1">Novo Diagnóstico</h1>
      <p className="text-slate-400 text-sm mb-8">
        Selecione o município e clique em gerar. O processo leva 30–60 segundos.
      </p>
      <DiagnosticoForm municipios={municipios ?? []} />
    </div>
  )
}
```

- [ ] **Step 3: Commit (parcial — DiagnosticoForm ainda não existe)**

```bash
git add src/app/admin/diagnostico/novo/page.tsx
git commit -m "feat: add admin novo diagnostico page (server component)"
```

---

## Task 8: DiagnosticoForm — client component com Realtime

**Files:**
- Create: `src/components/diagnostico/DiagnosticoForm.tsx`

Client component com estado local. Ao submeter: POST → recebe `id` → subscreve Realtime + inicia polling fallback → quando status='rascunho' ou 'erro', mostra resultado.

- [ ] **Step 1: Criar diretório**

```bash
mkdir -p src/components/diagnostico
```

- [ ] **Step 2: Criar `src/components/diagnostico/DiagnosticoForm.tsx`**

```typescript
// src/components/diagnostico/DiagnosticoForm.tsx
'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { StatusDiagnostico } from '@/types'

interface Municipio {
  ibge: string
  nome: string
  uf: string
}

interface Props {
  municipios: Municipio[]
}

type LocalStatus = StatusDiagnostico | 'idle' | 'timeout'

export default function DiagnosticoForm({ municipios }: Props) {
  const [ibge, setIbge] = useState('')
  const [status, setStatus] = useState<LocalStatus>('idle')
  const [diagnosticoId, setDiagnosticoId] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const router = useRouter()
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!diagnosticoId) return

    const supabase = createClient()

    // Realtime subscription
    const channel = supabase
      .channel(`diagnostico-${diagnosticoId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'diagnosticos',
          filter: `id=eq.${diagnosticoId}`,
        },
        (payload) => {
          const newStatus = (payload.new as { status: StatusDiagnostico }).status
          setStatus(newStatus)
          if (newStatus === 'rascunho' || newStatus === 'erro') {
            cleanup()
          }
        }
      )
      .subscribe()

    // Polling fallback a cada 5s
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/diagnostico/${diagnosticoId}`)
        if (!res.ok) return
        const data = (await res.json()) as { status: StatusDiagnostico }
        setStatus(data.status)
        if (data.status === 'rascunho' || data.status === 'erro') {
          cleanup()
        }
      } catch {
        // ignora erro de poll
      }
    }, 5_000)

    // Timeout após 2 minutos
    timeoutRef.current = setTimeout(() => {
      cleanup()
      setStatus('timeout')
    }, 120_000)

    function cleanup() {
      channel.unsubscribe()
      if (pollRef.current) clearInterval(pollRef.current)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }

    return () => cleanup()
  }, [diagnosticoId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!ibge) return

    setStatus('gerando')
    setSubmitError(null)

    try {
      const res = await fetch('/api/diagnostico', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ municipio_ibge: ibge }),
      })

      if (!res.ok) {
        const body = (await res.json()) as { error: string }
        throw new Error(body.error ?? 'Erro desconhecido')
      }

      const { id } = (await res.json()) as { id: string }
      setDiagnosticoId(id)
    } catch (err) {
      setStatus('idle')
      setSubmitError(err instanceof Error ? err.message : 'Erro ao iniciar geração')
    }
  }

  // Estados pós-geração
  if (status === 'rascunho' && diagnosticoId) {
    return (
      <div className="space-y-4">
        <div className="rounded-md bg-green-900/30 border border-green-700 px-4 py-3">
          <p className="text-green-300 text-sm font-medium">✓ Diagnóstico gerado com sucesso</p>
        </div>
        <button
          onClick={() => router.push(`/admin/diagnostico/${diagnosticoId}`)}
          className="rounded-md bg-nexa-600 px-4 py-2 text-sm font-semibold text-white hover:bg-nexa-700 transition-colors"
        >
          Ver Diagnóstico →
        </button>
      </div>
    )
  }

  if (status === 'erro') {
    return (
      <div className="space-y-3">
        <div className="rounded-md bg-red-900/30 border border-red-700 px-4 py-3">
          <p className="text-red-300 text-sm">Erro na geração do diagnóstico. Verifique os logs.</p>
        </div>
        <button
          onClick={() => {
            setStatus('idle')
            setDiagnosticoId(null)
          }}
          className="text-sm text-red-400 underline hover:text-red-300"
        >
          Tentar novamente
        </button>
      </div>
    )
  }

  if (status === 'timeout') {
    return (
      <div className="space-y-3">
        <div className="rounded-md bg-yellow-900/30 border border-yellow-700 px-4 py-3">
          <p className="text-yellow-300 text-sm">
            A geração está demorando mais que o esperado. Verifique o status em alguns minutos.
          </p>
        </div>
        {diagnosticoId && (
          <button
            onClick={() => router.push(`/admin/diagnostico/${diagnosticoId}`)}
            className="text-sm text-yellow-400 underline hover:text-yellow-300"
          >
            Verificar status do diagnóstico →
          </button>
        )}
      </div>
    )
  }

  // Formulário principal
  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {submitError && (
        <div className="rounded-md bg-red-900/30 border border-red-700 px-4 py-3 text-sm text-red-300">
          {submitError}
        </div>
      )}

      <div>
        <label
          htmlFor="municipio"
          className="block text-sm font-medium text-slate-300 mb-1"
        >
          Município
        </label>
        <select
          id="municipio"
          value={ibge}
          onChange={(e) => setIbge(e.target.value)}
          required
          disabled={status === 'gerando'}
          className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-nexa-500 focus:outline-none focus:ring-1 focus:ring-nexa-500 disabled:opacity-50"
        >
          <option value="">Selecione um município...</option>
          {municipios.map((m) => (
            <option key={m.ibge} value={m.ibge}>
              {m.nome} — {m.uf}
            </option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        disabled={status === 'gerando' || !ibge}
        className="w-full rounded-md bg-nexa-600 px-4 py-2 text-sm font-semibold text-white hover:bg-nexa-700 focus:outline-none focus:ring-2 focus:ring-nexa-500 focus:ring-offset-2 focus:ring-offset-slate-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {status === 'gerando' ? (
          <span className="flex items-center justify-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            Gerando diagnóstico...
          </span>
        ) : (
          'Gerar Diagnóstico'
        )}
      </button>

      {status === 'gerando' && (
        <p className="text-center text-xs text-slate-500">
          Aguardando conclusão. Isso leva 30–60 segundos.
        </p>
      )}
    </form>
  )
}
```

- [ ] **Step 3: Verificar TypeScript**

```bash
npx tsc --noEmit --skipLibCheck 2>&1 | head -10
```

Esperado: 0 erros.

- [ ] **Step 4: Build para verificar rotas**

```bash
npm run build 2>&1 | tail -20
```

Esperado: rotas `/admin/diagnostico/novo`, `/api/diagnostico`, `/api/diagnostico/[id]` aparecem na tabela sem erros.

- [ ] **Step 5: Commit**

```bash
git add src/components/diagnostico/DiagnosticoForm.tsx
git commit -m "feat: add DiagnosticoForm client component with Realtime subscription and polling fallback"
```

---

## Task 9: Admin — detalhe do diagnóstico

**Files:**
- Create: `src/app/admin/diagnostico/[id]/page.tsx`
- Create: `src/app/admin/diagnostico/[id]/actions.ts`

O admin vê o resultado completo (texto IA, programas críticos, link PDF) e pode marcar como entregue.

- [ ] **Step 1: Criar diretório**

```bash
mkdir -p "src/app/admin/diagnostico/[id]"
```

- [ ] **Step 2: Criar `src/app/admin/diagnostico/[id]/actions.ts`**

```typescript
// src/app/admin/diagnostico/[id]/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'

export async function marcarDiagnosticoEntregue(formData: FormData) {
  const id = formData.get('id') as string
  const admin = createAdminClient()

  await admin
    .from('diagnosticos')
    .update({ status: 'entregue' })
    .eq('id', id)

  revalidatePath(`/admin/diagnostico/${id}`)
}
```

- [ ] **Step 3: Criar `src/app/admin/diagnostico/[id]/page.tsx`**

```typescript
// src/app/admin/diagnostico/[id]/page.tsx
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { marcarDiagnosticoEntregue } from './actions'
import type { ProgramaCritico } from '@/types'

function statusColor(status: string) {
  switch (status) {
    case 'gerando':   return 'text-yellow-400'
    case 'rascunho':  return 'text-blue-400'
    case 'entregue':  return 'text-green-400'
    case 'convertido': return 'text-nexa-400'
    case 'erro':      return 'text-red-400'
    default:          return 'text-slate-400'
  }
}

export default async function AdminDiagnosticoPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const admin = createAdminClient()

  const { data: diagnostico } = await admin
    .from('diagnosticos')
    .select('*')
    .eq('id', id)
    .single()

  if (!diagnostico) notFound()

  const { data: municipio } = await admin
    .from('municipios_habilitacao')
    .select('nome, uf')
    .eq('ibge', diagnostico.municipio_ibge)
    .single()

  const programasCriticos = (diagnostico.programas_criticos ?? []) as ProgramaCritico[]

  return (
    <div className="max-w-3xl space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">
            {municipio?.nome ?? diagnostico.municipio_ibge} — {municipio?.uf}
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Status:{' '}
            <span className={statusColor(diagnostico.status)}>
              {diagnostico.status}
            </span>
            {' · '}
            {new Date(diagnostico.criado_em).toLocaleDateString('pt-BR')}
          </p>
        </div>

        {diagnostico.status === 'rascunho' && (
          <form action={marcarDiagnosticoEntregue}>
            <input type="hidden" name="id" value={id} />
            <button
              type="submit"
              className="rounded-md bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-600 transition-colors"
            >
              Marcar como Entregue
            </button>
          </form>
        )}
      </div>

      {/* Números */}
      {diagnostico.valor_em_risco > 0 && (
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-md bg-slate-800 px-5 py-4">
            <p className="text-xs text-slate-500 mb-1">Total identificado</p>
            <p className="text-xl font-bold text-slate-100">
              R${' '}
              {Number(diagnostico.valor_total_identificado).toLocaleString('pt-BR')}
            </p>
          </div>
          <div className="rounded-md bg-slate-800 px-5 py-4">
            <p className="text-xs text-slate-500 mb-1">Em risco de devolução</p>
            <p className="text-xl font-bold text-risk-high">
              R$ {Number(diagnostico.valor_em_risco).toLocaleString('pt-BR')}
            </p>
          </div>
        </div>
      )}

      {/* PDF */}
      {diagnostico.pdf_url && (
        <a
          href={diagnostico.pdf_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:border-slate-500 hover:text-slate-100 transition-colors"
        >
          ↓ Baixar PDF
        </a>
      )}

      {/* Texto IA */}
      {diagnostico.texto_ia && (
        <div className="rounded-md border border-slate-800 bg-slate-800/50 p-6">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
            Análise IA
          </h2>
          <p className="text-slate-300 text-sm whitespace-pre-wrap leading-relaxed">
            {diagnostico.texto_ia}
          </p>
        </div>
      )}

      {/* Programas críticos */}
      {programasCriticos.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
            Programas Críticos
          </h2>
          <div className="space-y-2">
            {programasCriticos.map((p, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-md bg-slate-800 px-4 py-3 text-sm"
              >
                <div>
                  <span className="text-slate-300">{p.programa}</span>
                  <span className="text-slate-500 ml-2 text-xs">{p.fundo}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-slate-500 text-xs font-mono">
                    R$ {(p.valor_empenhado - p.valor_pago).toLocaleString('pt-BR')} parado
                  </span>
                  <span className="text-risk-high font-mono font-semibold">
                    {p.percentual_execucao.toFixed(1)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Estado de geração */}
      {diagnostico.status === 'gerando' && (
        <div className="rounded-md bg-yellow-900/30 border border-yellow-700 px-4 py-3 text-sm text-yellow-300">
          Diagnóstico em geração. Recarregue a página em alguns instantes.
        </div>
      )}

      {diagnostico.status === 'erro' && (
        <div className="rounded-md bg-red-900/30 border border-red-700 px-4 py-3 text-sm text-red-300">
          Houve um erro durante a geração. Tente novamente criando um novo diagnóstico.
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Verificar TypeScript**

```bash
npx tsc --noEmit --skipLibCheck 2>&1 | head -10
```

Esperado: 0 erros.

- [ ] **Step 5: Commit**

```bash
git add "src/app/admin/diagnostico/[id]/"
git commit -m "feat: add admin diagnostico detail page with marcar entregue action"
```

---

## Task 10: Portal — páginas de diagnóstico (lista + detalhe)

**Files:**
- Create: `src/app/portal/diagnostico/page.tsx`
- Create: `src/app/portal/diagnostico/[id]/page.tsx`

O prefeito vê diagnósticos do seu município (RLS: `municipio_ibge = _user_municipio()`). Apenas status `rascunho`, `entregue`, `convertido` são visíveis (a policy filtra `gerando` e `erro`).

**Nota:** A RLS policy existente (`diagnosticos_select`) já limita ao município do usuário. Para o portal, usamos o server client (anon + cookies, RLS ativo).

- [ ] **Step 1: Criar diretórios**

```bash
mkdir -p "src/app/portal/diagnostico/[id]"
```

- [ ] **Step 2: Criar `src/app/portal/diagnostico/page.tsx`**

```typescript
// src/app/portal/diagnostico/page.tsx
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

function statusBadge(status: string) {
  switch (status) {
    case 'rascunho':  return 'bg-blue-900/50 text-blue-300 border-blue-800'
    case 'entregue':  return 'bg-green-900/50 text-green-300 border-green-800'
    case 'convertido': return 'bg-nexa-900/50 text-nexa-300 border-nexa-800'
    default:          return 'bg-slate-700/50 text-slate-300 border-slate-600'
  }
}

export default async function PortalDiagnosticoPage() {
  const supabase = await createClient()

  const { data: diagnosticos } = await supabase
    .from('diagnosticos')
    .select('id, status, valor_total_identificado, valor_em_risco, criado_em')
    .order('criado_em', { ascending: false })

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-100 mb-6">Diagnósticos</h1>

      {!diagnosticos?.length ? (
        <p className="text-slate-400 text-sm">
          Nenhum diagnóstico disponível ainda. Entre em contato com a equipe Nexa Radar.
        </p>
      ) : (
        <div className="space-y-3">
          {diagnosticos.map((d) => (
            <Link
              key={d.id}
              href={`/portal/diagnostico/${d.id}`}
              className="block rounded-md border border-slate-800 bg-slate-800/40 px-5 py-4 hover:border-slate-700 hover:bg-slate-800/70 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-200">
                    {new Date(d.criado_em).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </p>
                  {d.valor_em_risco > 0 && (
                    <p className="text-xs text-slate-500 mt-0.5">
                      R$ {Number(d.valor_em_risco).toLocaleString('pt-BR')} em risco identificado
                    </p>
                  )}
                </div>
                <span
                  className={`text-xs px-2 py-1 rounded-full border ${statusBadge(d.status)}`}
                >
                  {d.status}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Criar `src/app/portal/diagnostico/[id]/page.tsx`**

```typescript
// src/app/portal/diagnostico/[id]/page.tsx
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { ProgramaCritico } from '@/types'

export default async function PortalDiagnosticoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: diagnostico } = await supabase
    .from('diagnosticos')
    .select('*')
    .eq('id', id)
    .single()

  // RLS garante que só vê o próprio município; 'gerando'/'erro' não aparecem na listagem
  if (!diagnostico) notFound()

  const programasCriticos = (diagnostico.programas_criticos ?? []) as ProgramaCritico[]

  return (
    <div className="max-w-3xl space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Diagnóstico Municipal</h1>
          <p className="text-slate-400 text-sm mt-1">
            Gerado em{' '}
            {new Date(diagnostico.criado_em).toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        </div>

        {diagnostico.pdf_url && (
          <a
            href={diagnostico.pdf_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0 rounded-md border border-nexa-700 px-4 py-2 text-sm text-nexa-400 hover:bg-nexa-900/20 transition-colors"
          >
            ↓ Baixar PDF
          </a>
        )}
      </div>

      {/* Números */}
      {(diagnostico.valor_em_risco > 0 || diagnostico.valor_total_identificado > 0) && (
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-md bg-slate-800 px-5 py-4">
            <p className="text-xs text-slate-500 mb-1">Total identificado</p>
            <p className="text-2xl font-bold text-slate-100">
              R$ {Number(diagnostico.valor_total_identificado).toLocaleString('pt-BR')}
            </p>
          </div>
          <div className="rounded-md bg-slate-800 px-5 py-4">
            <p className="text-xs text-slate-500 mb-1">Em risco de devolução</p>
            <p className="text-2xl font-bold text-risk-high">
              R$ {Number(diagnostico.valor_em_risco).toLocaleString('pt-BR')}
            </p>
          </div>
        </div>
      )}

      {/* Análise IA */}
      {diagnostico.texto_ia && (
        <div className="rounded-md border border-slate-800 bg-slate-800/50 p-6">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
            Análise e Recomendações
          </h2>
          <p className="text-slate-300 text-sm whitespace-pre-wrap leading-relaxed">
            {diagnostico.texto_ia}
          </p>
        </div>
      )}

      {/* Programas críticos */}
      {programasCriticos.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
            Programas Identificados
          </h2>
          <div className="space-y-2">
            {programasCriticos.map((p, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-md bg-slate-800 px-4 py-3 text-sm"
              >
                <div>
                  <span className="text-slate-300">{p.programa}</span>
                  <span className="text-slate-500 ml-2 text-xs">{p.fundo}</span>
                </div>
                <span className="text-risk-high font-mono text-xs font-semibold">
                  {p.percentual_execucao.toFixed(1)}% executado
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Verificar TypeScript e build completo**

```bash
npx tsc --noEmit --skipLibCheck 2>&1 | head -10
```

Esperado: 0 erros.

```bash
npm run build 2>&1 | tail -25
```

Esperado: tabela de rotas incluindo `/portal/diagnostico`, `/portal/diagnostico/[id]`, `/admin/diagnostico/novo`, `/admin/diagnostico/[id]`, `/api/diagnostico`, `/api/diagnostico/[id]` — todos sem erros.

- [ ] **Step 5: Rodar todos os testes**

```bash
npm test 2>&1
```

Esperado: todos os testes passam (incluindo os de lógica de negócio).

- [ ] **Step 6: Commit final**

```bash
git add "src/app/portal/diagnostico/"
git commit -m "feat: add portal diagnostico list and detail pages"
```

---

## Validação Final do Plano 2b

Ao completar todas as tasks, verificar:

- [ ] `npm run build` sem erros TypeScript
- [ ] `npm test` — todos os testes passam
- [ ] Bucket `relatorios` existe no Supabase Storage
- [ ] Realtime habilitado em `diagnosticos` (migration 005 aplicada)
- [ ] POST `/api/diagnostico` retorna 202 com `{ id }`
- [ ] GET `/api/diagnostico/{id}` retorna status atual
- [ ] Admin pode gerar diagnóstico em `/admin/diagnostico/novo`
- [ ] DiagnosticoForm mostra spinner → verde após geração
- [ ] Admin vê texto IA + PDF em `/admin/diagnostico/{id}`
- [ ] Admin pode marcar como "Entregue"
- [ ] Portal cliente vê lista de diagnósticos (RLS ativo)
- [ ] Portal cliente pode baixar PDF

**Fluxo de teste manual** (requer `ANTHROPIC_API_KEY` real no `.env.local`):
1. Login como `admin@nexaradar.com.br`
2. Ir para "Novo Diagnóstico" na sidebar
3. Selecionar "Lagarto — SE" (IBGE `2803500` — dados reais do scraper)
4. Clicar "Gerar Diagnóstico"
5. Aguardar 30–60s (spinner deve girar)
6. Ver diagnóstico com texto IA + PDF gerado
7. Clicar "Marcar como Entregue"
8. Criar usuário portal para o município de Lagarto e verificar que ele vê o diagnóstico

**Próximo:** Plano 2c — Briefing Parlamentar + Portal completo.
