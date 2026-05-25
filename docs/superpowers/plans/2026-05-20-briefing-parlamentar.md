# Nexa Radar — Plano 2c: Briefing Parlamentar

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar o módulo M5 (simplificado): o admin gera um briefing político para um deputado/senador com suas emendas, score de municípios prioritários e análise IA; o parlamentar vê suas emendas e briefings no portal.

**Architecture:** Mesma arquitetura async do Plan 2b: POST `/api/briefing` cria registro + dispara `generateBriefing()` fire-and-forget (EasyPanel always-on). Cliente subscreve Realtime + polling fallback. PDF gerado server-side com `@react-pdf/renderer`, salvo no bucket privado `relatorios` como `briefing-{uuid}.pdf` (coberto pela RLS da migration 008). Score de municípios calculado com 3 fatores: alocação disponível (40%), CAUC regular (40%), IDH (20%).

**Tech Stack:** Next.js 15 App Router, TypeScript strict, @react-pdf/renderer 4.x, @supabase/ssr, Supabase Realtime, Vitest.

**Pré-requisito:** Plans 2a e 2b completos. `gerarBriefingParlamentar()` já existe em `src/lib/claude.ts`.

**Este plano produz:** admin gera briefing para deputado → PDF gerado → admin entrega → deputado vê no portal.

---

## Mapa de Arquivos

| Arquivo | Responsabilidade |
|---|---|
| `supabase/migrations/013_emendas_rls.sql` | SELECT policy para emendas_parlamentares (portal reads) |
| `src/lib/briefing.ts` | Lógica pura: calcularRiscoBriefing, calcularScoresMunicipios |
| `src/lib/__tests__/briefing.test.ts` | Vitest TDD para lógica pura |
| `src/lib/pdf/briefing-pdf.tsx` | Template PDF @react-pdf/renderer |
| `src/lib/generateBriefing.tsx` | Pipeline: fetch → compute → Claude → PDF → Storage → DB |
| `src/app/api/briefing/route.ts` | POST: criar + disparar, 202 |
| `src/app/api/briefing/[id]/route.ts` | GET: status polling (admin-only) |
| `src/app/admin/parlamentar/page.tsx` | Admin: listar parlamentares com contagem de emendas |
| `src/app/admin/parlamentar/[id]/page.tsx` | Admin: ver emendas do parlamentar + gerar briefing + histórico |
| `src/components/briefing/BriefingForm.tsx` | Client component: botão + Realtime + polling |
| `src/app/admin/briefing/[id]/page.tsx` | Admin: ver briefing + marcar entregue |
| `src/app/admin/briefing/[id]/actions.ts` | Server action: marcarBriefingEntregue (UUID + auth guard) |
| `src/app/portal/layout.tsx` | Modificar: adicionar /portal/briefing no nav deputado/senador |
| `src/app/portal/emendas/page.tsx` | Portal: lista emendas do parlamentar logado (RLS ativo) |
| `src/app/portal/briefing/page.tsx` | Portal: lista briefings entregues do parlamentar |
| `src/app/portal/briefing/[id]/page.tsx` | Portal: ver briefing + download PDF |

---

## Task 1: Migration — RLS em emendas_parlamentares

**Files:**
- Create: `supabase/migrations/013_emendas_rls.sql`

A migration 010 habilitou RLS em `emendas_parlamentares` sem policies (ninguém acessa). Agora precisamos que o parlamentar logado veja suas próprias emendas no portal via server client (RLS ativo).

- [ ] **Step 1: Criar migration**

```sql
-- supabase/migrations/013_emendas_rls.sql
-- Allow authenticated users to SELECT their own emendas.
-- emendas_parlamentares was RLS-enabled with no policies (migration 010).
-- Admin reads all; parlamentar reads own.

CREATE POLICY emendas_select ON emendas_parlamentares FOR SELECT
  TO authenticated
  USING (parlamentar_id = _user_parlamentar() OR _user_tipo() = 'admin');
```

Salvar em `supabase/migrations/013_emendas_rls.sql`.

- [ ] **Step 2: Aplicar via MCP**

Aplicar via Supabase MCP `apply_migration` no projeto `sfzuoqnzdhknmqtprfly`.

- [ ] **Step 3: Verificar**

```sql
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'emendas_parlamentares';
```

Esperado: `emendas_select` aparece na lista.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/013_emendas_rls.sql
git commit -m "feat: add SELECT policy for emendas_parlamentares (parlamentar reads own)"
```

---

## Task 2: Lógica de negócio — `src/lib/briefing.ts` (TDD)

**Files:**
- Create: `src/lib/__tests__/briefing.test.ts`
- Create: `src/lib/briefing.ts`

Funções puras testáveis. `calcularRiscoBriefing` agrega valores das emendas. `calcularScoresMunicipios` retorna top 5 municípios ordenados por score composto.

- [ ] **Step 1: Criar testes ANTES da implementação**

Criar `src/lib/__tests__/briefing.test.ts`:

```typescript
import { describe, test, expect } from 'vitest'
import { calcularRiscoBriefing, calcularScoresMunicipios } from '@/lib/briefing'
import type { EmendaParlamentar, MunicipioHabilitacao } from '@/types'

function makeEmenda(overrides: Partial<EmendaParlamentar> = {}): EmendaParlamentar {
  return {
    id: '1',
    parlamentar_id: 'DEP12345',
    parlamentar_nome: 'João Silva',
    tipo: 'RP6',
    parlamentar_tipo: 'individual',
    municipio_ibge: '2803500',
    area_tematica: 'assistencia_social',
    valor_autorizado: 1_000_000,
    valor_empenhado: 800_000,
    valor_executado: 0,
    percentual_execucao: 0,
    prazo_limite: null,
    status_cauc: true,
    exercicio: 2024,
    fonte: 'siga_brasil',
    coletado_em: '2024-01-01T00:00:00Z',
    ...overrides,
  }
}

function makeMunicipio(overrides: Partial<MunicipioHabilitacao> = {}): MunicipioHabilitacao {
  return {
    ibge: '2803500',
    nome: 'Lagarto',
    uf: 'SE',
    populacao: 100_000,
    idh: 0.6,
    cauc_regular: true,
    ultima_verificacao: null,
    programas_habilitados: [],
    programas_bloqueados: [],
    ...overrides,
  }
}

describe('calcularRiscoBriefing', () => {
  test('calcula totais corretamente', () => {
    const emendas = [
      makeEmenda({ valor_autorizado: 1_000_000, valor_executado: 0 }),
      makeEmenda({ id: '2', valor_autorizado: 500_000, valor_executado: 0 }),
    ]
    const { valorTotalEmendas, valorEmRisco, percentualExecutado } = calcularRiscoBriefing(emendas)
    expect(valorTotalEmendas).toBe(1_500_000)
    expect(valorEmRisco).toBe(1_500_000)
    expect(percentualExecutado).toBe(0)
  })

  test('percentual correto quando parcialmente executado', () => {
    const emendas = [makeEmenda({ valor_autorizado: 1_000_000, valor_executado: 400_000 })]
    const { percentualExecutado } = calcularRiscoBriefing(emendas)
    expect(percentualExecutado).toBeCloseTo(40, 1)
  })

  test('emendaVencendoMaisUrgente retorna null sem prazo', () => {
    const emendas = [makeEmenda({ prazo_limite: null })]
    const { emendaVencendoMaisUrgente } = calcularRiscoBriefing(emendas)
    expect(emendaVencendoMaisUrgente).toBeNull()
  })

  test('emendaVencendoMaisUrgente retorna a mais próxima', () => {
    const soon = new Date()
    soon.setDate(soon.getDate() + 30)
    const far = new Date()
    far.setDate(far.getDate() + 120)
    const emendas = [
      makeEmenda({ id: '1', prazo_limite: far.toISOString().split('T')[0], municipio_ibge: '2701209' }),
      makeEmenda({ id: '2', prazo_limite: soon.toISOString().split('T')[0], municipio_ibge: '2803500' }),
    ]
    const { emendaVencendoMaisUrgente } = calcularRiscoBriefing(emendas)
    expect(emendaVencendoMaisUrgente?.municipio).toBe('2803500')
  })

  test('lista vazia retorna zeros', () => {
    const { valorTotalEmendas, valorEmRisco } = calcularRiscoBriefing([])
    expect(valorTotalEmendas).toBe(0)
    expect(valorEmRisco).toBe(0)
  })
})

describe('calcularScoresMunicipios', () => {
  test('retorna top 5 ordenado por score decrescente', () => {
    const emendas = [
      makeEmenda({ municipio_ibge: '2803500', valor_autorizado: 1_000_000, valor_empenhado: 0 }),
      makeEmenda({ id: '2', municipio_ibge: '2701209', valor_autorizado: 500_000, valor_empenhado: 450_000 }),
    ]
    const municipios = [
      makeMunicipio({ ibge: '2803500', idh: 0.55, cauc_regular: true }),
      makeMunicipio({ ibge: '2701209', nome: 'Palmeira dos Índios', idh: 0.65, cauc_regular: true }),
    ]
    const result = calcularScoresMunicipios(emendas, municipios)
    expect(result.length).toBeLessThanOrEqual(5)
    // município com mais disponível (100%) deve ter score maior
    expect(result[0].ibge).toBe('2803500')
    expect(result[0].score_total).toBeGreaterThan(result[1].score_total)
  })

  test('cauc_regular=false reduz score', () => {
    const emendas = [
      makeEmenda({ municipio_ibge: 'A', valor_autorizado: 100, valor_empenhado: 0 }),
      makeEmenda({ id: '2', municipio_ibge: 'B', valor_autorizado: 100, valor_empenhado: 0 }),
    ]
    const municipios = [
      makeMunicipio({ ibge: 'A', cauc_regular: true, idh: 0.6 }),
      makeMunicipio({ ibge: 'B', cauc_regular: false, idh: 0.6 }),
    ]
    const result = calcularScoresMunicipios(emendas, municipios)
    const scoreA = result.find(m => m.ibge === 'A')!.score_total
    const scoreB = result.find(m => m.ibge === 'B')!.score_total
    expect(scoreA).toBeGreaterThan(scoreB)
  })

  test('ignora emendas sem municipio_ibge', () => {
    const emendas = [makeEmenda({ municipio_ibge: null })]
    const result = calcularScoresMunicipios(emendas, [])
    expect(result).toHaveLength(0)
  })

  test('ignora municípios sem dados em municipios_habilitacao', () => {
    const emendas = [makeEmenda({ municipio_ibge: '9999999' })]
    const result = calcularScoresMunicipios(emendas, [])
    expect(result).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Rodar — confirmar FAIL**

```bash
npm test 2>&1 | tail -10
```

Esperado: FAIL "Cannot find module '@/lib/briefing'".

- [ ] **Step 3: Implementar `src/lib/briefing.ts`**

```typescript
// src/lib/briefing.ts
import type { EmendaParlamentar, MunicipioHabilitacao, MunicipioRecomendado } from '@/types'

function brl(v: number) {
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`
}

export interface RiscoBriefing {
  valorTotalEmendas: number
  valorEmRisco: number
  percentualExecutado: number
  emendaVencendoMaisUrgente: { municipio: string; prazo: string; valor: number } | null
}

export function calcularRiscoBriefing(emendas: EmendaParlamentar[]): RiscoBriefing {
  const valorTotal = emendas.reduce((s, e) => s + e.valor_autorizado, 0)
  const valorExecutado = emendas.reduce((s, e) => s + e.valor_executado, 0)
  const valorEmRisco = emendas.reduce((s, e) => s + (e.valor_autorizado - e.valor_executado), 0)
  const percentualExecutado = valorTotal > 0 ? (valorExecutado / valorTotal) * 100 : 0

  const hoje = new Date(new Date().toISOString().slice(0, 10) + 'T12:00:00Z')
  const comPrazo = emendas
    .filter((e) => e.prazo_limite && e.municipio_ibge)
    .map((e) => ({
      municipio: e.municipio_ibge!,
      prazo: String(e.prazo_limite),
      valor: e.valor_autorizado - e.valor_executado,
      dias: Math.floor(
        (new Date(String(e.prazo_limite) + 'T12:00:00Z').getTime() - hoje.getTime()) / 86_400_000
      ),
    }))
    .filter((e) => e.dias >= 0)
    .sort((a, b) => a.dias - b.dias)

  return {
    valorTotalEmendas: valorTotal,
    valorEmRisco,
    percentualExecutado,
    emendaVencendoMaisUrgente: comPrazo[0] ?? null,
  }
}

export function calcularScoresMunicipios(
  emendas: EmendaParlamentar[],
  municipios: MunicipioHabilitacao[]
): MunicipioRecomendado[] {
  const munMap = new Map(municipios.map((m) => [m.ibge, m]))

  // Aggregate emendas by municipio
  const agg = new Map<string, { autorizado: number; empenhado: number; municipio: MunicipioHabilitacao }>()
  for (const e of emendas) {
    if (!e.municipio_ibge) continue
    const municipio = munMap.get(e.municipio_ibge)
    if (!municipio) continue
    const existing = agg.get(e.municipio_ibge)
    if (existing) {
      existing.autorizado += e.valor_autorizado
      existing.empenhado += e.valor_empenhado
    } else {
      agg.set(e.municipio_ibge, {
        autorizado: e.valor_autorizado,
        empenhado: e.valor_empenhado,
        municipio,
      })
    }
  }

  const scored: MunicipioRecomendado[] = []
  for (const [ibge, { autorizado, empenhado, municipio }] of agg) {
    const disponivel = autorizado - empenhado
    const scoreAlocacao = autorizado > 0 ? (disponivel / autorizado) * 100 : 0
    const scoreCapacidade = municipio.cauc_regular ? 100 : 0
    const scoreIdh = (1 - (municipio.idh ?? 0.5)) * 100
    const scoreTotal = Math.round(scoreAlocacao * 0.4 + scoreCapacidade * 0.4 + scoreIdh * 0.2)

    const partes: string[] = []
    if (scoreAlocacao > 40) partes.push(`${brl(disponivel)} disponível`)
    if (municipio.cauc_regular) partes.push('CAUC regular')
    if (municipio.idh && municipio.idh < 0.65) partes.push(`IDH ${municipio.idh.toFixed(3)}`)

    scored.push({
      ibge,
      nome: municipio.nome,
      score_total: scoreTotal,
      justificativa: partes.join(' · ') || 'Município ativo',
    })
  }

  return scored.sort((a, b) => b.score_total - a.score_total).slice(0, 5)
}
```

- [ ] **Step 4: Rodar — confirmar PASS**

```bash
npm test 2>&1 | tail -10
```

Esperado: todos os testes de briefing passam (9 novos + 14 existentes = 23 total).

- [ ] **Step 5: TypeScript**

```bash
npx tsc --noEmit --skipLibCheck 2>&1 | head -5
```

Esperado: 0 erros.

- [ ] **Step 6: Commit**

```bash
git add src/lib/briefing.ts src/lib/__tests__/briefing.test.ts
git commit -m "feat: add briefing business logic (TDD) — calcularRiscoBriefing, calcularScoresMunicipios"
```

---

## Task 3: PDF template — `src/lib/pdf/briefing-pdf.tsx`

**Files:**
- Create: `src/lib/pdf/briefing-pdf.tsx`

Template @react-pdf/renderer para o briefing parlamentar. Node.js only. Reutiliza os mesmos estilos base do DiagnosticoPDF.

- [ ] **Step 1: Criar `src/lib/pdf/briefing-pdf.tsx`**

```typescript
// src/lib/pdf/briefing-pdf.tsx
// Node.js only — used by generateBriefing.tsx via renderToBuffer
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import type { MunicipioRecomendado } from '@/types'

const styles = StyleSheet.create({
  page:         { padding: 48, fontFamily: 'Helvetica', backgroundColor: '#ffffff', color: '#1e293b' },
  brand:        { fontSize: 9, color: '#0284c7', letterSpacing: 2, marginBottom: 4 },
  title:        { fontSize: 22, fontFamily: 'Helvetica-Bold', color: '#0f172a', marginBottom: 4 },
  subtitle:     { fontSize: 11, color: '#64748b' },
  divider:      { borderBottom: 1, borderColor: '#e2e8f0', marginVertical: 16 },
  section:      { marginBottom: 20 },
  sectionTitle: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#0284c7', letterSpacing: 1, marginBottom: 8 },
  body:         { fontSize: 10, lineHeight: 1.6, color: '#334155' },
  summaryRow:   { flexDirection: 'row', gap: 24, marginTop: 8 },
  summaryBox:   { flex: 1 },
  summaryLabel: { fontSize: 9, color: '#64748b', marginBottom: 2 },
  summaryValue: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#0f172a' },
  summaryRisk:  { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#ef4444' },
  tableHeader:  { flexDirection: 'row', borderBottom: 2, borderColor: '#0284c7', paddingBottom: 4, marginBottom: 2 },
  tableRow:     { flexDirection: 'row', borderBottom: 1, borderColor: '#f1f5f9', paddingVertical: 5 },
  colNum:       { width: '8%',  fontSize: 9, color: '#64748b' },
  col50:        { width: '50%', fontSize: 9, color: '#334155' },
  col22:        { width: '22%', fontSize: 9, color: '#334155', textAlign: 'right' },
  col20:        { width: '20%', fontSize: 9, color: '#334155', textAlign: 'right' },
  colHead:      { fontFamily: 'Helvetica-Bold', color: '#64748b', fontSize: 9 },
  disclaimer:   { marginTop: 24, fontSize: 8, color: '#94a3b8', fontStyle: 'italic' },
  footer:       { position: 'absolute', bottom: 32, left: 48, right: 48, fontSize: 8, color: '#94a3b8', textAlign: 'center' },
})

function brl(v: number) {
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`
}

export interface BriefingPDFProps {
  parlamentarNome: string
  valorTotalEmendas: number
  valorEmRisco: number
  percentualExecutado: number
  top5Municipios: MunicipioRecomendado[]
  textoIA: string
  geradoEm: string
}

export function BriefingPDF({
  parlamentarNome,
  valorTotalEmendas,
  valorEmRisco,
  percentualExecutado,
  top5Municipios,
  textoIA,
  geradoEm,
}: BriefingPDFProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Cabeçalho */}
        <View style={styles.section}>
          <Text style={styles.brand}>NEXA RADAR</Text>
          <Text style={styles.title}>Briefing Parlamentar</Text>
          <Text style={styles.subtitle}>{parlamentarNome}</Text>
          <Text style={{ ...styles.subtitle, marginTop: 2, fontSize: 9 }}>
            Gerado em {geradoEm}
          </Text>
        </View>

        <View style={styles.divider} />

        {/* Resumo financeiro */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SITUAÇÃO DAS EMENDAS</Text>
          <View style={styles.summaryRow}>
            <View style={styles.summaryBox}>
              <Text style={styles.summaryLabel}>Total de emendas individuais</Text>
              <Text style={styles.summaryValue}>{brl(valorTotalEmendas)}</Text>
            </View>
            <View style={styles.summaryBox}>
              <Text style={styles.summaryLabel}>Percentual executado</Text>
              <Text style={styles.summaryValue}>{percentualExecutado.toFixed(1)}%</Text>
            </View>
            <View style={styles.summaryBox}>
              <Text style={styles.summaryLabel}>Em risco de devolução</Text>
              <Text style={styles.summaryRisk}>{brl(valorEmRisco)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Municípios recomendados */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>MUNICÍPIOS PRIORITÁRIOS</Text>
          <View style={styles.tableHeader}>
            <Text style={{ ...styles.colNum, ...styles.colHead }}>#</Text>
            <Text style={{ ...styles.col50, ...styles.colHead }}>Município</Text>
            <Text style={{ ...styles.col22, ...styles.colHead }}>Score</Text>
            <Text style={{ ...styles.col20, ...styles.colHead }}>CAUC</Text>
          </View>
          {top5Municipios.map((m, i) => (
            <View key={m.ibge} style={styles.tableRow}>
              <Text style={styles.colNum}>{i + 1}</Text>
              <View style={{ width: '50%' }}>
                <Text style={{ ...styles.col50, width: '100%' }}>{m.nome}</Text>
                <Text style={{ fontSize: 7, color: '#94a3b8', marginTop: 1 }}>{m.justificativa}</Text>
              </View>
              <Text style={styles.col22}>{m.score_total}/100</Text>
              <Text style={styles.col20}>✓</Text>
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
          Gerado por inteligência artificial — revisar com equipe antes de usar.
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

- [ ] **Step 2: TypeScript**

```bash
npx tsc --noEmit --skipLibCheck 2>&1 | head -5
```

Esperado: 0 erros.

- [ ] **Step 3: Commit**

```bash
git add src/lib/pdf/briefing-pdf.tsx
git commit -m "feat: add BriefingPDF template with @react-pdf/renderer"
```

---

## Task 4: Pipeline de geração — `src/lib/generateBriefing.tsx`

**Files:**
- Create: `src/lib/generateBriefing.tsx`

Mesma estrutura do `generateDiagnostico.tsx`. Busca emendas + municípios, calcula scores, chama Claude, renderiza PDF, faz upload, atualiza DB.

- [ ] **Step 1: Criar `src/lib/generateBriefing.tsx`**

```typescript
// src/lib/generateBriefing.tsx
// Node.js only — never import in browser or Edge runtime.
import { renderToBuffer } from '@react-pdf/renderer'
import React from 'react'
import type { DocumentProps } from '@react-pdf/renderer'
import { createAdminClient } from '@/lib/supabase/admin'
import { calcularRiscoBriefing, calcularScoresMunicipios } from '@/lib/briefing'
import { gerarBriefingParlamentar } from '@/lib/claude'
import { BriefingPDF } from '@/lib/pdf/briefing-pdf'
import type { EmendaParlamentar, MunicipioHabilitacao } from '@/types'

export async function generateBriefing(
  id: string,
  parlamentarId: string
): Promise<void> {
  const admin = createAdminClient()

  try {
    // 1. Buscar emendas e municípios em paralelo
    const [{ data: emendas, error: ee }, { data: municipios, error: me }] =
      await Promise.all([
        admin
          .from('emendas_parlamentares')
          .select(
            'id,parlamentar_id,parlamentar_nome,tipo,parlamentar_tipo,municipio_ibge,area_tematica,valor_autorizado,valor_empenhado,valor_executado,percentual_execucao,prazo_limite,status_cauc,exercicio,fonte,coletado_em'
          )
          .eq('parlamentar_id', parlamentarId),
        admin
          .from('municipios_habilitacao')
          .select('ibge,nome,uf,populacao,idh,cauc_regular,ultima_verificacao,programas_habilitados,programas_bloqueados'),
      ])

    if (ee) throw ee
    if (me) throw me

    const emendasList = (emendas ?? []) as EmendaParlamentar[]
    const municipiosList = (municipios ?? []) as MunicipioHabilitacao[]

    if (!emendasList.length) throw new Error(`Nenhuma emenda para parlamentar_id=${parlamentarId}`)

    const parlamentarNome = emendasList[0].parlamentar_nome ?? parlamentarId

    // 2. Calcular risco e scores
    const risco = calcularRiscoBriefing(emendasList)
    const top5 = calcularScoresMunicipios(emendasList, municipiosList)

    // 3. Gerar texto com Claude
    const textoIA = await gerarBriefingParlamentar({
      parlamentarNome,
      totalEmendas: risco.valorTotalEmendas,
      valorEmRisco: risco.valorEmRisco,
      percentualExecutado: risco.percentualExecutado,
      emendaVencendoMaisUrgente: risco.emendaVencendoMaisUrgente,
      top5Municipios: top5.map((m) => ({
        nome: m.nome,
        score: m.score_total,
        justificativa: m.justificativa,
      })),
    })

    // 4. Gerar PDF
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const geradoEm = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`

    const pdfBuffer = await renderToBuffer(
      React.createElement(BriefingPDF, {
        parlamentarNome,
        valorTotalEmendas: risco.valorTotalEmendas,
        valorEmRisco: risco.valorEmRisco,
        percentualExecutado: risco.percentualExecutado,
        top5Municipios: top5,
        textoIA,
        geradoEm,
      }) as React.ReactElement<DocumentProps>
    )

    // 5. Upload para Storage
    const filename = `briefing-${id}.pdf`
    const { error: uploadError } = await admin.storage
      .from('relatorios')
      .upload(filename, pdfBuffer, { contentType: 'application/pdf', upsert: true })

    if (uploadError) throw uploadError

    // 6. Atualizar registro
    const { error: updateError } = await admin
      .from('briefings')
      .update({
        status: 'rascunho',
        texto_ia: textoIA,
        pdf_url: filename,
        valor_total_emendas: risco.valorTotalEmendas,
        valor_em_risco: risco.valorEmRisco,
        municipios_recomendados: top5,
      })
      .eq('id', id)

    if (updateError) throw updateError
  } catch (err) {
    console.error(`[generateBriefing] id=${id}:`, err)
    await admin
      .from('briefings')
      .update({ status: 'erro' })
      .eq('id', id)
      .eq('status', 'gerando')
      .then(() => {}, (e) => console.error(`[generateBriefing] falha ao marcar erro id=${id}:`, e))
  }
}
```

- [ ] **Step 2: TypeScript**

```bash
npx tsc --noEmit --skipLibCheck 2>&1 | head -5
```

Esperado: 0 erros.

- [ ] **Step 3: Commit**

```bash
git add src/lib/generateBriefing.tsx
git commit -m "feat: add generateBriefing pipeline (fetch → Claude → PDF → Storage → DB)"
```

---

## Task 5: API routes — POST e GET `/api/briefing`

**Files:**
- Create: `src/app/api/briefing/route.ts`
- Create: `src/app/api/briefing/[id]/route.ts`

Mesma estrutura das rotas de diagnóstico. POST cria registro + dispara geração. GET retorna status (admin-only).

- [ ] **Step 1: Criar diretórios**

```bash
mkdir -p src/app/api/briefing/\[id\]
```

- [ ] **Step 2: Criar `src/app/api/briefing/route.ts`**

```typescript
// src/app/api/briefing/route.ts
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateBriefing } from '@/lib/generateBriefing'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('tipo').eq('id', user.id).single()
  if (!profile || profile.tipo !== 'admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: { parlamentar_id?: string }
  try { body = await request.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }) }

  if (!body.parlamentar_id)
    return NextResponse.json({ error: 'parlamentar_id required' }, { status: 400 })

  const admin = createAdminClient()

  // Verificar que existem emendas para este parlamentar
  const { count: emendasCount } = await admin
    .from('emendas_parlamentares')
    .select('id', { count: 'exact', head: true })
    .eq('parlamentar_id', body.parlamentar_id)

  if (!emendasCount)
    return NextResponse.json({ error: 'Parlamentar não encontrado ou sem emendas' }, { status: 404 })

  // Dedup: impedir geração simultânea para o mesmo parlamentar
  const { count: gerando } = await admin
    .from('briefings')
    .select('id', { count: 'exact', head: true })
    .eq('parlamentar_id', body.parlamentar_id)
    .eq('status', 'gerando')

  if (gerando && gerando > 0)
    return NextResponse.json(
      { error: 'Já existe um briefing em geração para este parlamentar' },
      { status: 409 }
    )

  const { data: briefing, error } = await admin
    .from('briefings')
    .insert({
      parlamentar_id: body.parlamentar_id,
      gerado_por: user.id,
      status: 'gerando',
    })
    .select('id')
    .single()

  if (error || !briefing) {
    console.error('[POST /api/briefing] insert error:', error)
    return NextResponse.json({ error: 'Failed to create' }, { status: 500 })
  }

  generateBriefing(briefing.id, body.parlamentar_id).catch((err) =>
    console.error('[POST /api/briefing] generation error:', err)
  )

  return NextResponse.json({ id: briefing.id }, { status: 202 })
}
```

- [ ] **Step 3: Criar `src/app/api/briefing/[id]/route.ts`**

```typescript
// src/app/api/briefing/[id]/route.ts
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
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('tipo').eq('id', user.id).single()
  if (!profile || profile.tipo !== 'admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('briefings')
    .select('id, status, parlamentar_id, valor_total_emendas, valor_em_risco, pdf_url, criado_em')
    .eq('id', id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(data)
}
```

- [ ] **Step 4: TypeScript + build**

```bash
npx tsc --noEmit --skipLibCheck 2>&1 | head -5
npm run build 2>&1 | tail -15
```

Esperado: 0 erros, rotas `/api/briefing` e `/api/briefing/[id]` na tabela.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/briefing/
git commit -m "feat: add POST /api/briefing (202 async) and GET /api/briefing/[id] (status poll)"
```

---

## Task 6: Admin — lista de parlamentares

**Files:**
- Create: `src/app/admin/parlamentar/page.tsx`

O link `/admin/parlamentar` já está na sidebar. Mostra parlamentares distintos que têm emendas, com total de emendas autorizado e contagem.

- [ ] **Step 1: Criar diretório**

```bash
mkdir -p src/app/admin/parlamentar
```

- [ ] **Step 2: Criar `src/app/admin/parlamentar/page.tsx`**

```typescript
// src/app/admin/parlamentar/page.tsx
import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'

function brl(v: number) {
  return `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`
}

export default async function AdminParlamentarPage() {
  const admin = createAdminClient()

  // Agrupar emendas por parlamentar (todos os anos)
  const { data: emendas } = await admin
    .from('emendas_parlamentares')
    .select('parlamentar_id, parlamentar_nome, valor_autorizado, exercicio')
    .order('parlamentar_nome')

  if (!emendas?.length) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-slate-100 mb-4">Parlamentares</h1>
        <p className="text-slate-400 text-sm">
          Nenhuma emenda coletada ainda. Execute o scraper primeiro.
        </p>
      </div>
    )
  }

  // Agregar por parlamentar_id
  const parlamentares = new Map<
    string,
    { nome: string; totalAutorizado: number; exercicios: Set<number> }
  >()
  for (const e of emendas) {
    const existing = parlamentares.get(e.parlamentar_id)
    if (existing) {
      existing.totalAutorizado += e.valor_autorizado
      existing.exercicios.add(e.exercicio)
    } else {
      parlamentares.set(e.parlamentar_id, {
        nome: e.parlamentar_nome ?? e.parlamentar_id,
        totalAutorizado: e.valor_autorizado,
        exercicios: new Set([e.exercicio]),
      })
    }
  }

  const lista = Array.from(parlamentares.entries())
    .map(([id, data]) => ({ id, ...data }))
    .sort((a, b) => b.totalAutorizado - a.totalAutorizado)

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-100 mb-6">Parlamentares</h1>
      <div className="space-y-2">
        {lista.map((p) => (
          <Link
            key={p.id}
            href={`/admin/parlamentar/${encodeURIComponent(p.id)}`}
            className="flex items-center justify-between rounded-md border border-slate-800 bg-slate-800/40 px-5 py-4 hover:border-slate-700 hover:bg-slate-800/70 transition-colors"
          >
            <div>
              <p className="text-sm font-medium text-slate-200">{p.nome}</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {[...p.exercicios].sort().join(', ')} · {p.exercicios.size} ano(s)
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-mono text-slate-300">{brl(p.totalAutorizado)}</p>
              <p className="text-xs text-slate-500">autorizado total</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: TypeScript**

```bash
npx tsc --noEmit --skipLibCheck 2>&1 | head -5
```

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/parlamentar/page.tsx
git commit -m "feat: add admin parlamentar list page"
```

---

## Task 7: Admin — detalhe do parlamentar + BriefingForm

**Files:**
- Create: `src/app/admin/parlamentar/[id]/page.tsx`
- Create: `src/components/briefing/BriefingForm.tsx`

O `[id]` aqui é o `parlamentar_id` (string, não UUID). A página mostra resumo das emendas e histórico de briefings, com botão para gerar novo.

- [ ] **Step 1: Criar diretório**

```bash
mkdir -p "src/app/admin/parlamentar/[id]" src/components/briefing
```

- [ ] **Step 2: Criar `src/app/admin/parlamentar/[id]/page.tsx`**

```typescript
// src/app/admin/parlamentar/[id]/page.tsx
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import BriefingForm from '@/components/briefing/BriefingForm'
import type { EmendaParlamentar } from '@/types'

function brl(v: number) {
  return `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`
}

function statusBadge(status: string) {
  switch (status) {
    case 'gerando':   return 'bg-yellow-900/50 text-yellow-300 border-yellow-800'
    case 'rascunho':  return 'bg-blue-900/50 text-blue-300 border-blue-800'
    case 'entregue':  return 'bg-green-900/50 text-green-300 border-green-800'
    case 'erro':      return 'bg-red-900/50 text-red-300 border-red-800'
    default:          return 'bg-slate-700 text-slate-300 border-slate-600'
  }
}

export default async function AdminParlamentarDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const parlamentarId = decodeURIComponent(id)
  const admin = createAdminClient()

  const [{ data: emendas }, { data: briefings }] = await Promise.all([
    admin
      .from('emendas_parlamentares')
      .select('parlamentar_nome, valor_autorizado, valor_empenhado, valor_executado, area_tematica, exercicio, municipio_ibge')
      .eq('parlamentar_id', parlamentarId)
      .order('exercicio', { ascending: false }),
    admin
      .from('briefings')
      .select('id, status, valor_total_emendas, valor_em_risco, criado_em')
      .eq('parlamentar_id', parlamentarId)
      .order('criado_em', { ascending: false }),
  ])

  if (!emendas?.length) notFound()

  const parlamentarNome = (emendas as EmendaParlamentar[])[0].parlamentar_nome ?? parlamentarId
  const totalAutorizado = emendas.reduce((s, e) => s + e.valor_autorizado, 0)
  const totalExecutado = emendas.reduce((s, e) => s + e.valor_executado, 0)
  const percentual = totalAutorizado > 0 ? (totalExecutado / totalAutorizado) * 100 : 0

  return (
    <div className="max-w-3xl space-y-8">
      {/* Cabeçalho */}
      <div>
        <h1 className="text-2xl font-bold text-slate-100">{parlamentarNome}</h1>
        <p className="text-slate-400 text-xs mt-1 font-mono">{parlamentarId}</p>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-md bg-slate-800 px-4 py-3">
          <p className="text-xs text-slate-500 mb-1">Total autorizado</p>
          <p className="text-lg font-bold text-slate-100">{brl(totalAutorizado)}</p>
        </div>
        <div className="rounded-md bg-slate-800 px-4 py-3">
          <p className="text-xs text-slate-500 mb-1">Executado</p>
          <p className="text-lg font-bold text-slate-100">{percentual.toFixed(1)}%</p>
        </div>
        <div className="rounded-md bg-slate-800 px-4 py-3">
          <p className="text-xs text-slate-500 mb-1">Em risco</p>
          <p className="text-lg font-bold text-risk-high">{brl(totalAutorizado - totalExecutado)}</p>
        </div>
      </div>

      {/* Gerar novo briefing */}
      <div>
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">
          Novo Briefing
        </h2>
        <BriefingForm parlamentarId={parlamentarId} />
      </div>

      {/* Histórico de briefings */}
      {briefings && briefings.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">
            Histórico de Briefings
          </h2>
          <div className="space-y-2">
            {briefings.map((b) => (
              <Link
                key={b.id}
                href={`/admin/briefing/${b.id}`}
                className="flex items-center justify-between rounded-md bg-slate-800/50 border border-slate-800 px-4 py-3 hover:border-slate-700 transition-colors"
              >
                <div>
                  <p className="text-sm text-slate-300">
                    {new Date(b.criado_em).toLocaleDateString('pt-BR')}
                  </p>
                  {b.valor_em_risco > 0 && (
                    <p className="text-xs text-slate-500 mt-0.5">
                      {brl(b.valor_em_risco)} em risco
                    </p>
                  )}
                </div>
                <span className={`text-xs px-2 py-1 rounded-full border ${statusBadge(b.status)}`}>
                  {b.status}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Criar `src/components/briefing/BriefingForm.tsx`**

```typescript
// src/components/briefing/BriefingForm.tsx
'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { StatusBriefing } from '@/types'

interface Props {
  parlamentarId: string
}

type LocalStatus = StatusBriefing | 'idle' | 'timeout'

export default function BriefingForm({ parlamentarId }: Props) {
  const [status, setStatus] = useState<LocalStatus>('idle')
  const [briefingId, setBriefingId] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const router = useRouter()
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!briefingId) return

    const supabase = createClient()

    function cleanup() {
      channel.unsubscribe()
      if (pollRef.current) clearInterval(pollRef.current)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }

    const channel = supabase
      .channel(`briefing-${briefingId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'briefings', filter: `id=eq.${briefingId}` },
        (payload) => {
          const newStatus = (payload.new as { status: StatusBriefing }).status
          setStatus(newStatus)
          if (newStatus === 'rascunho' || newStatus === 'erro') cleanup()
        }
      )
      .subscribe()

    // NOTE: GET /api/briefing/{id} is admin-only — this component is only used in the admin panel.
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/briefing/${briefingId}`)
        if (!res.ok) return
        const data = (await res.json()) as { status: StatusBriefing }
        setStatus(data.status)
        if (data.status === 'rascunho' || data.status === 'erro') cleanup()
      } catch { /* ignora */ }
    }, 5_000)

    timeoutRef.current = setTimeout(() => {
      cleanup()
      setStatus('timeout')
    }, 120_000)

    return () => cleanup()
  }, [briefingId])

  async function handleGenerate() {
    setStatus('gerando')
    setSubmitError(null)

    try {
      const res = await fetch('/api/briefing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parlamentar_id: parlamentarId }),
      })
      if (!res.ok) {
        const body = (await res.json()) as { error: string }
        throw new Error(body.error ?? 'Erro desconhecido')
      }
      const { id } = (await res.json()) as { id: string }
      setBriefingId(id)
    } catch (err) {
      setStatus('idle')
      setSubmitError(err instanceof Error ? err.message : 'Erro ao iniciar geração')
    }
  }

  if (status === 'rascunho' && briefingId) {
    return (
      <div className="space-y-3">
        <div className="rounded-md bg-green-900/30 border border-green-700 px-4 py-3">
          <p className="text-green-300 text-sm font-medium">✓ Briefing gerado com sucesso</p>
        </div>
        <button
          onClick={() => router.push(`/admin/briefing/${briefingId}`)}
          className="rounded-md bg-nexa-600 px-4 py-2 text-sm font-semibold text-white hover:bg-nexa-700 transition-colors"
        >
          Ver Briefing →
        </button>
      </div>
    )
  }

  if (status === 'erro') {
    return (
      <div className="space-y-2">
        <div className="rounded-md bg-red-900/30 border border-red-700 px-4 py-3">
          <p className="text-red-300 text-sm">Erro na geração. Verifique os logs.</p>
        </div>
        <button onClick={() => { setStatus('idle'); setBriefingId(null) }}
          className="text-sm text-red-400 underline">Tentar novamente</button>
      </div>
    )
  }

  if (status === 'timeout') {
    return (
      <div className="space-y-2">
        <div className="rounded-md bg-yellow-900/30 border border-yellow-700 px-4 py-3">
          <p className="text-yellow-300 text-sm">Geração demorando mais que o esperado. Verifique em alguns minutos.</p>
        </div>
        {briefingId && (
          <button onClick={() => router.push(`/admin/briefing/${briefingId}`)}
            className="text-sm text-yellow-400 underline">Verificar status →</button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {submitError && (
        <div className="rounded-md bg-red-900/30 border border-red-700 px-4 py-3 text-sm text-red-300">
          {submitError}
        </div>
      )}
      <button
        onClick={handleGenerate}
        disabled={status === 'gerando'}
        className="rounded-md bg-nexa-600 px-4 py-2 text-sm font-semibold text-white hover:bg-nexa-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {status === 'gerando' ? (
          <span className="flex items-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            Gerando briefing...
          </span>
        ) : (
          'Gerar Briefing'
        )}
      </button>
      {status === 'gerando' && (
        <p className="text-xs text-slate-500">Aguardando. Isso leva 30–60 segundos.</p>
      )}
    </div>
  )
}
```

- [ ] **Step 4: TypeScript + build**

```bash
npx tsc --noEmit --skipLibCheck 2>&1 | head -5
npm run build 2>&1 | tail -15
```

Esperado: 0 erros, rota `/admin/parlamentar/[id]` na tabela.

- [ ] **Step 5: Commit**

```bash
git add "src/app/admin/parlamentar/[id]/" src/components/briefing/BriefingForm.tsx
git commit -m "feat: add admin parlamentar detail page with BriefingForm (Realtime + polling)"
```

---

## Task 8: Admin — detalhe do briefing + marcar entregue

**Files:**
- Create: `src/app/admin/briefing/[id]/page.tsx`
- Create: `src/app/admin/briefing/[id]/actions.ts`

Mesma estrutura do `admin/diagnostico/[id]`. Mostra texto IA, municípios recomendados, link PDF, botão "Marcar como Entregue".

- [ ] **Step 1: Criar diretório**

```bash
mkdir -p "src/app/admin/briefing/[id]"
```

- [ ] **Step 2: Criar `src/app/admin/briefing/[id]/actions.ts`**

```typescript
// src/app/admin/briefing/[id]/actions.ts
'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function marcarBriefingEntregue(formData: FormData) {
  const id = (formData.get('id') as string | null) ?? ''
  if (!UUID_RE.test(id)) redirect('/admin')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('tipo').eq('id', user.id).single()
  if (!profile || profile.tipo !== 'admin') redirect('/portal')

  const admin = createAdminClient()
  const { error } = await admin
    .from('briefings')
    .update({ status: 'entregue' })
    .eq('id', id)

  if (error) {
    console.error('[marcarBriefingEntregue] update failed:', error.message)
    redirect(`/admin/briefing/${id}?error=Falha+ao+atualizar+status`)
  }

  revalidatePath(`/admin/briefing/${id}`)
  revalidatePath('/portal/briefing', 'page')
}
```

- [ ] **Step 3: Criar `src/app/admin/briefing/[id]/page.tsx`**

```typescript
// src/app/admin/briefing/[id]/page.tsx
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { marcarBriefingEntregue } from './actions'
import type { MunicipioRecomendado } from '@/types'

function statusColor(status: string) {
  switch (status) {
    case 'gerando':  return 'text-yellow-400'
    case 'rascunho': return 'text-blue-400'
    case 'entregue': return 'text-green-400'
    case 'erro':     return 'text-red-400'
    default:         return 'text-slate-400'
  }
}

function brl(v: number) {
  return `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`
}

export default async function AdminBriefingPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const admin = createAdminClient()

  const { data: briefing } = await admin
    .from('briefings')
    .select('*')
    .eq('id', id)
    .single()

  if (!briefing) notFound()

  // Signed URL para PDF
  let pdfSignedUrl: string | null = null
  if (briefing.pdf_url) {
    const { data } = await admin.storage
      .from('relatorios')
      .createSignedUrl(briefing.pdf_url, 3600)
    pdfSignedUrl = data?.signedUrl ?? null
  }

  const municipios = (briefing.municipios_recomendados ?? []) as MunicipioRecomendado[]

  return (
    <div className="max-w-3xl space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Briefing Parlamentar</h1>
          <p className="text-slate-400 text-sm mt-1">
            <span className="font-mono text-xs">{briefing.parlamentar_id}</span>
            {' · '}
            Status: <span className={statusColor(briefing.status)}>{briefing.status}</span>
            {' · '}
            {new Date(briefing.criado_em).toLocaleDateString('pt-BR')}
          </p>
        </div>
        {briefing.status === 'rascunho' && (
          <form action={marcarBriefingEntregue}>
            <input type="hidden" name="id" value={id} />
            <button type="submit"
              className="rounded-md bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-600 transition-colors">
              Marcar como Entregue
            </button>
          </form>
        )}
      </div>

      {/* Números */}
      {briefing.valor_em_risco > 0 && (
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-md bg-slate-800 px-5 py-4">
            <p className="text-xs text-slate-500 mb-1">Total de emendas</p>
            <p className="text-xl font-bold text-slate-100">{brl(briefing.valor_total_emendas)}</p>
          </div>
          <div className="rounded-md bg-slate-800 px-5 py-4">
            <p className="text-xs text-slate-500 mb-1">Em risco de devolução</p>
            <p className="text-xl font-bold text-risk-high">{brl(briefing.valor_em_risco)}</p>
          </div>
        </div>
      )}

      {/* PDF */}
      {pdfSignedUrl && (
        <a href={pdfSignedUrl} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:border-slate-500 hover:text-slate-100 transition-colors">
          ↓ Baixar PDF
        </a>
      )}

      {/* Municípios recomendados */}
      {municipios.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
            Municípios Prioritários
          </h2>
          <div className="space-y-2">
            {municipios.map((m, i) => (
              <div key={m.ibge}
                className="flex items-center justify-between rounded-md bg-slate-800 px-4 py-3 text-sm">
                <div>
                  <span className="text-slate-500 mr-2 text-xs">#{i + 1}</span>
                  <span className="text-slate-300">{m.nome}</span>
                  <span className="text-slate-500 ml-2 text-xs">{m.justificativa}</span>
                </div>
                <span className="text-nexa-400 font-mono text-xs font-semibold">
                  {m.score_total}/100
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Texto IA */}
      {briefing.texto_ia && (
        <div className="rounded-md border border-slate-800 bg-slate-800/50 p-6">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
            Análise IA
          </h2>
          <p className="text-slate-300 text-sm whitespace-pre-wrap leading-relaxed">
            {briefing.texto_ia}
          </p>
        </div>
      )}

      {briefing.status === 'gerando' && (
        <div className="rounded-md bg-yellow-900/30 border border-yellow-700 px-4 py-3 text-sm text-yellow-300">
          Briefing em geração. Recarregue a página em alguns instantes.
        </div>
      )}
      {briefing.status === 'erro' && (
        <div className="rounded-md bg-red-900/30 border border-red-700 px-4 py-3 text-sm text-red-300">
          Erro na geração. Tente novamente na página do parlamentar.
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: TypeScript**

```bash
npx tsc --noEmit --skipLibCheck 2>&1 | head -5
```

- [ ] **Step 5: Commit**

```bash
git add "src/app/admin/briefing/"
git commit -m "feat: add admin briefing detail page with marcar entregue action"
```

---

## Task 9: Portal — emendas + layout update + briefings

**Files:**
- Modify: `src/app/portal/layout.tsx`
- Create: `src/app/portal/emendas/page.tsx`
- Create: `src/app/portal/briefing/page.tsx`

O portal usa server client (RLS ativo). A RLS da migration 013 permite que o parlamentar veja suas próprias emendas. A RLS da migration 002 já cobre briefings.

- [ ] **Step 1: Modificar `src/app/portal/layout.tsx` — adicionar /portal/briefing**

Ler o arquivo e adicionar no bloco de deputado/senador:

```typescript
// Adicionar import
import { LogOut, Home, FileText, Bell, TrendingDown, BookOpen } from 'lucide-react'

// No bloco getNavItems, após push de emendas:
  if (tipo === 'deputado' || tipo === 'senador') {
    base.push({ href: '/portal/emendas', label: 'Emendas', icon: TrendingDown })
    base.push({ href: '/portal/briefing', label: 'Briefing', icon: BookOpen })
  }
```

A função `getNavItems` completa deve ficar:

```typescript
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
    base.push({ href: '/portal/briefing', label: 'Briefing', icon: BookOpen })
  }
  return base
}
```

Também atualizar o import de ícones para incluir `BookOpen`.

- [ ] **Step 2: Criar `src/app/portal/emendas/page.tsx`**

```typescript
// src/app/portal/emendas/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

function brl(v: number) {
  return `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`
}

export default async function PortalEmendasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('parlamentar_id, tipo').eq('id', user.id).single()

  if (!profile?.parlamentar_id) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-slate-100 mb-4">Emendas</h1>
        <p className="text-slate-400 text-sm">
          Seu perfil não tem um ID parlamentar associado. Entre em contato com a equipe Nexa Radar.
        </p>
      </div>
    )
  }

  // RLS (migration 013) filtra pelo parlamentar_id do profile logado
  const { data: emendas } = await supabase
    .from('emendas_parlamentares')
    .select('id, area_tematica, municipio_ibge, valor_autorizado, valor_empenhado, valor_executado, percentual_execucao, exercicio, tipo')
    .order('exercicio', { ascending: false })
    .order('valor_autorizado', { ascending: false })

  const totalAutorizado = (emendas ?? []).reduce((s, e) => s + e.valor_autorizado, 0)
  const totalEmRisco = (emendas ?? []).reduce((s, e) => s + (e.valor_autorizado - e.valor_executado), 0)

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-100 mb-2">Minhas Emendas</h1>
      <p className="text-slate-400 text-sm mb-6">
        {brl(totalAutorizado)} autorizado · {brl(totalEmRisco)} em risco de devolução
      </p>

      {!emendas?.length ? (
        <p className="text-slate-400 text-sm">Nenhuma emenda coletada ainda.</p>
      ) : (
        <div className="space-y-2">
          {emendas.map((e) => (
            <div key={e.id}
              className="flex items-center justify-between rounded-md border border-slate-800 bg-slate-800/40 px-5 py-3">
              <div>
                <p className="text-sm text-slate-300">
                  {e.area_tematica ?? 'Sem área'} · {e.municipio_ibge ?? 'Nacional'}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {e.tipo} · {e.exercicio}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-mono text-slate-300">{brl(e.valor_autorizado)}</p>
                <p className="text-xs text-slate-500">{e.percentual_execucao}% executado</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Criar `src/app/portal/briefing/page.tsx`**

```typescript
// src/app/portal/briefing/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

function statusBadge(status: string) {
  switch (status) {
    case 'entregue':   return 'bg-green-900/50 text-green-300 border-green-800'
    case 'convertido': return 'bg-sky-900/50 text-sky-300 border-sky-800'
    default:           return 'bg-slate-700/50 text-slate-300 border-slate-600'
  }
}

export default async function PortalBriefingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('parlamentar_id').eq('id', user.id).single()

  if (!profile?.parlamentar_id) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-slate-100 mb-4">Briefings</h1>
        <p className="text-slate-400 text-sm">
          Perfil sem ID parlamentar. Entre em contato com a equipe Nexa Radar.
        </p>
      </div>
    )
  }

  // RLS (migration 002) garante que só vê os próprios briefings; filtro explícito por status
  const { data: briefings } = await supabase
    .from('briefings')
    .select('id, status, valor_total_emendas, valor_em_risco, criado_em')
    .in('status', ['entregue', 'convertido'])
    .order('criado_em', { ascending: false })

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-100 mb-6">Briefings</h1>
      {!briefings?.length ? (
        <p className="text-slate-400 text-sm">
          Nenhum briefing disponível ainda. Entre em contato com a equipe Nexa Radar.
        </p>
      ) : (
        <div className="space-y-3">
          {briefings.map((b) => (
            <Link key={b.id} href={`/portal/briefing/${b.id}`}
              className="block rounded-md border border-slate-800 bg-slate-800/40 px-5 py-4 hover:border-slate-700 hover:bg-slate-800/70 transition-colors">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-200">
                    {new Date(b.criado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                  </p>
                  {b.valor_em_risco > 0 && (
                    <p className="text-xs text-slate-500 mt-0.5">
                      R$ {Number(b.valor_em_risco).toLocaleString('pt-BR')} em risco identificado
                    </p>
                  )}
                </div>
                <span className={`text-xs px-2 py-1 rounded-full border ${statusBadge(b.status)}`}>
                  {b.status}
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

- [ ] **Step 4: Commit**

```bash
git add src/app/portal/layout.tsx src/app/portal/emendas/page.tsx src/app/portal/briefing/page.tsx
git commit -m "feat: add portal emendas page, portal briefing list, update portal nav"
```

---

## Task 10: Portal — detalhe do briefing + build final

**Files:**
- Create: `src/app/portal/briefing/[id]/page.tsx`

Mesma estrutura do portal/diagnostico/[id]. Bloqueia status != entregue/convertido com notFound().

- [ ] **Step 1: Criar diretório**

```bash
mkdir -p "src/app/portal/briefing/[id]"
```

- [ ] **Step 2: Criar `src/app/portal/briefing/[id]/page.tsx`**

```typescript
// src/app/portal/briefing/[id]/page.tsx
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { MunicipioRecomendado } from '@/types'

function brl(v: number) {
  return `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`
}

export default async function PortalBriefingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  // RLS (migration 002) garante que só acessa o próprio briefing
  const { data: briefing } = await supabase
    .from('briefings')
    .select('id,status,parlamentar_id,valor_total_emendas,valor_em_risco,municipios_recomendados,texto_ia,pdf_url,criado_em')
    .eq('id', id)
    .single()

  if (!briefing) notFound()
  if (briefing.status === 'rascunho' || briefing.status === 'gerando' || briefing.status === 'erro') notFound()

  const municipios = Array.isArray(briefing.municipios_recomendados)
    ? (briefing.municipios_recomendados as MunicipioRecomendado[])
    : []

  // Signed URL via user client — storage RLS (migration 008) valida o acesso por parlamentar_id
  let pdfSignedUrl: string | null = null
  if (briefing.pdf_url) {
    const { data, error: storageErr } = await supabase.storage
      .from('relatorios')
      .createSignedUrl(briefing.pdf_url, 3600)
    if (storageErr) console.error('[portal/briefing] signed URL failed:', storageErr.message)
    pdfSignedUrl = data?.signedUrl ?? null
  }

  return (
    <div className="max-w-3xl space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Briefing Parlamentar</h1>
          <p className="text-slate-400 text-sm mt-1">
            Gerado em{' '}
            {new Date(briefing.criado_em).toLocaleDateString('pt-BR', {
              day: '2-digit', month: 'long', year: 'numeric',
            })}
          </p>
        </div>
        {pdfSignedUrl && (
          <a href={pdfSignedUrl} target="_blank" rel="noopener noreferrer"
            className="flex-shrink-0 rounded-md border border-nexa-700 px-4 py-2 text-sm text-nexa-400 hover:bg-nexa-900/20 transition-colors">
            ↓ Baixar PDF
          </a>
        )}
      </div>

      {/* Números */}
      {briefing.valor_em_risco > 0 && (
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-md bg-slate-800 px-5 py-4">
            <p className="text-xs text-slate-500 mb-1">Total de emendas</p>
            <p className="text-2xl font-bold text-slate-100">{brl(briefing.valor_total_emendas)}</p>
          </div>
          <div className="rounded-md bg-slate-800 px-5 py-4">
            <p className="text-xs text-slate-500 mb-1">Em risco de devolução</p>
            <p className="text-2xl font-bold text-risk-high">{brl(briefing.valor_em_risco)}</p>
          </div>
        </div>
      )}

      {/* Municípios prioritários */}
      {municipios.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
            Municípios Prioritários
          </h2>
          <div className="space-y-2">
            {municipios.map((m, i) => (
              <div key={m.ibge}
                className="flex items-center justify-between rounded-md bg-slate-800 px-4 py-3 text-sm">
                <div>
                  <span className="text-slate-500 mr-2 text-xs">#{i + 1}</span>
                  <span className="text-slate-300">{m.nome}</span>
                  <span className="text-slate-500 ml-2 text-xs">{m.justificativa}</span>
                </div>
                <span className="text-nexa-400 font-mono text-xs font-semibold">
                  {m.score_total}/100
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Análise IA */}
      {briefing.texto_ia && (
        <div className="rounded-md border border-slate-800 bg-slate-800/50 p-6">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
            Análise e Recomendações
          </h2>
          <p className="text-slate-300 text-sm whitespace-pre-wrap leading-relaxed">
            {briefing.texto_ia}
          </p>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: TypeScript**

```bash
npx tsc --noEmit --skipLibCheck 2>&1 | head -5
```

Esperado: 0 erros.

- [ ] **Step 4: Build final**

```bash
npm run build 2>&1 | tail -25
```

Esperado: tabela de rotas incluindo todas as novas — `/admin/parlamentar`, `/admin/parlamentar/[id]`, `/admin/briefing/[id]`, `/api/briefing`, `/api/briefing/[id]`, `/portal/emendas`, `/portal/briefing`, `/portal/briefing/[id]` — sem erros.

- [ ] **Step 5: Rodar todos os testes**

```bash
npm test 2>&1 | tail -8
python3 -m pytest scraper/tests/ -q 2>&1 | tail -4
```

Esperado: todos os testes passam.

- [ ] **Step 6: Commit final**

```bash
git add "src/app/portal/briefing/[id]/"
git commit -m "feat: add portal briefing detail page (signed URL, RLS-scoped)"
```

---

## Validação Final do Plano 2c

- [ ] `npm run build` sem erros TypeScript
- [ ] `npm test` — todos os testes passam (23+ frontend, incluindo 9 novos de briefing)
- [ ] `python3 -m pytest scraper/tests/ -q` — 33 testes passam
- [ ] Admin consegue ver lista de parlamentares em `/admin/parlamentar`
- [ ] Admin consegue gerar briefing e ver status em tempo real
- [ ] Admin pode marcar briefing como "Entregue"
- [ ] Portal deputado/senador vê nav com "Emendas" e "Briefing"
- [ ] Portal emendas lista emendas do parlamentar logado
- [ ] Portal briefing lista apenas entregues/convertidos
- [ ] Portal briefing detail bloqueia rascunho com notFound

**Fluxo de teste manual** (requer `ANTHROPIC_API_KEY` real + emendas na base):
1. Rodar scraper SIGA Brasil para um ano: `python3 -m scraper.run`
2. Login como admin → `/admin/parlamentar` — lista parlamentares
3. Clicar em um parlamentar → `/admin/parlamentar/{id}`
4. Clicar "Gerar Briefing" → aguardar 30-60s
5. Ver resultado → clicar "Marcar como Entregue"
6. Criar usuário portal com parlamentar_id = o mesmo ID → verificar portal

**Próximo:** O produto MVP está completo com M2 (Diagnóstico Municipal) + M5 simplificado (Briefing Parlamentar).
