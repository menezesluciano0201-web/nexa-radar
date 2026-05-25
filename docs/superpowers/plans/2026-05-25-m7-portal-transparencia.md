# M7 — Portal de Transparência Municipal — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir portal público de transparência municipal (showcase político) — `/p/{uf}/{slug}` brandable por município, com cards de publicações, KPIs agregados, fotos e mapa de execução. CRUD admin completo. 100% manual via painel (sem dependência de M6).

**Architecture:** Página pública SSR com ISR (revalidate 5min + on-demand pelo admin), React `cache()` para dedup entre `generateMetadata` e a page, `Promise.all` para 3 queries paralelas (branding + KPIs + publicações). Mapa via `react-leaflet` render-conditional. Bucket `portal-fotos` PÚBLICO (CDN do Supabase, sem signed URL). Admin via `requireAdminClient` + server actions com `revalidatePath`.

**Tech Stack:** Next.js 15 App Router, TypeScript strict, `react-leaflet` + OpenStreetMap, @supabase/ssr, Supabase Storage (público), Vitest. Sem novas dependências de IA.

**Pré-requisitos:** Plans M1-M3 + recovery flow já em main. Sem deps externas além do `react-leaflet` + `leaflet` (instalado na Task 8).

**Spec de referência:** `docs/superpowers/specs/2026-05-25-m7-portal-transparencia-design.md` (após 3 rodadas de review)

---

## Mapa de Arquivos

| Arquivo | Responsabilidade |
|---|---|
| `supabase/migrations/027_portal_transparencia.sql` | Slug em municipios_habilitacao, expansão de publicacoes_portal, branding, kpi, bucket portal-fotos, RLS |
| `next.config.ts` | MERGE: adicionar `images.remotePatterns` + atualizar CSP `img-src` |
| `src/types/index.ts` | Tipos `PublicacaoPortal`, `MunicipioBranding`, `KpiPortal`, `Entity` se aplicável |
| `src/lib/slug.ts` | `slugifyMunicipio(nome): string` |
| `src/lib/portal.ts` | `ordenarKpis(kpis): (KpiPortal\|null)[4]`, `gerarUrlShare(uf, slug, pubId?): string` |
| `src/lib/upload.ts` | `validarFotoUpload(file, tipo): ValidationResult` |
| `src/lib/__tests__/slug.test.ts` | TDD slugifyMunicipio |
| `src/lib/__tests__/portal.test.ts` | TDD ordenarKpis + gerarUrlShare |
| `src/lib/__tests__/upload.test.ts` | TDD validarFotoUpload |
| `src/lib/portal-data.ts` | `getPortalData(uf, slug)` com `cache()` + `Promise.all` |
| `src/app/p/[uf]/[slug]/page.tsx` | Server: metadata + layout do portal público |
| `src/components/portal/PortalHeader.tsx` | Header brandable (logo + nome + gestão, cor primária) |
| `src/components/portal/PortalHero.tsx` | Hero + última atualização |
| `src/components/portal/KpiBlock.tsx` | Grid 4 cards de KPI |
| `src/components/portal/MapaExecucao.tsx` | Mapa Leaflet (client, dynamic) |
| `src/components/portal/CardsGrid.tsx` | Grid de cards de publicações |
| `src/components/portal/PublicacaoModal.tsx` | Modal com carrossel + share + hash auto-open |
| `src/components/portal/PortalFooter.tsx` | Rodapé com brasão + Powered by Nexa |
| `src/middleware.ts` | MODIFICAR: liberar `/p/` como rota pública |
| `src/app/admin/portal/page.tsx` | Lista geral de portais (todos os municípios habilitados) |
| `src/app/admin/portal/[ibge]/page.tsx` | Gestão de UM município (3 abas) |
| `src/app/admin/portal/[ibge]/actions.ts` | Server actions: branding/KPI CRUD + togglePublicacao + habilitarMunicipio |
| `src/app/admin/portal/[ibge]/publicacao/[id]/page.tsx` | Editor de publicação (form + upload) |
| `src/app/admin/portal/[ibge]/publicacao/[id]/actions.ts` | Server actions: savePublicacao + uploadFoto + removeFoto + deletePublicacao |
| `src/app/admin/layout.tsx` | MODIFICAR: link "Portal" com ícone Globe |
| `public/og-default.png` | Fallback OpenGraph (1200×630, brand Nexa) |

---

## Task 1: Migration — schema completo do portal

**Files:**
- Create: `supabase/migrations/027_portal_transparencia.sql`

> **Atenção: ordem da migration importa** — backfill + resolução de colisões antes do UNIQUE INDEX. Inverter quebra em municípios homônimos.

- [ ] **Step 1: Criar bucket portal-fotos via SQL DDL**

O bucket é criado via INSERT em `storage.buckets` (mesmo pattern do M3). Como o MCP não expõe `create_bucket` separado, vai dentro da migration.

- [ ] **Step 2: Criar migration `supabase/migrations/027_portal_transparencia.sql`**

```sql
-- 027_portal_transparencia.sql
-- M7 — Portal de Transparência Municipal
-- Adiciona: slug em municipios_habilitacao, expande publicacoes_portal,
--          cria municipios_branding + municipios_kpi_portal,
--          bucket portal-fotos público + RLS.

-- ════════════════════════════════════════════════════════════════
-- BUCKET STORAGE
-- ════════════════════════════════════════════════════════════════

INSERT INTO storage.buckets (id, name, public)
VALUES ('portal-fotos', 'portal-fotos', true)
ON CONFLICT (id) DO NOTHING;

-- Admin pode escrever no bucket. Leitura é pública (bucket público).
CREATE POLICY "portal_fotos_admin_write" ON storage.objects FOR ALL TO authenticated
USING (
  bucket_id = 'portal-fotos'
  AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND tipo = 'admin')
);

-- ════════════════════════════════════════════════════════════════
-- SLUG em municipios_habilitacao
-- ════════════════════════════════════════════════════════════════

ALTER TABLE municipios_habilitacao ADD COLUMN slug text;

-- Backfill: slugify(unaccent(lower(nome)))
UPDATE municipios_habilitacao
  SET slug = NULLIF(trim(both '-' from regexp_replace(
    translate(lower(nome),
      'áàâãäéèêëíìîïóòôõöúùûüçñ',
      'aaaaaeeeeiiiiooooouuuucn'),
    '[^a-z0-9]+', '-', 'g'
  )), '');

-- Fallback para nomes que sanitizam vazio (LC 14/1973 garante nomes alfabéticos,
-- então isso só dispara em data bug — preserva linha sem quebrar).
UPDATE municipios_habilitacao SET slug = ibge WHERE slug IS NULL;

-- Resolver colisões (mesmo UF + slugs iguais) com sufixo -2, -3, etc.
WITH ranked AS (
  SELECT ibge, slug, uf,
    ROW_NUMBER() OVER (PARTITION BY uf, slug ORDER BY ibge) AS rn
  FROM municipios_habilitacao
)
UPDATE municipios_habilitacao m
  SET slug = m.slug || '-' || ranked.rn
FROM ranked
WHERE m.ibge = ranked.ibge AND ranked.rn > 1;

CREATE UNIQUE INDEX municipios_habilitacao_uf_slug_unique
  ON municipios_habilitacao (uf, slug);

ALTER TABLE municipios_habilitacao ALTER COLUMN slug SET NOT NULL;

-- ════════════════════════════════════════════════════════════════
-- EXPANSÃO de publicacoes_portal
-- ════════════════════════════════════════════════════════════════

ALTER TABLE publicacoes_portal
  ADD COLUMN descricao text,
  ADD COLUMN valor_destaque text,
  ADD COLUMN fotos jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN lat numeric,
  ADD COLUMN lng numeric,
  ADD COLUMN data_evento date;

-- SELECT público (anônimos veem apenas ativo=true).
-- Policy existente para 'authenticated' continua válida.
CREATE POLICY publicacoes_select_public ON publicacoes_portal FOR SELECT TO anon
  USING (ativo = true);

-- ════════════════════════════════════════════════════════════════
-- TABELA municipios_branding
-- ════════════════════════════════════════════════════════════════

CREATE TABLE municipios_branding (
  municipio_ibge   text PRIMARY KEY REFERENCES municipios_habilitacao(ibge),
  logo_url         text,
  brasao_url       text,
  cor_primaria     text DEFAULT '#0284c7',  -- nexa-600
  prefeito_nome    text,
  prefeito_gestao  text,
  atualizado_em    timestamptz NOT NULL DEFAULT now(),
  atualizado_por   uuid REFERENCES auth.users(id)
);

ALTER TABLE municipios_branding ENABLE ROW LEVEL SECURITY;

CREATE POLICY branding_select_public ON municipios_branding FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY branding_admin_all ON municipios_branding FOR ALL TO authenticated
  USING (_user_tipo() = 'admin');

-- ════════════════════════════════════════════════════════════════
-- TABELA municipios_kpi_portal
-- ════════════════════════════════════════════════════════════════

CREATE TABLE municipios_kpi_portal (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  municipio_ibge  text NOT NULL REFERENCES municipios_habilitacao(ibge),
  ordem           int NOT NULL CHECK (ordem BETWEEN 1 AND 4),
  label           text NOT NULL,
  valor           text NOT NULL,
  sufixo          text,
  UNIQUE (municipio_ibge, ordem)
);

ALTER TABLE municipios_kpi_portal ENABLE ROW LEVEL SECURITY;

CREATE POLICY kpi_select_public ON municipios_kpi_portal FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY kpi_admin_all ON municipios_kpi_portal FOR ALL TO authenticated
  USING (_user_tipo() = 'admin');
```

- [ ] **Step 3: Aplicar via Supabase MCP**

Aplicar o conteúdo do arquivo via `mcp__plugin_supabase_supabase__apply_migration` (name: `027_portal_transparencia`, project_id: `sfzuoqnzdhknmqtprfly`).

- [ ] **Step 4: Verificação**

Rodar SQL para confirmar:
```sql
SELECT 'col_slug' AS kind, column_name FROM information_schema.columns
  WHERE table_name='municipios_habilitacao' AND column_name='slug'
UNION ALL
SELECT 'col_fotos', column_name FROM information_schema.columns
  WHERE table_name='publicacoes_portal' AND column_name='fotos'
UNION ALL
SELECT 'table_branding', table_name FROM information_schema.tables
  WHERE table_name='municipios_branding'
UNION ALL
SELECT 'table_kpi', table_name FROM information_schema.tables
  WHERE table_name='municipios_kpi_portal'
UNION ALL
SELECT 'bucket', id FROM storage.buckets WHERE id='portal-fotos'
UNION ALL
SELECT 'idx_slug', indexname FROM pg_indexes
  WHERE indexname='municipios_habilitacao_uf_slug_unique'
UNION ALL
SELECT 'slug_lagarto', slug FROM municipios_habilitacao WHERE ibge='2803500';
```

Esperado: 7 linhas, incluindo `slug_lagarto = lagarto`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/027_portal_transparencia.sql
git commit -m "feat: M7 schema — slug + portal tables + bucket + RLS

- slug column em municipios_habilitacao (backfill + collision resolution
  + UNIQUE INDEX em (uf, slug)) com fallback ibge p/ casos vazios
- expansao de publicacoes_portal: descricao, valor_destaque, fotos jsonb,
  lat/lng, data_evento + SELECT policy publica para ativo=true
- municipios_branding (PK ibge, logo/brasao/cor/prefeito)
- municipios_kpi_portal (4 slots por municipio)
- bucket portal-fotos publico + storage policy admin-only para escrita

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 2: `src/lib/slug.ts` (TDD)

**Files:**
- Create: `src/lib/__tests__/slug.test.ts`
- Create: `src/lib/slug.ts`

A função TS deve produzir o mesmo slug que o backfill SQL (mesma logica de translate + trim + fallback ibge).

- [ ] **Step 1: Criar testes ANTES da implementação**

```typescript
// src/lib/__tests__/slug.test.ts
import { describe, test, expect } from 'vitest'
import { slugifyMunicipio } from '@/lib/slug'

describe('slugifyMunicipio', () => {
  test('lowercase simples', () => {
    expect(slugifyMunicipio('Lagarto', '2803500')).toBe('lagarto')
  })

  test('remove acentos comuns', () => {
    expect(slugifyMunicipio('São Paulo', '3550308')).toBe('sao-paulo')
    expect(slugifyMunicipio('Cuité', '2505907')).toBe('cuite')
    expect(slugifyMunicipio('Tatuí', '3553609')).toBe('tatui')
    expect(slugifyMunicipio('Iguaçu', '0000000')).toBe('iguacu')
    expect(slugifyMunicipio('Ñunoa', '0000000')).toBe('nunoa')
  })

  test('espaços viram hífen único', () => {
    expect(slugifyMunicipio('Rio de Janeiro', '3304557')).toBe('rio-de-janeiro')
    expect(slugifyMunicipio('São José dos Campos', '3549904')).toBe('sao-jose-dos-campos')
  })

  test('caracteres especiais viram hífen', () => {
    expect(slugifyMunicipio("D'Ávila", '0000000')).toBe('d-avila')
    expect(slugifyMunicipio('Senador Sá', '0000000')).toBe('senador-sa')
  })

  test('trim de hífens nas bordas', () => {
    expect(slugifyMunicipio('-Lagarto-', '2803500')).toBe('lagarto')
  })

  test('fallback ibge quando string sanitiza vazio', () => {
    expect(slugifyMunicipio('', '2803500')).toBe('2803500')
    expect(slugifyMunicipio('---', '2803500')).toBe('2803500')
    expect(slugifyMunicipio('!@#$', '2803500')).toBe('2803500')
  })
})
```

- [ ] **Step 2: Rodar testes — esperado FAIL (TDD red)**

```bash
npm test -- slug.test 2>&1 | tail -5
```

Esperado: erro de import (`Cannot find module '@/lib/slug'`).

- [ ] **Step 3: Criar `src/lib/slug.ts`**

```typescript
// src/lib/slug.ts
// Espelha a lógica do backfill SQL em 027_portal_transparencia.sql.
// Usado no admin ao habilitar novo município. Mantém slug pré-existente
// no banco — só recalcula se o admin pedir explicitamente.

const ACCENT_MAP: Record<string, string> = {
  á: 'a', à: 'a', â: 'a', ã: 'a', ä: 'a',
  é: 'e', è: 'e', ê: 'e', ë: 'e',
  í: 'i', ì: 'i', î: 'i', ï: 'i',
  ó: 'o', ò: 'o', ô: 'o', õ: 'o', ö: 'o',
  ú: 'u', ù: 'u', û: 'u', ü: 'u',
  ç: 'c', ñ: 'n',
}

export function slugifyMunicipio(nome: string, ibgeFallback: string): string {
  const lower = nome.toLowerCase()
  const noAccents = lower.replace(/[áàâãäéèêëíìîïóòôõöúùûüçñ]/g, (c) => ACCENT_MAP[c] ?? c)
  const slug = noAccents.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return slug || ibgeFallback
}
```

- [ ] **Step 4: Rodar testes — esperado PASS**

```bash
npm test -- slug.test 2>&1 | tail -10
```

Esperado: todos passando.

- [ ] **Step 5: Commit**

```bash
git add src/lib/slug.ts src/lib/__tests__/slug.test.ts
git commit -m "feat: add slugifyMunicipio with TDD (matches SQL backfill logic)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 3: `src/lib/portal.ts` (TDD)

**Files:**
- Create: `src/lib/__tests__/portal.test.ts`
- Create: `src/lib/portal.ts`

Duas funções puras: `ordenarKpis` (preenche slots vazios com null para a UI saber qual está vazio) e `gerarUrlShare` (URL absoluta para share, com hash opcional `#pub-{id}`).

- [ ] **Step 1: Criar testes ANTES da implementação**

```typescript
// src/lib/__tests__/portal.test.ts
import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import { ordenarKpis, gerarUrlShare } from '@/lib/portal'
import type { KpiPortal } from '@/types'

function kpi(ordem: number, label: string, valor: string): KpiPortal {
  return { id: `k-${ordem}`, municipio_ibge: '2803500', ordem, label, valor, sufixo: null }
}

describe('ordenarKpis', () => {
  test('retorna 4 slots — preenche faltantes com null', () => {
    const result = ordenarKpis([kpi(2, 'B', '20'), kpi(4, 'D', '40')])
    expect(result).toHaveLength(4)
    expect(result[0]).toBeNull()
    expect(result[1]?.label).toBe('B')
    expect(result[2]).toBeNull()
    expect(result[3]?.label).toBe('D')
  })

  test('ordena por ordem ascendente mesmo se vier embaralhado', () => {
    const result = ordenarKpis([kpi(3, 'C', '30'), kpi(1, 'A', '10')])
    expect(result[0]?.label).toBe('A')
    expect(result[2]?.label).toBe('C')
  })

  test('lista vazia retorna 4 nulls', () => {
    expect(ordenarKpis([])).toEqual([null, null, null, null])
  })

  test('ignora kpis com ordem fora de 1-4', () => {
    const result = ordenarKpis([kpi(0, 'X', '0'), kpi(5, 'Y', '50'), kpi(2, 'B', '20')])
    expect(result[1]?.label).toBe('B')
    expect(result.filter(x => x !== null)).toHaveLength(1)
  })
})

describe('gerarUrlShare', () => {
  const originalEnv = process.env.NEXT_PUBLIC_SITE_URL

  beforeEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://nexaradar.com.br'
  })

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.NEXT_PUBLIC_SITE_URL
    else process.env.NEXT_PUBLIC_SITE_URL = originalEnv
  })

  test('URL completa sem pubId', () => {
    expect(gerarUrlShare('se', 'lagarto')).toBe('https://nexaradar.com.br/p/se/lagarto')
  })

  test('URL com hash de publicação', () => {
    expect(gerarUrlShare('se', 'lagarto', 'abc-123')).toBe('https://nexaradar.com.br/p/se/lagarto#pub-abc-123')
  })

  test('fallback localhost quando env não setada', () => {
    delete process.env.NEXT_PUBLIC_SITE_URL
    expect(gerarUrlShare('se', 'lagarto')).toBe('http://localhost:3000/p/se/lagarto')
  })

  test('UF é minúscula no path', () => {
    expect(gerarUrlShare('SE', 'lagarto')).toBe('https://nexaradar.com.br/p/se/lagarto')
  })
})
```

- [ ] **Step 2: Rodar testes — FAIL**

```bash
npm test -- portal.test 2>&1 | tail -5
```

- [ ] **Step 3: Criar `src/lib/portal.ts`**

```typescript
// src/lib/portal.ts
import type { KpiPortal } from '@/types'

export function ordenarKpis(kpis: KpiPortal[]): (KpiPortal | null)[] {
  const slots: (KpiPortal | null)[] = [null, null, null, null]
  for (const k of kpis) {
    if (k.ordem >= 1 && k.ordem <= 4) {
      slots[k.ordem - 1] = k
    }
  }
  return slots
}

export function gerarUrlShare(uf: string, slug: string, pubId?: string): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  const path = `/p/${uf.toLowerCase()}/${slug}`
  return pubId ? `${base}${path}#pub-${pubId}` : `${base}${path}`
}
```

- [ ] **Step 4: Rodar testes — PASS**

```bash
npm test -- portal.test 2>&1 | tail -10
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/portal.ts src/lib/__tests__/portal.test.ts
git commit -m "feat: add ordenarKpis + gerarUrlShare with TDD

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 4: `src/lib/upload.ts` (TDD)

**Files:**
- Create: `src/lib/__tests__/upload.test.ts`
- Create: `src/lib/upload.ts`

Validação client-side dos uploads. `tipo` determina mime types aceitos (`logo`/`brasao` aceita SVG, `publicacao` só raster).

- [ ] **Step 1: Criar testes**

```typescript
// src/lib/__tests__/upload.test.ts
import { describe, test, expect } from 'vitest'
import { validarFotoUpload } from '@/lib/upload'

function file(name: string, type: string, sizeKb: number): File {
  const blob = new Blob(['x'.repeat(sizeKb * 1024)], { type })
  return new File([blob], name, { type })
}

describe('validarFotoUpload', () => {
  test('PNG dentro do limite válido para publicação', () => {
    expect(validarFotoUpload(file('a.png', 'image/png', 1000), 'publicacao').valid).toBe(true)
  })

  test('JPEG dentro do limite válido para publicação', () => {
    expect(validarFotoUpload(file('a.jpg', 'image/jpeg', 1000), 'publicacao').valid).toBe(true)
  })

  test('WEBP dentro do limite válido para publicação', () => {
    expect(validarFotoUpload(file('a.webp', 'image/webp', 1000), 'publicacao').valid).toBe(true)
  })

  test('SVG REJEITADO em publicacao', () => {
    const r = validarFotoUpload(file('a.svg', 'image/svg+xml', 100), 'publicacao')
    expect(r.valid).toBe(false)
    expect(r.erro).toMatch(/SVG não permitido/)
  })

  test('SVG aceito em logo', () => {
    expect(validarFotoUpload(file('a.svg', 'image/svg+xml', 100), 'logo').valid).toBe(true)
  })

  test('SVG aceito em brasão', () => {
    expect(validarFotoUpload(file('a.svg', 'image/svg+xml', 100), 'brasao').valid).toBe(true)
  })

  test('rejeita acima de 5MB', () => {
    const r = validarFotoUpload(file('a.png', 'image/png', 6000), 'publicacao')
    expect(r.valid).toBe(false)
    expect(r.erro).toMatch(/5MB/)
  })

  test('rejeita mime type não permitido', () => {
    const r = validarFotoUpload(file('a.pdf', 'application/pdf', 100), 'publicacao')
    expect(r.valid).toBe(false)
    expect(r.erro).toMatch(/tipo/i)
  })
})
```

- [ ] **Step 2: Rodar — FAIL**

```bash
npm test -- upload.test 2>&1 | tail -5
```

- [ ] **Step 3: Criar `src/lib/upload.ts`**

```typescript
// src/lib/upload.ts
const MAX_BYTES = 5 * 1024 * 1024  // 5MB
const RASTER_MIMES = ['image/png', 'image/jpeg', 'image/webp']
const VECTOR_MIMES = ['image/svg+xml']

export type TipoUpload = 'logo' | 'brasao' | 'publicacao'

export interface ValidationResult {
  valid: boolean
  erro?: string
}

export function validarFotoUpload(file: File, tipo: TipoUpload): ValidationResult {
  if (file.size > MAX_BYTES) {
    return { valid: false, erro: `Arquivo excede o limite de 5MB (atual: ${(file.size / 1024 / 1024).toFixed(1)}MB)` }
  }

  const aceitos = tipo === 'publicacao' ? RASTER_MIMES : [...RASTER_MIMES, ...VECTOR_MIMES]

  if (!aceitos.includes(file.type)) {
    if (file.type === 'image/svg+xml' && tipo === 'publicacao') {
      return { valid: false, erro: 'SVG não permitido em fotos de publicação (somente PNG/JPEG/WEBP)' }
    }
    return { valid: false, erro: `Tipo de arquivo não permitido: ${file.type}` }
  }

  return { valid: true }
}
```

- [ ] **Step 4: Rodar — PASS**

```bash
npm test -- upload.test 2>&1 | tail -10
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/upload.ts src/lib/__tests__/upload.test.ts
git commit -m "feat: add validarFotoUpload with TDD (size + mime by tipo)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 5: Tipos do portal em `src/types/index.ts`

**Files:**
- Modify: `src/types/index.ts`

Adicionar APPEND ao final do arquivo (não remover/modificar tipos existentes).

- [ ] **Step 1: Adicionar tipos**

Adicionar ao final de `src/types/index.ts`:

```typescript
// ─── M7 Portal de Transparência ──────────────────────────────────

export interface MunicipioBranding {
  municipio_ibge: string
  logo_url: string | null
  brasao_url: string | null
  cor_primaria: string  // hex, default '#0284c7'
  prefeito_nome: string | null
  prefeito_gestao: string | null
  atualizado_em: string
  atualizado_por: string | null
}

export interface KpiPortal {
  id: string
  municipio_ibge: string
  ordem: number  // 1..4
  label: string
  valor: string
  sufixo: string | null
}

export interface PublicacaoFoto {
  url: string
  alt: string
  ordem: number
}

export interface PublicacaoPortal {
  id: string
  municipio_ibge: string
  aprovado_por: string
  titulo: string
  descricao: string | null
  valor_destaque: string | null
  fotos: PublicacaoFoto[]
  lat: number | null
  lng: number | null
  data_evento: string | null
  resumo_execucao: Record<string, unknown>
  publicado_em: string
  ativo: boolean
}
```

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit --skipLibCheck 2>&1 | grep -E "error TS" | head -5
```

Esperado: zero erros novos.

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add M7 portal types (MunicipioBranding, KpiPortal, PublicacaoPortal)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 6: `next.config.ts` — MERGE de `images.remotePatterns` + CSP

**Files:**
- Modify: `next.config.ts`

> **CRÍTICO:** este é um MERGE, NÃO uma substituição. O arquivo atual tem `experimental`, `headers()` e a const `securityHeaders`. NÃO apague nada.

- [ ] **Step 1: Ler o arquivo atual e identificar pontos de edição**

```bash
grep -n "images\|securityHeaders\|img-src" next.config.ts
```

Esperado: ver a const `securityHeaders` com a linha `"img-src 'self' data: blob:"` e confirmar que NÃO existe `images:` configurado no topo do objeto config.

- [ ] **Step 2: Editar a linha do CSP `img-src`**

Localizar a linha exata `"img-src 'self' data: blob:",` dentro da const `securityHeaders` e substituir por:

```
"img-src 'self' data: blob: https://*.supabase.co",
```

> Por que `*.supabase.co` (wildcard): o hostname varia entre branches/preview deploys; wildcard mantém o CSP funcional sem regerar a string a cada ambiente.

- [ ] **Step 3: Adicionar guard de env + bloco `images` no config**

Localizar a `const nextConfig: NextConfig = { ... }` e adicionar IMEDIATAMENTE ACIMA dela:

```typescript
// Guard explícito: build falha ruidosamente se a env não estiver setada,
// em vez de quebrar runtime com "Invalid URL" sem rastro de causa.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
if (!supabaseUrl) throw new Error('NEXT_PUBLIC_SUPABASE_URL is required for images.remotePatterns')
const supabaseHost = new URL(supabaseUrl).hostname
```

Dentro do objeto `nextConfig`, adicionar a chave `images` (não substituir nada — coexiste com `experimental` e `async headers()`):

```typescript
images: {
  remotePatterns: [
    {
      protocol: 'https',
      hostname: supabaseHost,
      pathname: '/storage/v1/object/public/portal-fotos/**',
    },
  ],
},
```

- [ ] **Step 4: Verificar — build limpo**

```bash
npm run build 2>&1 | tail -25
```

Esperado: build completa sem erro de "Invalid URL" e sem erro de tipos.

- [ ] **Step 5: Verificar CSP no dev server**

```bash
PID=$(lsof -i :3000 -t 2>/dev/null | head -1); [ -n "$PID" ] && kill "$PID" 2>/dev/null
rm -rf .next
nohup npm run dev > /tmp/nexa-dev.log 2>&1 &
sleep 18
curl -sI http://localhost:3000/login | grep -i "content-security"
```

Esperado: o header inclui `img-src 'self' data: blob: https://*.supabase.co`.

- [ ] **Step 6: Commit**

```bash
git add next.config.ts
git commit -m "fix: M7 — images.remotePatterns + CSP img-src para Supabase Storage

Sem isso, fotos do bucket portal-fotos seriam bloqueadas em produção
pelo CSP existente (img-src 'self' data: blob:) e o <Image> do Next.js
nao otimizaria URLs externas sem remotePatterns configurado.

Hostname derivado de NEXT_PUBLIC_SUPABASE_URL com guard explicito.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 7: `src/lib/portal-data.ts` — fetch unificado com `cache()`

**Files:**
- Create: `src/lib/portal-data.ts`

Resolve `(uf, slug) → ibge` primeiro; depois `Promise.all` dos 3 fetches independentes (branding + KPIs + publicações ativas). Wrappado em `cache()` do React para `generateMetadata` e a page compartilharem o resultado dentro de uma mesma render pass.

- [ ] **Step 1: Criar `src/lib/portal-data.ts`**

```typescript
// src/lib/portal-data.ts
import 'server-only'
import { cache } from 'react'
import { createAdminClient } from '@/lib/supabase/admin'
import type { MunicipioBranding, KpiPortal, PublicacaoPortal } from '@/types'

export interface MunicipioInfo {
  ibge: string
  nome: string
  uf: string
  slug: string
}

export interface PortalData {
  municipio: MunicipioInfo
  branding: MunicipioBranding | null
  kpis: KpiPortal[]
  publicacoes: PublicacaoPortal[]
}

// React cache() deduplica entre generateMetadata e a page render
// dentro do mesmo request. Combinado com revalidate=300 (ISR), o fetch
// real do banco roda 1x a cada 5min por (uf, slug).
export const getPortalData = cache(async (uf: string, slug: string): Promise<PortalData | null> => {
  const supabase = createAdminClient()

  const { data: municipio, error: muniErr } = await supabase
    .from('municipios_habilitacao')
    .select('ibge, nome, uf, slug')
    .eq('uf', uf.toUpperCase())
    .eq('slug', slug)
    .single()

  if (muniErr || !municipio) return null

  const [brandingRes, kpisRes, pubsRes] = await Promise.all([
    supabase
      .from('municipios_branding')
      .select('*')
      .eq('municipio_ibge', municipio.ibge)
      .maybeSingle(),
    supabase
      .from('municipios_kpi_portal')
      .select('*')
      .eq('municipio_ibge', municipio.ibge)
      .order('ordem'),
    supabase
      .from('publicacoes_portal')
      .select('*')
      .eq('municipio_ibge', municipio.ibge)
      .eq('ativo', true)
      .order('publicado_em', { ascending: false })
      .limit(60),
  ])

  return {
    municipio: municipio as MunicipioInfo,
    branding: (brandingRes.data as MunicipioBranding | null) ?? null,
    kpis: (kpisRes.data as KpiPortal[] | null) ?? [],
    publicacoes: (pubsRes.data as PublicacaoPortal[] | null) ?? [],
  }
})
```

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit --skipLibCheck 2>&1 | grep portal-data | head -5
```

Esperado: vazio.

- [ ] **Step 3: Commit**

```bash
git add src/lib/portal-data.ts
git commit -m "feat: M7 — getPortalData with React cache() + Promise.all

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 8: Instalar `react-leaflet` + componente `MapaExecucao`

**Files:**
- Modify: `package.json` (via npm install)
- Create: `src/components/portal/MapaExecucao.tsx`

> Render-conditional: o parent só renderiza `<MapaExecucao>` se houver pelo menos uma publicação com lat/lng. O componente em si faz dynamic import dos sub-components do `react-leaflet` para evitar SSR (Leaflet acessa `window`).

- [ ] **Step 1: Instalar dependências**

```bash
npm install react-leaflet leaflet
npm install -D @types/leaflet
cat package.json | grep -E '"react-leaflet|leaflet|@types/leaflet"'
```

Esperado: 3 entradas confirmadas.

- [ ] **Step 2: Criar `src/components/portal/MapaExecucao.tsx`**

```tsx
'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import 'leaflet/dist/leaflet.css'

const MapContainer = dynamic(() => import('react-leaflet').then(m => m.MapContainer), { ssr: false })
const TileLayer = dynamic(() => import('react-leaflet').then(m => m.TileLayer), { ssr: false })
const Marker = dynamic(() => import('react-leaflet').then(m => m.Marker), { ssr: false })
const Popup = dynamic(() => import('react-leaflet').then(m => m.Popup), { ssr: false })

interface PinData {
  id: string
  titulo: string
  lat: number
  lng: number
}

interface Props {
  pins: PinData[]
}

export function MapaExecucao({ pins }: Props) {
  const [iconReady, setIconReady] = useState(false)

  // Workaround do bug clássico do Leaflet com bundlers (ícone do marker quebra).
  useEffect(() => {
    (async () => {
      const L = (await import('leaflet')).default
      // @ts-expect-error — runtime override do default icon
      delete L.Icon.Default.prototype._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })
      setIconReady(true)
    })()
  }, [])

  if (pins.length === 0) return null

  const centerLat = pins.reduce((a, p) => a + p.lat, 0) / pins.length
  const centerLng = pins.reduce((a, p) => a + p.lng, 0) / pins.length

  function handlePinClick(id: string) {
    const el = document.getElementById(`card-${id}`)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.classList.add('ring-2', 'ring-nexa-500')
    setTimeout(() => el.classList.remove('ring-2', 'ring-nexa-500'), 2000)
  }

  if (!iconReady) {
    return <div className="h-72 bg-slate-100 animate-pulse rounded-md" aria-label="Carregando mapa" />
  }

  return (
    <MapContainer
      center={[centerLat, centerLng]}
      zoom={13}
      style={{ height: '300px', width: '100%' }}
      className="rounded-md overflow-hidden"
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />
      {pins.map(p => (
        <Marker
          key={p.id}
          position={[p.lat, p.lng]}
          eventHandlers={{ click: () => handlePinClick(p.id) }}
        >
          <Popup>{p.titulo}</Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}
```

- [ ] **Step 3: Type check**

```bash
npx tsc --noEmit --skipLibCheck 2>&1 | grep MapaExecucao | head -5
```

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/components/portal/MapaExecucao.tsx
git commit -m "feat: M7 — MapaExecucao com react-leaflet + OpenStreetMap

Dynamic import com ssr:false (Leaflet acessa window). Workaround do
bug classico do icone do marker em bundlers. Pin click faz scroll
suave ate card-{id} + flash ring 2s.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 9: Componentes públicos — Header, Hero, KpiBlock, CardsGrid, Footer

**Files:**
- Create: `src/components/portal/PortalHeader.tsx`
- Create: `src/components/portal/PortalHero.tsx`
- Create: `src/components/portal/KpiBlock.tsx`
- Create: `src/components/portal/CardsGrid.tsx`
- Create: `src/components/portal/PortalFooter.tsx`

Server components puros (sem hooks). Recebem props tipadas. Estilo Tailwind utility classes seguindo padrão Nexa (`slate-`, `nexa-`).

- [ ] **Step 1: `PortalHeader.tsx`**

```tsx
// src/components/portal/PortalHeader.tsx
import Image from 'next/image'
import type { MunicipioBranding } from '@/types'

interface Props {
  nome: string
  uf: string
  branding: MunicipioBranding | null
}

export function PortalHeader({ nome, uf, branding }: Props) {
  const cor = branding?.cor_primaria ?? '#0284c7'
  return (
    <header className="px-4 py-6 text-white" style={{ backgroundColor: cor }}>
      <div className="max-w-5xl mx-auto flex items-center gap-4">
        {branding?.logo_url && (
          <Image
            src={branding.logo_url}
            alt="Logo da prefeitura"
            width={64}
            height={64}
            className="rounded-md bg-white/10 p-1"
          />
        )}
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Prefeitura de {nome} — {uf.toUpperCase()}</h1>
          {branding?.prefeito_gestao && (
            <p className="text-sm opacity-90">{branding.prefeito_gestao}</p>
          )}
          {branding?.prefeito_nome && (
            <p className="text-xs opacity-80">{branding.prefeito_nome}</p>
          )}
        </div>
      </div>
    </header>
  )
}
```

- [ ] **Step 2: `PortalHero.tsx`**

```tsx
// src/components/portal/PortalHero.tsx
interface Props {
  ultimaAtualizacao: string | null
}

export function PortalHero({ ultimaAtualizacao }: Props) {
  return (
    <section className="px-4 py-8 bg-slate-50 border-b border-slate-200">
      <div className="max-w-5xl mx-auto text-center">
        <h2 className="text-3xl md:text-4xl font-bold text-slate-900">Portal de Transparência</h2>
        {ultimaAtualizacao && (
          <p className="mt-2 text-sm text-slate-500">
            Atualizado em {new Date(ultimaAtualizacao).toLocaleDateString('pt-BR', {
              day: '2-digit', month: 'long', year: 'numeric',
            })}
          </p>
        )}
      </div>
    </section>
  )
}
```

- [ ] **Step 3: `KpiBlock.tsx`**

```tsx
// src/components/portal/KpiBlock.tsx
import type { KpiPortal } from '@/types'
import { ordenarKpis } from '@/lib/portal'

interface Props {
  kpis: KpiPortal[]
  corPrimaria: string
}

export function KpiBlock({ kpis, corPrimaria }: Props) {
  const slots = ordenarKpis(kpis)
  const filled = slots.filter(s => s !== null)
  if (filled.length === 0) return null

  return (
    <section className="px-4 py-8 bg-white">
      <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4">
        {slots.map((k, i) =>
          k ? (
            <div key={k.id} className="rounded-lg border border-slate-200 p-5 text-center bg-slate-50">
              <p className="text-2xl md:text-3xl font-bold" style={{ color: corPrimaria }}>
                {k.sufixo === 'R$' ? 'R$ ' : ''}{k.valor}{k.sufixo && k.sufixo !== 'R$' ? ` ${k.sufixo}` : ''}
              </p>
              <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">{k.label}</p>
            </div>
          ) : (
            <div key={`empty-${i}`} className="hidden md:block" />
          )
        )}
      </div>
    </section>
  )
}
```

- [ ] **Step 4: `CardsGrid.tsx`**

```tsx
// src/components/portal/CardsGrid.tsx
import Image from 'next/image'
import type { PublicacaoPortal } from '@/types'

interface Props {
  publicacoes: PublicacaoPortal[]
}

export function CardsGrid({ publicacoes }: Props) {
  if (publicacoes.length === 0) {
    return (
      <section className="px-4 py-12 text-center text-slate-500">
        <p>Em breve, resultados da gestão serão publicados aqui.</p>
      </section>
    )
  }

  return (
    <section className="px-4 py-8 bg-slate-50">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-4">
          Resultados Recentes
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {publicacoes.map(p => {
            const capa = p.fotos?.[0]
            return (
              <button
                key={p.id}
                id={`card-${p.id}`}
                data-pub-id={p.id}
                className="text-left rounded-lg overflow-hidden border border-slate-200 bg-white hover:shadow-md transition-shadow"
                aria-label={`Ver detalhes de ${p.titulo}`}
              >
                {capa && (
                  <div className="relative aspect-video bg-slate-100">
                    <Image
                      src={capa.url}
                      alt={capa.alt}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, 33vw"
                    />
                  </div>
                )}
                <div className="p-4">
                  {p.valor_destaque && (
                    <p className="text-lg font-bold text-nexa-700">{p.valor_destaque}</p>
                  )}
                  <h3 className="mt-1 font-semibold text-slate-900">{p.titulo}</h3>
                  {p.descricao && (
                    <p className="mt-2 text-sm text-slate-600 line-clamp-3">{p.descricao}</p>
                  )}
                  {p.data_evento && (
                    <p className="mt-3 text-xs text-slate-400">
                      {new Date(p.data_evento).toLocaleDateString('pt-BR')}
                    </p>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 5: `PortalFooter.tsx`**

```tsx
// src/components/portal/PortalFooter.tsx
import Image from 'next/image'
import type { MunicipioBranding } from '@/types'

interface Props {
  nome: string
  uf: string
  branding: MunicipioBranding | null
}

export function PortalFooter({ nome, uf, branding }: Props) {
  return (
    <footer className="px-4 py-8 bg-slate-900 text-slate-300">
      <div className="max-w-5xl mx-auto flex flex-col items-center gap-4 text-center">
        {branding?.brasao_url && (
          <Image src={branding.brasao_url} alt="Brasão municipal" width={48} height={48} />
        )}
        <p className="text-sm">Prefeitura Municipal de {nome} — {uf.toUpperCase()}</p>
        <p className="text-xs text-slate-500">
          Powered by{' '}
          <a
            href="https://nexaradar.com.br"
            target="_blank"
            rel="noopener noreferrer"
            className="text-nexa-400 hover:text-nexa-300"
          >
            Nexa Radar
          </a>
        </p>
      </div>
    </footer>
  )
}
```

- [ ] **Step 6: Type check**

```bash
npx tsc --noEmit --skipLibCheck 2>&1 | grep -E "portal/" | head -10
```

- [ ] **Step 7: Commit**

```bash
git add src/components/portal/
git commit -m "feat: M7 — portal public components (Header, Hero, KpiBlock, CardsGrid, Footer)

Server components puros, brandable por cor primaria, fotos via
next/image otimizado (remotePatterns ja configurado).

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 10: `PublicacaoModal` com carrossel + share + hash auto-open

**Files:**
- Create: `src/components/portal/PublicacaoModal.tsx`
- Create: `src/components/portal/PortalInteractivity.tsx`

Modal client-side. `PortalInteractivity` é o orquestrador que:
1. Escuta clicks nos cards (delegação via `data-pub-id`)
2. Lê `#pub-{id}` do hash ao montar e abre o modal correspondente
3. Renderiza o modal

- [ ] **Step 1: `PublicacaoModal.tsx`**

```tsx
// src/components/portal/PublicacaoModal.tsx
'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import type { PublicacaoPortal } from '@/types'
import { gerarUrlShare } from '@/lib/portal'

interface Props {
  publicacao: PublicacaoPortal
  uf: string
  slug: string
  onClose: () => void
}

export function PublicacaoModal({ publicacao, uf, slug, onClose }: Props) {
  const [fotoIdx, setFotoIdx] = useState(0)
  const [toast, setToast] = useState<string | null>(null)
  const fotos = publicacao.fotos ?? []
  const url = gerarUrlShare(uf, slug, publicacao.id)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') setFotoIdx(i => Math.max(0, i - 1))
      if (e.key === 'ArrowRight') setFotoIdx(i => Math.min(fotos.length - 1, i + 1))
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [fotos.length, onClose])

  async function copiarLink() {
    await navigator.clipboard.writeText(url)
    setToast('Link copiado!')
    setTimeout(() => setToast(null), 2000)
  }

  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`Veja: ${publicacao.titulo} — ${url}`)}`

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative max-w-2xl w-full bg-white rounded-lg overflow-hidden max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 rounded-full bg-black/40 text-white w-9 h-9 flex items-center justify-center text-xl hover:bg-black/60"
          aria-label="Fechar"
        >
          ×
        </button>

        {fotos.length > 0 && (
          <div className="relative aspect-video bg-slate-900 flex-shrink-0">
            <Image
              src={fotos[fotoIdx].url}
              alt={fotos[fotoIdx].alt}
              fill
              className="object-contain"
              sizes="(max-width: 768px) 100vw, 800px"
            />
            {fotos.length > 1 && (
              <>
                <button
                  onClick={() => setFotoIdx(i => Math.max(0, i - 1))}
                  disabled={fotoIdx === 0}
                  className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 text-white w-9 h-9 flex items-center justify-center disabled:opacity-30"
                  aria-label="Foto anterior"
                >
                  ‹
                </button>
                <button
                  onClick={() => setFotoIdx(i => Math.min(fotos.length - 1, i + 1))}
                  disabled={fotoIdx === fotos.length - 1}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 text-white w-9 h-9 flex items-center justify-center disabled:opacity-30"
                  aria-label="Próxima foto"
                >
                  ›
                </button>
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-white text-xs bg-black/50 px-2 py-0.5 rounded">
                  {fotoIdx + 1} / {fotos.length}
                </div>
              </>
            )}
          </div>
        )}

        <div className="overflow-y-auto p-6">
          {publicacao.valor_destaque && (
            <p className="text-2xl font-bold text-nexa-700">{publicacao.valor_destaque}</p>
          )}
          <h2 className="mt-1 text-xl font-bold text-slate-900">{publicacao.titulo}</h2>
          {publicacao.data_evento && (
            <p className="mt-1 text-sm text-slate-500">
              {new Date(publicacao.data_evento).toLocaleDateString('pt-BR', {
                day: '2-digit', month: 'long', year: 'numeric',
              })}
            </p>
          )}
          {publicacao.descricao && (
            <p className="mt-4 text-slate-700 whitespace-pre-wrap leading-relaxed">{publicacao.descricao}</p>
          )}

          <div className="mt-6 flex gap-2">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md bg-green-600 text-white px-4 py-2 text-sm font-semibold hover:bg-green-700"
            >
              📱 WhatsApp
            </a>
            <button
              onClick={copiarLink}
              className="rounded-md bg-slate-200 text-slate-900 px-4 py-2 text-sm font-semibold hover:bg-slate-300"
            >
              🔗 Copiar link
            </button>
          </div>

          {toast && (
            <div className="mt-3 text-sm text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">
              {toast}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: `PortalInteractivity.tsx`**

```tsx
// src/components/portal/PortalInteractivity.tsx
'use client'

import { useEffect, useState, useCallback } from 'react'
import type { PublicacaoPortal } from '@/types'
import { PublicacaoModal } from './PublicacaoModal'

interface Props {
  publicacoes: PublicacaoPortal[]
  uf: string
  slug: string
}

export function PortalInteractivity({ publicacoes, uf, slug }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null)

  const open = useCallback((id: string) => {
    const exists = publicacoes.find(p => p.id === id)
    if (exists) setActiveId(id)
  }, [publicacoes])

  // Delegação de click nos cards renderizados pelo CardsGrid.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      const target = e.target as HTMLElement
      const card = target.closest('[data-pub-id]') as HTMLElement | null
      if (card?.dataset.pubId) open(card.dataset.pubId)
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [open])

  // Hash auto-open: #pub-{id} ao carregar.
  // Se id não estiver na lista (inativa/deletada), ignora silenciosamente.
  useEffect(() => {
    const hash = window.location.hash
    if (hash.startsWith('#pub-')) open(hash.slice(5))
  }, [open])

  if (!activeId) return null
  const pub = publicacoes.find(p => p.id === activeId)
  if (!pub) return null

  return <PublicacaoModal publicacao={pub} uf={uf} slug={slug} onClose={() => setActiveId(null)} />
}
```

- [ ] **Step 3: Type check**

```bash
npx tsc --noEmit --skipLibCheck 2>&1 | grep -E "PublicacaoModal|PortalInteractivity" | head -5
```

- [ ] **Step 4: Commit**

```bash
git add src/components/portal/PublicacaoModal.tsx src/components/portal/PortalInteractivity.tsx
git commit -m "feat: M7 — PublicacaoModal (carrossel + share) + PortalInteractivity

Hash auto-open com fallback silencioso para id inativo/inexistente.
Delegacao de click via data-pub-id evita re-render de toda a grid.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 11: Middleware — liberar `/p/` como rota pública

**Files:**
- Modify: `src/middleware.ts`

- [ ] **Step 1: Ler middleware atual**

```bash
grep -n "Public routes\|pathname.startsWith" src/middleware.ts
```

Esperado: encontrar o bloco `if (pathname.startsWith('/login') || ...)`.

- [ ] **Step 2: Adicionar `/p/` ao bloco público**

Localizar:
```typescript
if (
  pathname.startsWith('/login') ||
  pathname.startsWith('/forgot-password') ||
  pathname.startsWith('/auth/callback') ||
  pathname.startsWith('/municipio') ||
  pathname.startsWith('/_next') ||
  pathname.startsWith('/favicon')
) {
  return supabaseResponse
}
```

Substituir por (adiciona `/p/` na lista):
```typescript
if (
  pathname.startsWith('/login') ||
  pathname.startsWith('/forgot-password') ||
  pathname.startsWith('/auth/callback') ||
  pathname.startsWith('/municipio') ||
  pathname.startsWith('/p/') ||
  pathname.startsWith('/_next') ||
  pathname.startsWith('/favicon')
) {
  return supabaseResponse
}
```

- [ ] **Step 3: Type check + verificar rota responde**

```bash
npx tsc --noEmit --skipLibCheck 2>&1 | grep middleware
```

- [ ] **Step 4: Commit**

```bash
git add src/middleware.ts
git commit -m "feat: M7 — middleware libera /p/ como rota publica (portal cidadao)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 12: Página pública `/p/[uf]/[slug]`

**Files:**
- Create: `src/app/p/[uf]/[slug]/page.tsx`
- Create: `public/og-default.png` (placeholder vazio criado por bash; arte final na Task 16)

A página é server component com `generateMetadata` + `revalidate = 300`. Compõe Header → Hero → KpiBlock → Mapa (render-conditional) → CardsGrid + PortalInteractivity → Footer.

- [ ] **Step 1: Criar `public/og-default.png` (placeholder)**

Próxima task gera o PNG real. Por ora, criar um placeholder de 1×1 transparente para o build não quebrar:

```bash
mkdir -p public
# 1×1 PNG transparente em base64
echo "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=" | base64 -d > public/og-default.png
ls -la public/og-default.png
```

Esperado: arquivo de ~70 bytes existe.

- [ ] **Step 2: Criar a página**

```tsx
// src/app/p/[uf]/[slug]/page.tsx
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getPortalData } from '@/lib/portal-data'
import { PortalHeader } from '@/components/portal/PortalHeader'
import { PortalHero } from '@/components/portal/PortalHero'
import { KpiBlock } from '@/components/portal/KpiBlock'
import { MapaExecucao } from '@/components/portal/MapaExecucao'
import { CardsGrid } from '@/components/portal/CardsGrid'
import { PortalFooter } from '@/components/portal/PortalFooter'
import { PortalInteractivity } from '@/components/portal/PortalInteractivity'

export const revalidate = 300

interface PageProps {
  params: Promise<{ uf: string; slug: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { uf, slug } = await params
  const data = await getPortalData(uf, slug)
  if (!data) return { title: 'Portal não encontrado' }

  const primeira = data.publicacoes[0]
  const description = primeira?.descricao?.slice(0, 160)
    ?? `Portal de transparência do município de ${data.municipio.nome}`
  const ogImage = primeira?.fotos?.[0]?.url ?? '/og-default.png'

  return {
    title: `Transparência — Prefeitura de ${data.municipio.nome} - ${data.municipio.uf}`,
    description,
    openGraph: {
      type: 'website',
      title: `Prefeitura de ${data.municipio.nome} - ${data.municipio.uf}`,
      description,
      images: [{ url: ogImage }],
    },
  }
}

export default async function PortalPage({ params }: PageProps) {
  const { uf, slug } = await params
  const data = await getPortalData(uf, slug)
  if (!data) notFound()

  const { municipio, branding, kpis, publicacoes } = data
  const corPrimaria = branding?.cor_primaria ?? '#0284c7'
  const ultimaAtualizacao = publicacoes[0]?.publicado_em ?? null

  const pins = publicacoes
    .filter(p => p.lat != null && p.lng != null)
    .map(p => ({ id: p.id, titulo: p.titulo, lat: p.lat!, lng: p.lng! }))

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <PortalHeader nome={municipio.nome} uf={municipio.uf} branding={branding} />
      <PortalHero ultimaAtualizacao={ultimaAtualizacao} />
      <KpiBlock kpis={kpis} corPrimaria={corPrimaria} />
      {pins.length > 0 && (
        <section className="px-4 py-6 bg-white">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
              📍 Onde está acontecendo
            </h2>
            <MapaExecucao pins={pins} />
          </div>
        </section>
      )}
      <CardsGrid publicacoes={publicacoes} />
      <PortalFooter nome={municipio.nome} uf={municipio.uf} branding={branding} />
      <PortalInteractivity publicacoes={publicacoes} uf={municipio.uf} slug={municipio.slug} />
    </div>
  )
}
```

- [ ] **Step 3: Build limpo**

```bash
npm run build 2>&1 | tail -30
```

Esperado: rota `ƒ /p/[uf]/[slug]` aparece na lista; nenhum erro.

- [ ] **Step 4: Smoke test no dev**

```bash
PID=$(lsof -i :3000 -t 2>/dev/null | head -1); [ -n "$PID" ] && kill "$PID" 2>/dev/null
rm -rf .next
nohup npm run dev > /tmp/nexa-dev.log 2>&1 &
sleep 18
curl -s -o /dev/null -w "HTTP %{http_code} /p/se/lagarto\n" http://localhost:3000/p/se/lagarto
curl -s -o /dev/null -w "HTTP %{http_code} /p/xx/nao-existe\n" http://localhost:3000/p/xx/nao-existe
```

Esperado:
- `/p/se/lagarto` → 200 (com layout sem publicações — "Em breve..." porque DB está vazio)
- `/p/xx/nao-existe` → 404

- [ ] **Step 5: Commit**

```bash
git add public/og-default.png src/app/p/
git commit -m "feat: M7 — pagina publica /p/[uf]/[slug] com ISR e metadata SEO

ISR revalidate=300 + React cache() na getPortalData compartilhada
entre generateMetadata e Page. Map condicional (so renderiza se houver
publicacoes com lat/lng). Modal aciona via PortalInteractivity.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 13: Admin — lista geral `/admin/portal` + sidebar link

**Files:**
- Create: `src/app/admin/portal/page.tsx`
- Create: `src/app/admin/portal/actions.ts`
- Modify: `src/app/admin/layout.tsx`

- [ ] **Step 1: Criar server action `habilitarMunicipio`**

```typescript
// src/app/admin/portal/actions.ts
'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { requireAdminClient } from '@/lib/require-admin'

export async function habilitarMunicipio(formData: FormData) {
  const ibge = (formData.get('ibge') as string | null)?.trim()
  if (!ibge || !/^\d{7}$/.test(ibge)) redirect('/admin/portal?error=ibge_invalido')

  const admin = await requireAdminClient()

  const { error } = await admin
    .from('municipios_branding')
    .insert({ municipio_ibge: ibge })

  if (error && error.code !== '23505') {  // 23505 = já existe, OK
    redirect(`/admin/portal?error=db&detail=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/admin/portal')
  redirect(`/admin/portal/${ibge}`)
}
```

- [ ] **Step 2: Criar `/admin/portal/page.tsx`**

```tsx
// src/app/admin/portal/page.tsx
import Link from 'next/link'
import { requireAdminClient } from '@/lib/require-admin'
import { habilitarMunicipio } from './actions'

type Row = {
  municipio_ibge: string
  atualizado_em: string
  municipios_habilitacao: { nome: string; uf: string; slug: string } | null
}

export default async function PortalListPage() {
  const admin = await requireAdminClient()

  const { data: portais } = await admin
    .from('municipios_branding')
    .select('municipio_ibge, atualizado_em, municipios_habilitacao!inner(nome, uf, slug)')
    .order('atualizado_em', { ascending: false })

  const rows = ((portais ?? []) as unknown as Row[])

  // Contagem de publicações ativas por município
  const ibges = rows.map(r => r.municipio_ibge)
  const counts: Record<string, number> = {}
  if (ibges.length > 0) {
    const { data: pubs } = await admin
      .from('publicacoes_portal')
      .select('municipio_ibge')
      .in('municipio_ibge', ibges)
      .eq('ativo', true)
    for (const p of pubs ?? []) {
      counts[p.municipio_ibge] = (counts[p.municipio_ibge] ?? 0) + 1
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-100">Portais Municipais</h1>
        <details className="relative">
          <summary className="rounded-md bg-nexa-600 px-4 py-2 text-sm font-semibold text-white hover:bg-nexa-500 cursor-pointer list-none">
            + Habilitar novo município
          </summary>
          <form
            action={habilitarMunicipio}
            className="absolute right-0 mt-2 w-72 rounded-md bg-slate-800 border border-slate-700 p-4 space-y-3 z-10"
          >
            <label className="block text-xs text-slate-400">Código IBGE (7 dígitos)</label>
            <input
              name="ibge"
              type="text"
              inputMode="numeric"
              pattern="\d{7}"
              required
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
              placeholder="2803500"
            />
            <button
              type="submit"
              className="w-full rounded-md bg-nexa-600 px-3 py-2 text-sm font-semibold text-white hover:bg-nexa-500"
            >
              Habilitar
            </button>
          </form>
        </details>
      </div>

      <div className="rounded-md border border-slate-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-800">
            <tr>
              {['Município', 'Publicações ativas', 'Última atualização', ''].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {rows.map(r => {
              const m = r.municipios_habilitacao
              const isSlugFallback = m && /^\d+$/.test(m.slug)
              return (
                <tr key={r.municipio_ibge} className="hover:bg-slate-800/50">
                  <td className="px-4 py-3 text-slate-300">
                    {m?.nome ?? r.municipio_ibge} — {m?.uf}
                    {isSlugFallback && (
                      <span
                        className="ml-2 inline-block rounded bg-yellow-900/40 text-yellow-300 text-xs px-2 py-0.5"
                        title="URL pública é numérica — corrigir `nome` em municipios_habilitacao para gerar slug legível"
                      >
                        slug fallback
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-300">{counts[r.municipio_ibge] ?? 0}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">
                    {new Date(r.atualizado_em).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/admin/portal/${r.municipio_ibge}`} className="text-nexa-400 hover:text-nexa-300 text-sm">
                      Configurar →
                    </Link>
                  </td>
                </tr>
              )
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-500 text-sm">
                  Nenhum município habilitado. Use o botão acima para começar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Atualizar sidebar admin com link "Portal"**

Ler `src/app/admin/layout.tsx`, localizar o array de nav items (deve ter um item "Projetos" recém-adicionado no M3). Adicionar logo após:

```typescript
{ href: '/admin/portal', label: 'Portal', icon: Globe },
```

E adicionar `Globe` ao import de `lucide-react` no topo do arquivo (se ainda não importado).

- [ ] **Step 4: Build limpo + smoke test**

```bash
npm run build 2>&1 | tail -25
```

Esperado: rotas `/admin/portal` e ainda `/p/[uf]/[slug]` ambas presentes.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/portal/ src/app/admin/layout.tsx
git commit -m "feat: M7 — admin /admin/portal list + habilitarMunicipio action + sidebar link

Lista mostra contagem de publicacoes ativas + badge para municipios
em slug fallback (numerico). Habilitar inicia via IBGE — cria registro
em municipios_branding com defaults e redireciona para a config.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 14: Admin — `/admin/portal/[ibge]` com 3 abas (Identidade, KPIs, Publicações)

**Files:**
- Create: `src/app/admin/portal/[ibge]/page.tsx`
- Create: `src/app/admin/portal/[ibge]/actions.ts`
- Create: `src/app/admin/portal/[ibge]/IdentidadeForm.tsx`
- Create: `src/app/admin/portal/[ibge]/KpisForm.tsx`

Page = server component com tabs via query string `?aba=identidade|kpis|publicacoes` (default `identidade`). Cada aba tem seu próprio form/conteúdo.

- [ ] **Step 1: Criar `actions.ts`**

```typescript
// src/app/admin/portal/[ibge]/actions.ts
'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { requireAdminClient } from '@/lib/require-admin'

const IBGE_RE = /^\d{7}$/

async function getMunicipioSlug(ibge: string): Promise<{ uf: string; slug: string } | null> {
  const admin = await requireAdminClient()
  const { data } = await admin
    .from('municipios_habilitacao')
    .select('uf, slug')
    .eq('ibge', ibge)
    .single()
  return data ?? null
}

async function revalidarPortal(ibge: string) {
  const m = await getMunicipioSlug(ibge)
  if (m) revalidatePath(`/p/${m.uf.toLowerCase()}/${m.slug}`)
}

export async function salvarBranding(formData: FormData) {
  const ibge = formData.get('ibge') as string
  if (!IBGE_RE.test(ibge)) redirect('/admin/portal')

  const admin = await requireAdminClient()
  const { data: { user } } = await admin.auth.getUser()

  const cor = ((formData.get('cor_primaria') as string) ?? '').trim() || '#0284c7'
  const prefeito_nome = ((formData.get('prefeito_nome') as string) ?? '').trim() || null
  const prefeito_gestao = ((formData.get('prefeito_gestao') as string) ?? '').trim() || null

  await admin
    .from('municipios_branding')
    .upsert({
      municipio_ibge: ibge,
      cor_primaria: cor,
      prefeito_nome,
      prefeito_gestao,
      atualizado_em: new Date().toISOString(),
      atualizado_por: user?.id ?? null,
    }, { onConflict: 'municipio_ibge' })

  revalidatePath(`/admin/portal/${ibge}`)
  await revalidarPortal(ibge)
  redirect(`/admin/portal/${ibge}?aba=identidade&ok=1`)
}

export async function salvarKpis(formData: FormData) {
  const ibge = formData.get('ibge') as string
  if (!IBGE_RE.test(ibge)) redirect('/admin/portal')

  const admin = await requireAdminClient()

  // Limpa e re-insere — simples e idempotente. 4 linhas no máximo.
  await admin.from('municipios_kpi_portal').delete().eq('municipio_ibge', ibge)

  const inserts = []
  for (let i = 1; i <= 4; i++) {
    const label = ((formData.get(`label_${i}`) as string) ?? '').trim()
    const valor = ((formData.get(`valor_${i}`) as string) ?? '').trim()
    const sufixo = ((formData.get(`sufixo_${i}`) as string) ?? '').trim() || null
    if (label && valor) {
      inserts.push({ municipio_ibge: ibge, ordem: i, label, valor, sufixo })
    }
  }
  if (inserts.length > 0) {
    await admin.from('municipios_kpi_portal').insert(inserts)
  }

  revalidatePath(`/admin/portal/${ibge}`)
  await revalidarPortal(ibge)
  redirect(`/admin/portal/${ibge}?aba=kpis&ok=1`)
}

export async function togglePublicacao(formData: FormData) {
  const id = formData.get('id') as string
  const ibge = formData.get('ibge') as string
  const ativo = formData.get('ativo') === 'true'
  if (!IBGE_RE.test(ibge)) redirect('/admin/portal')

  const admin = await requireAdminClient()
  await admin.from('publicacoes_portal').update({ ativo: !ativo }).eq('id', id)

  revalidatePath(`/admin/portal/${ibge}`)
  await revalidarPortal(ibge)
  redirect(`/admin/portal/${ibge}?aba=publicacoes`)
}

export async function uploadLogoOuBrasao(formData: FormData) {
  const ibge = formData.get('ibge') as string
  const tipo = formData.get('tipo') as 'logo' | 'brasao'
  const file = formData.get('file') as File | null
  if (!IBGE_RE.test(ibge) || (tipo !== 'logo' && tipo !== 'brasao') || !file) {
    redirect(`/admin/portal/${ibge}?aba=identidade&error=invalid`)
  }

  const admin = await requireAdminClient()
  const ext = file!.name.split('.').pop() || 'png'
  const path = `${ibge}/${tipo}.${ext}`

  const { error: upErr } = await admin.storage
    .from('portal-fotos')
    .upload(path, file!, { upsert: true, contentType: file!.type })

  if (upErr) redirect(`/admin/portal/${ibge}?aba=identidade&error=upload`)

  const { data: pub } = admin.storage.from('portal-fotos').getPublicUrl(path)

  await admin
    .from('municipios_branding')
    .upsert({
      municipio_ibge: ibge,
      [`${tipo}_url`]: pub.publicUrl,
      atualizado_em: new Date().toISOString(),
    }, { onConflict: 'municipio_ibge' })

  revalidatePath(`/admin/portal/${ibge}`)
  await revalidarPortal(ibge)
  redirect(`/admin/portal/${ibge}?aba=identidade&ok=1`)
}
```

- [ ] **Step 2: Criar `IdentidadeForm.tsx` (client para color picker)**

```tsx
// src/app/admin/portal/[ibge]/IdentidadeForm.tsx
'use client'

import { useState } from 'react'
import type { MunicipioBranding } from '@/types'
import { salvarBranding, uploadLogoOuBrasao } from './actions'

interface Props {
  ibge: string
  branding: MunicipioBranding | null
}

export function IdentidadeForm({ ibge, branding }: Props) {
  const [cor, setCor] = useState(branding?.cor_primaria ?? '#0284c7')

  return (
    <div className="space-y-6">
      {/* Upload de logo */}
      <form action={uploadLogoOuBrasao} className="rounded-md border border-slate-800 p-4 space-y-3">
        <input type="hidden" name="ibge" value={ibge} />
        <input type="hidden" name="tipo" value="logo" />
        <label className="block text-sm font-medium text-slate-300">Logo da Prefeitura</label>
        {branding?.logo_url && (
          <img src={branding.logo_url} alt="Logo atual" className="h-16 bg-slate-800 rounded p-2" />
        )}
        <input
          type="file"
          name="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          required
          className="text-sm text-slate-300"
        />
        <button type="submit" className="rounded-md bg-nexa-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-nexa-500">
          Enviar logo
        </button>
      </form>

      {/* Upload de brasão */}
      <form action={uploadLogoOuBrasao} className="rounded-md border border-slate-800 p-4 space-y-3">
        <input type="hidden" name="ibge" value={ibge} />
        <input type="hidden" name="tipo" value="brasao" />
        <label className="block text-sm font-medium text-slate-300">Brasão</label>
        {branding?.brasao_url && (
          <img src={branding.brasao_url} alt="Brasão atual" className="h-16 bg-slate-800 rounded p-2" />
        )}
        <input
          type="file"
          name="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          required
          className="text-sm text-slate-300"
        />
        <button type="submit" className="rounded-md bg-nexa-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-nexa-500">
          Enviar brasão
        </button>
      </form>

      {/* Cor primária + nome do prefeito */}
      <form action={salvarBranding} className="rounded-md border border-slate-800 p-4 space-y-4">
        <input type="hidden" name="ibge" value={ibge} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Cor primária</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                name="cor_primaria"
                value={cor}
                onChange={e => setCor(e.target.value)}
                className="h-10 w-16 rounded border border-slate-700 bg-slate-800"
              />
              <code className="text-xs text-slate-400">{cor}</code>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Nome do prefeito</label>
            <input
              type="text"
              name="prefeito_nome"
              defaultValue={branding?.prefeito_nome ?? ''}
              className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Gestão (ex: Gestão 2025-2028)</label>
          <input
            type="text"
            name="prefeito_gestao"
            defaultValue={branding?.prefeito_gestao ?? ''}
            className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
          />
        </div>

        <button
          type="submit"
          className="rounded-md bg-nexa-600 px-4 py-2 text-sm font-semibold text-white hover:bg-nexa-500"
        >
          Salvar identidade
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 3: Criar `KpisForm.tsx`**

```tsx
// src/app/admin/portal/[ibge]/KpisForm.tsx
'use client'

import type { KpiPortal } from '@/types'
import { ordenarKpis } from '@/lib/portal'
import { salvarKpis } from './actions'

interface Props {
  ibge: string
  kpis: KpiPortal[]
}

export function KpisForm({ ibge, kpis }: Props) {
  const slots = ordenarKpis(kpis)

  return (
    <form action={salvarKpis} className="rounded-md border border-slate-800 p-4 space-y-4">
      <input type="hidden" name="ibge" value={ibge} />

      <p className="text-xs text-slate-500">
        4 KPIs aparecem no topo do portal público. Deixe vazio para esconder. Sufixo opcional (ex: &quot;R$&quot;, &quot;famílias&quot;).
      </p>

      {[1, 2, 3, 4].map(i => {
        const k = slots[i - 1]
        return (
          <div key={i} className="grid grid-cols-1 md:grid-cols-3 gap-3 border-t border-slate-800 pt-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">KPI {i} — Label</label>
              <input
                type="text"
                name={`label_${i}`}
                defaultValue={k?.label ?? ''}
                placeholder="Captados"
                className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Valor</label>
              <input
                type="text"
                name={`valor_${i}`}
                defaultValue={k?.valor ?? ''}
                placeholder="5.200.000"
                className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Sufixo (opcional)</label>
              <input
                type="text"
                name={`sufixo_${i}`}
                defaultValue={k?.sufixo ?? ''}
                placeholder="R$ ou famílias"
                className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
              />
            </div>
          </div>
        )
      })}

      <button
        type="submit"
        className="rounded-md bg-nexa-600 px-4 py-2 text-sm font-semibold text-white hover:bg-nexa-500"
      >
        Salvar KPIs
      </button>
    </form>
  )
}
```

- [ ] **Step 4: Criar a página com 3 abas**

```tsx
// src/app/admin/portal/[ibge]/page.tsx
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { requireAdminClient } from '@/lib/require-admin'
import { IdentidadeForm } from './IdentidadeForm'
import { KpisForm } from './KpisForm'
import { togglePublicacao } from './actions'
import type { MunicipioBranding, KpiPortal, PublicacaoPortal } from '@/types'

const IBGE_RE = /^\d{7}$/

type Aba = 'identidade' | 'kpis' | 'publicacoes'

interface PageProps {
  params: Promise<{ ibge: string }>
  searchParams: Promise<{ aba?: string; ok?: string; error?: string }>
}

export default async function PortalMunicipioPage({ params, searchParams }: PageProps) {
  const { ibge } = await params
  const { aba: abaParam, ok, error } = await searchParams

  if (!IBGE_RE.test(ibge)) notFound()
  const aba: Aba = ['identidade', 'kpis', 'publicacoes'].includes(abaParam ?? '')
    ? abaParam as Aba
    : 'identidade'

  const admin = await requireAdminClient()

  const [muniRes, brandRes, kpiRes, pubRes] = await Promise.all([
    admin.from('municipios_habilitacao').select('nome, uf, slug').eq('ibge', ibge).single(),
    admin.from('municipios_branding').select('*').eq('municipio_ibge', ibge).maybeSingle(),
    admin.from('municipios_kpi_portal').select('*').eq('municipio_ibge', ibge).order('ordem'),
    admin.from('publicacoes_portal').select('*').eq('municipio_ibge', ibge).order('publicado_em', { ascending: false }),
  ])

  if (!muniRes.data) notFound()
  const municipio = muniRes.data
  const branding = (brandRes.data ?? null) as MunicipioBranding | null
  const kpis = (kpiRes.data ?? []) as KpiPortal[]
  const publicacoes = (pubRes.data ?? []) as PublicacaoPortal[]

  const portalUrl = `/p/${municipio.uf.toLowerCase()}/${municipio.slug}`

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/admin/portal" className="text-xs text-slate-400 hover:text-slate-300">
            ← Portais
          </Link>
          <h1 className="text-xl font-bold text-slate-100">
            {municipio.nome} — {municipio.uf}
          </h1>
        </div>
        <a
          href={portalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-nexa-400 hover:text-nexa-300"
        >
          Visualizar portal público →
        </a>
      </div>

      {ok && (
        <div className="rounded-md bg-green-900/30 border border-green-700 px-4 py-2 text-sm text-green-300">
          Alterações salvas.
        </div>
      )}
      {error && (
        <div className="rounded-md bg-red-900/30 border border-red-700 px-4 py-2 text-sm text-red-300">
          Erro: {error}
        </div>
      )}

      <div className="border-b border-slate-800 flex gap-2">
        {(['identidade', 'kpis', 'publicacoes'] as Aba[]).map(a => (
          <Link
            key={a}
            href={`/admin/portal/${ibge}?aba=${a}`}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              aba === a
                ? 'border-nexa-500 text-nexa-400'
                : 'border-transparent text-slate-400 hover:text-slate-300'
            }`}
          >
            {a === 'identidade' ? 'Identidade' : a === 'kpis' ? 'KPIs' : 'Publicações'}
          </Link>
        ))}
      </div>

      {aba === 'identidade' && <IdentidadeForm ibge={ibge} branding={branding} />}
      {aba === 'kpis' && <KpisForm ibge={ibge} kpis={kpis} />}
      {aba === 'publicacoes' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Link
              href={`/admin/portal/${ibge}/publicacao/nova`}
              className="rounded-md bg-nexa-600 px-4 py-2 text-sm font-semibold text-white hover:bg-nexa-500"
            >
              + Nova publicação
            </Link>
          </div>
          <div className="rounded-md border border-slate-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-800">
                <tr>
                  {['Título', 'Data', 'Ativo', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {publicacoes.map(p => (
                  <tr key={p.id} className="hover:bg-slate-800/50">
                    <td className="px-4 py-3 text-slate-300">{p.titulo}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      {p.data_evento ? new Date(p.data_evento).toLocaleDateString('pt-BR') : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <form action={togglePublicacao}>
                        <input type="hidden" name="id" value={p.id} />
                        <input type="hidden" name="ibge" value={ibge} />
                        <input type="hidden" name="ativo" value={String(p.ativo)} />
                        <button
                          type="submit"
                          className={`rounded px-2 py-0.5 text-xs font-semibold ${
                            p.ativo ? 'bg-green-900 text-green-300' : 'bg-slate-700 text-slate-300'
                          }`}
                        >
                          {p.ativo ? 'Ativo' : 'Inativo'}
                        </button>
                      </form>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/portal/${ibge}/publicacao/${p.id}`}
                        className="text-nexa-400 hover:text-nexa-300 text-sm"
                      >
                        Editar →
                      </Link>
                    </td>
                  </tr>
                ))}
                {publicacoes.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-slate-500 text-sm">
                      Nenhuma publicação ainda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Build limpo**

```bash
npm run build 2>&1 | tail -25
```

- [ ] **Step 6: Commit**

```bash
git add src/app/admin/portal/\[ibge\]/
git commit -m "feat: M7 — admin /admin/portal/[ibge] com 3 abas (identidade, KPIs, publicacoes)

- IdentidadeForm: upload de logo+brasao + cor primaria + dados do prefeito
- KpisForm: 4 slots editaveis (label/valor/sufixo)
- Aba Publicacoes: lista + toggle ativo + link para editor
- Todas as actions chamam revalidatePath('/p/{uf}/{slug}') na hora

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 15: Editor de publicação `/admin/portal/[ibge]/publicacao/[id]`

**Files:**
- Create: `src/app/admin/portal/[ibge]/publicacao/[id]/page.tsx`
- Create: `src/app/admin/portal/[ibge]/publicacao/[id]/actions.ts`
- Create: `src/app/admin/portal/[ibge]/publicacao/[id]/PublicacaoEditor.tsx`

Suporta `id = 'nova'` (criar) e `id = uuid` (editar). Upload de fotos client-side com preview, reorder, remove. Server actions: `salvarPublicacao`, `uploadFoto`, `removeFoto`, `deletePublicacao`.

- [ ] **Step 1: Criar `actions.ts`**

```typescript
// src/app/admin/portal/[ibge]/publicacao/[id]/actions.ts
'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { requireAdminClient } from '@/lib/require-admin'
import { UUID_RE } from '@/lib/format'
import type { PublicacaoFoto } from '@/types'

const IBGE_RE = /^\d{7}$/

async function revalidarPortal(ibge: string) {
  const admin = await requireAdminClient()
  const { data } = await admin
    .from('municipios_habilitacao')
    .select('uf, slug')
    .eq('ibge', ibge)
    .single()
  if (data) revalidatePath(`/p/${data.uf.toLowerCase()}/${data.slug}`)
}

export async function salvarPublicacao(formData: FormData) {
  const ibge = formData.get('ibge') as string
  const idRaw = (formData.get('id') as string) || 'nova'
  if (!IBGE_RE.test(ibge)) redirect('/admin/portal')

  const admin = await requireAdminClient()
  const { data: { user } } = await admin.auth.getUser()
  if (!user) redirect('/login')

  const titulo = ((formData.get('titulo') as string) ?? '').trim()
  if (!titulo) redirect(`/admin/portal/${ibge}/publicacao/${idRaw}?error=titulo_obrigatorio`)

  const descricao = ((formData.get('descricao') as string) ?? '').trim() || null
  const valor_destaque = ((formData.get('valor_destaque') as string) ?? '').trim() || null
  const data_evento = ((formData.get('data_evento') as string) ?? '').trim() || null
  const lat = parseFloat(formData.get('lat') as string)
  const lng = parseFloat(formData.get('lng') as string)
  const ativo = formData.get('ativo') === 'on'

  const payload = {
    municipio_ibge: ibge,
    aprovado_por: user.id,
    titulo,
    descricao,
    valor_destaque,
    data_evento,
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
    ativo,
    resumo_execucao: {} as Record<string, unknown>,
    publicado_em: new Date().toISOString(),
  }

  let novoId = idRaw
  if (idRaw === 'nova') {
    const { data, error } = await admin
      .from('publicacoes_portal')
      .insert(payload)
      .select('id')
      .single()
    if (error || !data) redirect(`/admin/portal/${ibge}?error=insert_failed`)
    novoId = data!.id
  } else {
    if (!UUID_RE.test(idRaw)) redirect('/admin/portal')
    const { error } = await admin
      .from('publicacoes_portal')
      .update(payload)
      .eq('id', idRaw)
      .eq('municipio_ibge', ibge)
    if (error) redirect(`/admin/portal/${ibge}/publicacao/${idRaw}?error=update_failed`)
  }

  await revalidarPortal(ibge)
  redirect(`/admin/portal/${ibge}/publicacao/${novoId}?ok=1`)
}

export async function uploadFoto(formData: FormData) {
  const ibge = formData.get('ibge') as string
  const id = formData.get('id') as string
  const file = formData.get('file') as File | null
  const alt = ((formData.get('alt') as string) ?? '').trim()
  if (!IBGE_RE.test(ibge) || !UUID_RE.test(id) || !file) {
    redirect(`/admin/portal/${ibge}/publicacao/${id}?error=upload_invalid`)
  }

  const admin = await requireAdminClient()
  const ext = file!.name.split('.').pop() || 'jpg'
  const path = `${ibge}/publicacao/${id}/${Date.now()}.${ext}`

  const { error: upErr } = await admin.storage
    .from('portal-fotos')
    .upload(path, file!, { contentType: file!.type })

  if (upErr) redirect(`/admin/portal/${ibge}/publicacao/${id}?error=upload_failed`)

  const { data: pub } = admin.storage.from('portal-fotos').getPublicUrl(path)

  const { data: existente } = await admin
    .from('publicacoes_portal')
    .select('fotos')
    .eq('id', id)
    .single()

  const fotos = ((existente?.fotos as PublicacaoFoto[]) ?? [])
  const novaOrdem = fotos.length === 0 ? 1 : Math.max(...fotos.map(f => f.ordem)) + 1
  fotos.push({ url: pub.publicUrl, alt: alt || 'Foto', ordem: novaOrdem })

  await admin.from('publicacoes_portal').update({ fotos }).eq('id', id)

  revalidatePath(`/admin/portal/${ibge}/publicacao/${id}`)
  await revalidarPortal(ibge)
  redirect(`/admin/portal/${ibge}/publicacao/${id}?ok=1`)
}

export async function removeFoto(formData: FormData) {
  const ibge = formData.get('ibge') as string
  const id = formData.get('id') as string
  const ordem = parseInt(formData.get('ordem') as string, 10)
  if (!IBGE_RE.test(ibge) || !UUID_RE.test(id)) redirect('/admin/portal')

  const admin = await requireAdminClient()
  const { data } = await admin.from('publicacoes_portal').select('fotos').eq('id', id).single()
  const fotos = ((data?.fotos as PublicacaoFoto[]) ?? []).filter(f => f.ordem !== ordem)
  await admin.from('publicacoes_portal').update({ fotos }).eq('id', id)

  revalidatePath(`/admin/portal/${ibge}/publicacao/${id}`)
  await revalidarPortal(ibge)
  redirect(`/admin/portal/${ibge}/publicacao/${id}`)
}

export async function deletePublicacao(formData: FormData) {
  const ibge = formData.get('ibge') as string
  const id = formData.get('id') as string
  if (!IBGE_RE.test(ibge) || !UUID_RE.test(id)) redirect('/admin/portal')

  const admin = await requireAdminClient()
  await admin.from('publicacoes_portal').delete().eq('id', id).eq('municipio_ibge', ibge)

  revalidatePath(`/admin/portal/${ibge}`)
  await revalidarPortal(ibge)
  redirect(`/admin/portal/${ibge}?aba=publicacoes`)
}
```

- [ ] **Step 2: Criar `PublicacaoEditor.tsx` (client para validação de upload)**

```tsx
// src/app/admin/portal/[ibge]/publicacao/[id]/PublicacaoEditor.tsx
'use client'

import { useState } from 'react'
import { validarFotoUpload } from '@/lib/upload'

export function PublicacaoFotoUpload() {
  const [erro, setErro] = useState<string | null>(null)

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const v = validarFotoUpload(file, 'publicacao')
    if (!v.valid) {
      setErro(v.erro ?? 'Inválido')
      e.target.value = ''
    } else {
      setErro(null)
    }
  }

  return (
    <div>
      <input
        type="file"
        name="file"
        accept="image/png,image/jpeg,image/webp"
        required
        onChange={onFileChange}
        className="text-sm text-slate-300"
      />
      {erro && <p className="mt-1 text-xs text-red-400">{erro}</p>}
    </div>
  )
}
```

- [ ] **Step 3: Criar a página**

```tsx
// src/app/admin/portal/[ibge]/publicacao/[id]/page.tsx
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { requireAdminClient } from '@/lib/require-admin'
import { UUID_RE } from '@/lib/format'
import { salvarPublicacao, uploadFoto, removeFoto, deletePublicacao } from './actions'
import { PublicacaoFotoUpload } from './PublicacaoEditor'
import type { PublicacaoPortal, PublicacaoFoto } from '@/types'

const IBGE_RE = /^\d{7}$/

interface PageProps {
  params: Promise<{ ibge: string; id: string }>
  searchParams: Promise<{ ok?: string; error?: string }>
}

export default async function PublicacaoEditPage({ params, searchParams }: PageProps) {
  const { ibge, id } = await params
  const { ok, error } = await searchParams

  if (!IBGE_RE.test(ibge)) notFound()
  const isNova = id === 'nova'
  if (!isNova && !UUID_RE.test(id)) notFound()

  const admin = await requireAdminClient()

  let publicacao: PublicacaoPortal | null = null
  if (!isNova) {
    const { data } = await admin
      .from('publicacoes_portal')
      .select('*')
      .eq('id', id)
      .eq('municipio_ibge', ibge)
      .single()
    if (!data) notFound()
    publicacao = data as PublicacaoPortal
  }

  const fotos = (publicacao?.fotos ?? []) as PublicacaoFoto[]
  const mapsLink = `https://www.google.com/maps/search/?api=1&query=${ibge}`

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link href={`/admin/portal/${ibge}?aba=publicacoes`} className="text-xs text-slate-400 hover:text-slate-300">
          ← Publicações
        </Link>
        <h1 className="text-xl font-bold text-slate-100">
          {isNova ? 'Nova publicação' : 'Editar publicação'}
        </h1>
      </div>

      {ok && (
        <div className="rounded-md bg-green-900/30 border border-green-700 px-4 py-2 text-sm text-green-300">Salvo.</div>
      )}
      {error && (
        <div className="rounded-md bg-red-900/30 border border-red-700 px-4 py-2 text-sm text-red-300">Erro: {error}</div>
      )}

      <form action={salvarPublicacao} className="rounded-md border border-slate-800 p-4 space-y-4">
        <input type="hidden" name="ibge" value={ibge} />
        <input type="hidden" name="id" value={id} />

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Título *</label>
          <input
            type="text"
            name="titulo"
            required
            defaultValue={publicacao?.titulo ?? ''}
            className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Descrição</label>
          <textarea
            name="descricao"
            rows={5}
            defaultValue={publicacao?.descricao ?? ''}
            className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Valor destaque (ex: R$ 2,3M)</label>
            <input
              type="text"
              name="valor_destaque"
              defaultValue={publicacao?.valor_destaque ?? ''}
              className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Data do evento</label>
            <input
              type="date"
              name="data_evento"
              defaultValue={publicacao?.data_evento ?? ''}
              className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Latitude</label>
            <input
              type="number"
              step="0.000001"
              name="lat"
              defaultValue={publicacao?.lat ?? ''}
              className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Longitude</label>
            <input
              type="number"
              step="0.000001"
              name="lng"
              defaultValue={publicacao?.lng ?? ''}
              className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
            />
          </div>
        </div>
        <p className="text-xs text-slate-500">
          <a href={mapsLink} target="_blank" rel="noopener noreferrer" className="text-nexa-400 hover:text-nexa-300">
            Buscar coordenadas no Google Maps
          </a>{' '}
          — clique com botão direito no ponto desejado, copie as coordenadas, cole acima.
        </p>

        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input type="checkbox" name="ativo" defaultChecked={publicacao?.ativo ?? false} />
          Ativo no portal (visível ao público)
        </label>

        <div className="flex justify-between items-center">
          <button
            type="submit"
            className="rounded-md bg-nexa-600 px-4 py-2 text-sm font-semibold text-white hover:bg-nexa-500"
          >
            {isNova ? 'Criar publicação' : 'Salvar alterações'}
          </button>

          {!isNova && (
            <form action={deletePublicacao}>
              <input type="hidden" name="ibge" value={ibge} />
              <input type="hidden" name="id" value={id} />
              <button
                type="submit"
                className="rounded-md bg-red-900/40 border border-red-800 px-3 py-1.5 text-xs text-red-300 hover:bg-red-900/60"
              >
                Excluir
              </button>
            </form>
          )}
        </div>
      </form>

      {!isNova && (
        <div className="rounded-md border border-slate-800 p-4 space-y-4">
          <h2 className="text-sm font-semibold text-slate-300">Fotos</h2>

          {fotos.length === 0 && (
            <p className="text-xs text-slate-500">Nenhuma foto ainda. Suba a primeira abaixo.</p>
          )}

          {fotos.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {fotos.sort((a, b) => a.ordem - b.ordem).map(f => (
                <div key={f.ordem} className="relative aspect-video rounded overflow-hidden bg-slate-900">
                  <Image src={f.url} alt={f.alt} fill className="object-cover" sizes="200px" />
                  <form action={removeFoto} className="absolute top-1 right-1">
                    <input type="hidden" name="ibge" value={ibge} />
                    <input type="hidden" name="id" value={id} />
                    <input type="hidden" name="ordem" value={f.ordem} />
                    <button
                      type="submit"
                      className="rounded bg-black/60 text-white text-xs px-2 py-0.5 hover:bg-black/80"
                      aria-label="Remover foto"
                    >
                      ×
                    </button>
                  </form>
                </div>
              ))}
            </div>
          )}

          <form action={uploadFoto} className="border-t border-slate-800 pt-4 space-y-3">
            <input type="hidden" name="ibge" value={ibge} />
            <input type="hidden" name="id" value={id} />
            <div>
              <label className="block text-xs text-slate-400 mb-1">Nova foto (PNG/JPG/WEBP, max 5MB)</label>
              <PublicacaoFotoUpload />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Texto alt (acessibilidade)</label>
              <input
                type="text"
                name="alt"
                placeholder="Ex: Crianças no CRAS Centro participando da atividade"
                className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
              />
            </div>
            <button
              type="submit"
              className="rounded-md bg-slate-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-600"
            >
              Enviar foto
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Build limpo**

```bash
npm run build 2>&1 | tail -25
```

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/portal/\[ibge\]/publicacao/
git commit -m "feat: M7 — editor de publicacao com upload de fotos + lat/lng + delete

Suporta id='nova' (criar) e UUID (editar). Upload validado client-side
via validarFotoUpload + server upserta no bucket portal-fotos. Foto
remove preserva ordem (filtrado por ordem). Server actions revalidam
o portal publico automaticamente.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 16: OG image final + verificação E2E manual

**Files:**
- Replace: `public/og-default.png` (com arte real 1200×630)

- [ ] **Step 1: Gerar OG image final**

Trocar o placeholder de 1×1 por um PNG real 1200×630 com a marca Nexa. Opções:
- **Opção A (recomendada)**: criar manualmente em qualquer editor (Figma, Canva) com fundo escuro slate-900 + texto branco "Portal de Transparência Municipal" + logo Nexa Radar. Salvar como `public/og-default.png`, sobrescrevendo o placeholder.
- **Opção B (rápida sem editor)**: usar ImageMagick:
  ```bash
  convert -size 1200x630 xc:'#0f172a' \
    -gravity center -fill '#0284c7' -pointsize 80 -annotate +0-40 'Nexa Radar' \
    -fill white -pointsize 40 -annotate +0+40 'Portal de Transparência Municipal' \
    public/og-default.png
  ```

Verificar:
```bash
file public/og-default.png
```
Esperado: `PNG image data, 1200 x 630`.

- [ ] **Step 2: Smoke test manual completo**

```bash
PID=$(lsof -i :3000 -t 2>/dev/null | head -1); [ -n "$PID" ] && kill "$PID" 2>/dev/null
rm -rf .next
nohup npm run dev > /tmp/nexa-dev.log 2>&1 &
sleep 18
```

Abrir browser e testar manualmente o fluxo:

1. **Login admin** → `/admin/portal` — vê tabela vazia.
2. **Habilitar Lagarto** — digitar `2803500` → submit → redirecionado para `/admin/portal/2803500`.
3. **Identidade**: subir um PNG qualquer como logo, escolher cor primária (#dc2626 vermelho pra contraste), nome do prefeito "Teste Silva", gestão "2025-2028". Salvar.
4. **KPIs**: preencher 3 slots (ex: "Captados" / "5.200.000" / "R$"; "Famílias" / "380" / sem sufixo; "Projetos" / "12" / sem sufixo). Salvar.
5. **Publicações** → **+ Nova publicação**: título "Inauguração Centro de Saúde Bairro Novo", descrição em 2 parágrafos, valor destaque "R$ 850k", data hoje, lat `-10.917` lng `-37.667` (centro de Lagarto), marcar Ativo, criar.
6. Voltar à edição, **subir 1-2 fotos** (qualquer JPG <5MB).
7. **Visualizar portal público** → abre nova aba em `/p/se/lagarto`:
   - Header vermelho (cor escolhida)
   - "Atualizado em ..." na data de hoje
   - 3 KPIs no topo (4º slot vazio)
   - Mapa renderiza com 1 pin
   - Card com foto + título + descrição + valor
8. **Clicar no card** → modal abre com fotos em carrossel + botões WhatsApp + Copiar link.
9. **Clicar no pin do mapa** → scroll suave até o card + ring nexa-500 por 2s.
10. **Botão "Copiar link"** → cola no devtools console: deve ser `http://localhost:3000/p/se/lagarto#pub-<UUID>`.
11. **Recarregar a URL copiada** → modal abre automaticamente.
12. **Voltar ao admin**: toggle Ativo → off. Voltar ao portal e recarregar → card sumiu, mapa renderiza vazio (sem pins).

- [ ] **Step 3: Commit final**

```bash
git add public/og-default.png
git commit -m "feat: M7 — OG image final + smoke test E2E manual aprovado

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

- [ ] **Step 4: Cleanup**

```bash
PID=$(lsof -i :3000 -t 2>/dev/null | head -1); [ -n "$PID" ] && kill "$PID" 2>/dev/null
```

---

## Verificação Final do Plano M7

- [ ] `npx tsc --noEmit --skipLibCheck` — 0 erros
- [ ] `npm run build` — limpo, rotas novas presentes: `/p/[uf]/[slug]`, `/admin/portal`, `/admin/portal/[ibge]`, `/admin/portal/[ibge]/publicacao/[id]`
- [ ] `npm test` — todos os testes passam (3 novos arquivos: slug, portal, upload + os existentes não regrediram)
- [ ] `python3 -m pytest scraper/tests/ -q` — 33 testes passam (zero regressão Python)
- [ ] Smoke test E2E passou (Task 16 step 2)
- [ ] Bucket `portal-fotos` está PÚBLICO no painel Supabase
- [ ] CSP header no `curl -I` inclui `https://*.supabase.co` em `img-src`

**Próximos módulos candidatos** (CLAUDE.md):
- M4 Casamento Emenda × OSCIP (médio escopo)
- M6 Prestação de Contas como Serviço (alto valor recorrente)
- M5 Inteligência Política completa (mapa de alianças, atualmente só briefing)
