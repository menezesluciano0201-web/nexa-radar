# M7 — Portal de Transparência Municipal

**Data:** 2026-05-25
**Status:** Aprovado (brainstorming)
**Autor:** Luciano Menezes + Claude Sonnet 4.6

---

## 1. Contexto e foco

O Nexa Radar já entrega M2 (diagnóstico), M3 (gerador de projetos) e M5-simplificado (briefing parlamentar). O M7 fecha o ciclo do prefeito: além de captar recurso (M2/M3), ele precisa **aparecer** entregando esse recurso. Portal de Transparência Municipal é a vitrine pública que materializa essa narrativa.

**Job-to-be-done primário:** showcase político. Prefeito divulga o link em entrevista/redes/campanha; cidadão leigo abre no celular e vê resultados de forma imediata.

**Audience hierarquia:**
1. Cidadão leigo (mobile) — UX primária
2. Prefeito (cliente) — comprador, quer narrativa controlada
3. Imprensa/MP/oposição — secundário (compliance LAI completo fica para versão futura)

**Não é escopo do MVP:**
- Compliance LAI estruturada (downloads CSV, série histórica, dados normalizados)
- Domínio próprio do município (transparencia.prefeitura.gov.br) — adiciona DNS/SSL complexity
- Widget JS embeddável em outros sites
- Automação a partir de M6 (que ainda não existe) — fica como evolução natural (M6 INSERTará em `publicacoes_portal`)

---

## 2. Modelo de dados

### Tabela `municipios_habilitacao` (existente — adicionar coluna)

```sql
ALTER TABLE municipios_habilitacao ADD COLUMN slug text;
CREATE UNIQUE INDEX municipios_habilitacao_uf_slug_unique ON municipios_habilitacao (uf, slug);

-- Backfill: slugify(unaccent(lower(nome)))
-- Ex: "Lagarto" → "lagarto", "São Paulo" → "sao-paulo"
UPDATE municipios_habilitacao
  SET slug = trim(both '-' from regexp_replace(
    translate(lower(nome),
      'áàâãäéèêëíìîïóòôõöúùûüçñ',
      'aaaaaeeeeiiiiooooouuuucn'),
    '[^a-z0-9]+', '-', 'g'
  ));

-- Resolver eventuais colisões (mesmo UF + nomes que viram mesmo slug):
-- adiciona sufixo -2, -3, etc. para duplicatas.
WITH ranked AS (
  SELECT ibge, slug, uf,
    ROW_NUMBER() OVER (PARTITION BY uf, slug ORDER BY ibge) AS rn
  FROM municipios_habilitacao
)
UPDATE municipios_habilitacao m
  SET slug = m.slug || '-' || ranked.rn
FROM ranked
WHERE m.ibge = ranked.ibge AND ranked.rn > 1;

ALTER TABLE municipios_habilitacao ALTER COLUMN slug SET NOT NULL;
```

### Tabela `publicacoes_portal` (existente — expandir)

```sql
ALTER TABLE publicacoes_portal
  ADD COLUMN descricao text,
  ADD COLUMN valor_destaque text,    -- ex: "R$ 2,3M" (texto livre pra flexibilidade de formato)
  ADD COLUMN fotos jsonb DEFAULT '[]'::jsonb,  -- array de { url, alt, ordem }
  ADD COLUMN lat numeric,
  ADD COLUMN lng numeric,
  ADD COLUMN data_evento date;       -- data da entrega/evento (≠ publicado_em)
```

`resumo_execucao` (JSONB existente) fica reservado pra evolução do M6 (estrutura formal de prestação de contas) — não usado no MVP.

### Tabela nova `municipios_branding`

```sql
CREATE TABLE municipios_branding (
  municipio_ibge   text PRIMARY KEY REFERENCES municipios_habilitacao(ibge),
  logo_url         text,
  brasao_url       text,
  cor_primaria     text DEFAULT '#0f766e',  -- teal-700 padrão Nexa
  prefeito_nome    text,
  prefeito_gestao  text,                     -- ex: "Gestão 2025-2028"
  atualizado_em    timestamptz NOT NULL DEFAULT now(),
  atualizado_por   uuid REFERENCES auth.users(id)
);

ALTER TABLE municipios_branding ENABLE ROW LEVEL SECURITY;

-- SELECT público (necessário pro portal anon)
CREATE POLICY branding_select_public ON municipios_branding FOR SELECT TO anon, authenticated USING (true);
-- Admin only para escrita
CREATE POLICY branding_admin_all ON municipios_branding FOR ALL TO authenticated
  USING (_user_tipo() = 'admin');
```

### Tabela nova `municipios_kpi_portal`

```sql
CREATE TABLE municipios_kpi_portal (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  municipio_ibge  text NOT NULL REFERENCES municipios_habilitacao(ibge),
  ordem           int NOT NULL CHECK (ordem BETWEEN 1 AND 4),
  label           text NOT NULL,             -- ex: "Captados"
  valor           text NOT NULL,             -- ex: "5.200.000" (texto pra flexibilidade)
  sufixo          text,                      -- ex: "R$", "famílias", "%"
  UNIQUE (municipio_ibge, ordem)
);

ALTER TABLE municipios_kpi_portal ENABLE ROW LEVEL SECURITY;

CREATE POLICY kpi_select_public ON municipios_kpi_portal FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY kpi_admin_all ON municipios_kpi_portal FOR ALL TO authenticated
  USING (_user_tipo() = 'admin');
```

### Tabela `publicacoes_portal` — política SELECT pública

A migration 020 já fez RLS explícito. Precisamos adicionar policy pra `anon`:

```sql
CREATE POLICY publicacoes_select_public ON publicacoes_portal FOR SELECT TO anon
  USING (ativo = true);
```

A policy existente continua válida para `authenticated`.

### Storage bucket `portal-fotos`

**Público** (sem signed URLs — performance + simplicidade pro CDN do Supabase). Path: `{ibge}/{tipo}/{arquivo}`, onde tipo ∈ {`logo`, `brasao`, `publicacao`}.

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('portal-fotos', 'portal-fotos', true)
ON CONFLICT (id) DO NOTHING;

-- Admin pode escrever
CREATE POLICY portal_fotos_admin_write ON storage.objects FOR ALL TO authenticated
USING (
  bucket_id = 'portal-fotos'
  AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND tipo = 'admin')
);
-- Leitura é pública por ser bucket público (sem policy necessária)
```

---

## 3. Roteamento e SEO

### URL pública
- Formato: `/p/{uf}/{slug}` — ex: `/p/se/lagarto`
- Lookup: `SELECT * FROM municipios_habilitacao WHERE lower(uf) = $1 AND slug = $2`
- `notFound()` se não existir

### SEO
- `generateMetadata`:
  - `title`: `"Transparência — Prefeitura de {nome} - {UF}"`
  - `description`: primeiro card ativo (até 160 chars) OU fallback `"Portal de transparência do município de {nome}"`
  - `og:image`: primeira foto da primeira publicação ativa OU `/og-default.png`
  - `og:type: website`
- Sem `robots.txt` específico — Next.js default permite indexação

### Cache
- Server component com `export const revalidate = 300` (5 min)
- Admin actions chamam `revalidatePath('/p/{uf}/{slug}')` após mutar publicações/KPIs/branding
- Resultado: cidadão vê alteração imediatamente após admin salvar

---

## 4. Frontend público — layout

Mobile-first, single page com 4 seções verticais:

```
┌──────────────────────────────────────┐
│ HEADER (cor primária do município)   │
│ [logo] Prefeitura de {nome}-{UF}     │
│        {prefeito_gestao}             │
├──────────────────────────────────────┤
│ HERO                                  │
│ "Portal de Transparência"            │
│ Atualizado em {última publicação}    │
├──────────────────────────────────────┤
│ KPIs (4 cards grandes em grid)       │
│ ┌─────┐┌─────┐┌─────┐┌─────┐         │
│ │R$5,2M││ 380 ││ 12  ││  4  │         │
│ │Captad││Famíl││Proj ││Em   │         │
│ └─────┘└─────┘└─────┘└─────┘         │
│ Grid: 4 cols desktop, 2 cols mobile  │
├──────────────────────────────────────┤
│ MAPA (~300px altura) — só renderiza   │
│ se ≥1 publicação tiver lat/lng        │
│ Pin click → scroll suave até card    │
├──────────────────────────────────────┤
│ RESULTADOS RECENTES                   │
│ Grid de cards: 3 cols desktop,        │
│ 1 col mobile                          │
│ Card: [foto] título / descrição /     │
│       valor_destaque / data           │
│ Click → modal com fotos carrossel +   │
│        descrição completa             │
├──────────────────────────────────────┤
│ FOOTER                                │
│ [brasão] Prefeitura Municipal de X    │
│ Powered by Nexa Radar (link discreto) │
└──────────────────────────────────────┘
```

### Componentes
- `<PortalHeader branding={...} />`
- `<PortalHero municipio={...} ultimaPublicacao={...} />`
- `<KpiBlock kpis={[...]} corPrimaria={...} />`
- `<MapaExecucao publicacoes={[...]} />` (dynamic import, ssr: false)
- `<CardsGrid publicacoes={[...]} onSelect={openModal} />`
- `<PublicacaoModal publicacao={...} onClose={...} />`
- `<PortalFooter branding={...} />`

### Mapa
- `react-leaflet` + OpenStreetMap (sem chave API)
- Center: lat/lng média das publicações OU coordenada do município
- Zoom inicial: 13 (cidade)
- Pin: marcador padrão com tooltip do título
- Click no pin: dispara `scrollIntoView({ behavior: 'smooth' })` no card correspondente + flash visual no card (border highlight 2s)

### Modal de publicação
- Carrossel de fotos (swipe touch + setas)
- Descrição completa
- Valor destaque + data evento
- Botões compartilhar: **WhatsApp** (wa.me com texto pré-formatado + URL) + **Copiar link** (clipboard com URL + hash `#pub-{id}`)
- Tecla `Esc` ou click fora fecha

### Compartilhamento
- Botão "📱 WhatsApp": `https://wa.me/?text=${encodeURIComponent('Veja: ' + titulo + ' — ' + url)}`
- Botão "🔗 Copiar link": `navigator.clipboard.writeText(url)` + toast "Copiado!"
- URL inclui hash `#pub-{id}` → ao abrir o link, página carrega + abre modal automaticamente desse id

---

## 5. Admin UI

### `/admin/portal` — lista geral
- Tabela: município | qtd publicações ativas | última atualização | botão "Configurar →" → `/admin/portal/{ibge}`
- Botão "+ Habilitar novo município": modal com select de `municipios_habilitacao` que NÃO têm `municipios_branding`. Ao selecionar → cria branding com defaults → redireciona para `/admin/portal/{ibge}`

### `/admin/portal/[ibge]` — gestão de UM município (3 abas)

**Aba "Identidade"**
- Upload logo (drop zone, max 2MB, PNG/JPG/SVG)
- Upload brasão (mesmo)
- Color picker: cor primária (input `type="color"` ou biblioteca leve)
- Input: prefeito_nome (text)
- Input: prefeito_gestao (text, ex: "Gestão 2025-2028")
- Botão "Visualizar portal público →" (abre `/p/{uf}/{slug}` em nova aba)
- Salvar = UPDATE em `municipios_branding` + revalidatePath

**Aba "KPIs"**
- 4 slots editáveis lado a lado, cada um com:
  - Input label (ex: "Captados")
  - Input valor (ex: "5.200.000")
  - Input sufixo opcional (ex: "R$", "famílias")
- Botão "Salvar todos" → UPSERT em `municipios_kpi_portal` (ordem 1-4) + revalidatePath

**Aba "Publicações"**
- Tabela: foto miniatura | título | data evento | toggle `ativo` | edit | delete
- Botão "+ Nova publicação" → `/admin/portal/{ibge}/publicacao/nova`
- Toggle `ativo` é INSTANT (server action `togglePublicacao` + revalidatePath)

### `/admin/portal/[ibge]/publicacao/[id]` — editor de publicação

(id = `nova` ou UUID existente)

Form:
- Input título (text, required)
- Textarea descricao
- Input valor_destaque (text, ex: "R$ 2,3M")
- Input date data_evento
- **Upload fotos**: drop zone + lista de previews. Cada foto tem: preview, input `alt`, botão "remover", botão "↑ ↓" pra reordenar.
- Input lat (number, 6 decimais)
- Input lng (number, 6 decimais)
- Link "Buscar coordenadas no Google Maps" (abre `https://maps.google.com/?q={nome-municipio}` em nova aba; usuário clica com o botão direito num ponto, copia "coordenadas", cola)
- Toggle "Ativo no portal"
- Salvar = UPSERT em `publicacoes_portal` + revalidatePath

### Sidebar admin
Adicionar item "Portal" com ícone `Globe` (lucide-react) entre "Projetos" e "Parlamentares".

---

## 6. Lógica de negócio

### Slug de município
- Função pura `slugifyMunicipio(nome: string): string` em `src/lib/slug.ts`
- Implementação: lowercase, unaccent, espaços/símbolos → `-`, trim de `-` em borda
- Usado: backfill na migration + no admin ao habilitar novo município (caso slug já tenha alterado)
- **Colisões**: garantido único por `(uf, slug)` via index. Caso surja conflito (raro — 2 municípios mesmo nome no mesmo estado), sufixo `-2` no slug do segundo

### Geração de URL share
- Função `gerarUrlShare(uf: string, slug: string, pubId?: string): string`
- Retorna URL absoluta usando `process.env.NEXT_PUBLIC_SITE_URL` (nova env var)
- Com pubId: adiciona `#pub-{id}` ao final
- Usado: botão "Copiar link" + WhatsApp share + og:url

### Validação de upload
- Função `validarFotoUpload(file: File): { ok: boolean; erro?: string }`
- Regras: `<= 5MB`, content-type ∈ {image/png, image/jpeg, image/webp, image/svg+xml}
- Para logo/brasão: aceita SVG; para publicação: só raster (PNG/JPG/WEBP)

### KPI ordering
- Função pura `ordenarKpis(kpis: KpiPortal[]): KpiPortal[]` — ordena por `ordem` asc, preenche slots vazios com null pra UI saber qual está vazio
- Usado: rendering do `<KpiBlock>` e form admin

---

## 7. Regras de negócio

- **`publicacoes_portal.ativo = false` é "rascunho"** — admin cria, edita à vontade, e só liga o toggle quando estiver pronto. Cidadão só vê `ativo = true`.
- **Fotos** ficam em `publicacoes_portal.fotos` como JSONB array `[{ url, alt, ordem }]`. Quando publicação é deletada, fotos NO STORAGE não são deletadas automaticamente (admin pode reusar URL). Cleanup é manual via `/admin/storage` (não escopo MVP).
- **Branding ausente**: se município não tem `municipios_branding`, portal mostra layout com defaults Nexa (cor teal, sem logo, sem brasão). Não bloqueia acesso ao portal.
- **Sem publicações**: portal mostra mensagem "Em breve, resultados da gestão serão publicados aqui." Não 404.
- **Sem KPIs configurados**: bloco KPIs simplesmente não aparece (não força placeholder vazio).
- **Sem coords em nenhuma publicação**: mapa simplesmente não renderiza.
- **OG image fallback**: arquivo `public/og-default.png` (1200×630) com logo Nexa + texto "Portal de Transparência Municipal".

---

## 8. Env vars novas

```env
NEXT_PUBLIC_SITE_URL=https://nexaradar.com.br   # base pra og:url e botão "Copiar link"
```

Default em dev: `http://localhost:3000`.

---

## 9. Performance

- Bucket `portal-fotos` é público → URLs servidas pelo CDN Supabase (sem signed URL roundtrip)
- Página pública usa `revalidate: 300` — ISR. Visitantes recebem HTML estático cacheado, mapa hidrata client-side
- Mapa só carrega o chunk Leaflet (~40KB gzipped) se houver coords; senão, lazy import nem dispara
- `<Image>` do Next.js em todas as fotos com `loading="lazy"` e `sizes` apropriados — bandwidth otimizado

---

## 10. Testes

- `src/lib/__tests__/slug.test.ts` (TDD) — `slugifyMunicipio` cobre: acentos, espaços, símbolos, edge cases (string vazia, só símbolos)
- `src/lib/__tests__/portal.test.ts` (TDD) — `ordenarKpis` (4 slots vazios, 2 preenchidos fora de ordem, etc.) + `gerarUrlShare` (com/sem pubId, com SITE_URL setada/não setada)
- `src/lib/__tests__/upload.test.ts` (TDD) — `validarFotoUpload` (tamanho ok/maior, mime types válidos/inválidos, distinção logo vs publicação)
- Sem teste E2E automatizado do upload — teste manual no fluxo geral

---

## 11. Disclaimer e responsabilidade

- Rodapé sempre exibe "Powered by Nexa Radar" (link com `rel="noopener noreferrer"`)
- Nenhum disclaimer de IA porque o conteúdo do portal é **manual do gestor** — não gerado por IA
- Responsabilidade legal: prefeito assina termo na contratação. Nexa só hospeda + estrutura.

---

## 12. Tasks de implementação (preview)

| # | Task | Depende de |
|---|---|---|
| 1 | Migration: slug em municipios_habilitacao + colunas em publicacoes_portal + branding + kpi + bucket + RLS | — |
| 2 | `src/lib/slug.ts` + tests (TDD) | — |
| 3 | `src/lib/portal.ts` (ordenarKpis, gerarUrlShare) + tests | — |
| 4 | `src/lib/upload.ts` (validarFotoUpload) + tests | — |
| 5 | Tipos: `PublicacaoPortal`, `MunicipioBranding`, `KpiPortal` em src/types | 1 |
| 6 | Página pública `/p/[uf]/[slug]/page.tsx` (server, metadata, layout, fetch) | 1, 3 |
| 7 | Componentes: `PortalHeader`, `PortalHero`, `KpiBlock`, `CardsGrid`, `PortalFooter` | 5, 6 |
| 8 | Componente `MapaExecucao` (dynamic + react-leaflet) | 5 |
| 9 | Componente `PublicacaoModal` (carrossel, share buttons) + auto-open via hash | 5, 7 |
| 10 | Admin `/admin/portal` (lista) | 1 |
| 11 | Admin `/admin/portal/[ibge]` (3 abas) — identidade, KPIs, publicações lista | 1, 4 |
| 12 | Admin `/admin/portal/[ibge]/publicacao/[id]` (form + upload) | 4, 11 |
| 13 | Server actions (CRUD branding, KPI, publicação, toggle ativo, upload foto) | 1, 4 |
| 14 | Sidebar admin: link "Portal" + ícone Globe | 11 |
| 15 | OG default + teste E2E manual | 6-14 |

Estimativa: ~14-15 tasks (similar ao M3 em escopo).
