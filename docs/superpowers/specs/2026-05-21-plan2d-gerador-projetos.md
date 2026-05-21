# Plan 2d — Gerador de Projetos Aprovávais (M3)
**Data:** 2026-05-21
**Status:** Aprovado (spec review round 2)
**Autor:** Luciano Menezes + Claude Code (brainstorming colaborativo)

---

## 1. Contexto

O Nexa Radar já entrega diagnóstico municipal (M2) e briefing parlamentar. O Gerador de Projetos (M3) fecha o ciclo: identifica o recurso disponível → estrutura o projeto que vai capturar esse recurso. É o produto de maior valor percebido pelo cliente (prefeito e OSCIP) porque resulta em um documento que pode ser submetido diretamente ao órgão federal.

**Escopo do Plan 2d:**
- Geração admin-only (mesma lógica de diagnóstico e briefing)
- 7 templates de programas públicos com padrões por órgão
- Saída: PDF + Word (.docx)
- Entrega ao cliente: manual (download pelo admin, envio por e-mail/WhatsApp)
- Sem portal de cliente nesta fase

---

## 2. Modelo de Dados

### Tabela `projetos`

```sql
CREATE TABLE projetos (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnostico_id       uuid REFERENCES diagnosticos(id),   -- nullable no DB; obrigatório na API v1
  municipio_ibge       text NOT NULL,
  gerado_por           uuid REFERENCES auth.users(id),
  template             text NOT NULL CHECK (template IN (
                         'scfv','tea','caps','idoso','esporte','saude_basica','educacao')),

  -- Inputs do formulário (persistidos para regeneração)
  objeto               text,
  justificativa        text,
  num_beneficiarios    integer,
  valor_solicitado     numeric,
  valor_contrapartida  numeric,
  prazo_meses          integer,
  oscip_executora      text,
  capacidade_instalada text,
  campos_extras        jsonb,   -- campos dinâmicos por template (modalidade CAPS, faixas SCFV, etc.)

  -- Saída gerada
  status               text NOT NULL DEFAULT 'gerando'
                         CHECK (status IN ('gerando','rascunho','erro')),
  secoes_ia            jsonb,   -- SecoesProjeto serializado
  pdf_url              text,    -- path no Storage bucket 'projetos'
  docx_url             text,    -- path no Storage bucket 'projetos'
  criado_em            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE projetos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "projetos_admin_all" ON projetos
  FOR ALL TO authenticated
  USING (_user_tipo() = 'admin');
```

**Índices:**
```sql
CREATE INDEX ON projetos (municipio_ibge, criado_em DESC);
CREATE INDEX ON projetos (status) WHERE status = 'gerando';

-- Dedup guard: impede geração simultânea do mesmo par (município, template)
-- Espelha diagnosticos_municipio_gerando_unique (migration 016) e briefings_parlamentar_gerando_unique (014)
CREATE UNIQUE INDEX projetos_municipio_template_gerando_unique
  ON projetos (municipio_ibge, template) WHERE status = 'gerando';
```

O POST `/api/projeto` deve tratar erro PostgreSQL 23505 (unique_violation) retornando 409 com mensagem clara.

### Realtime

```sql
-- Habilitar Realtime na tabela (necessário para polling via Supabase Realtime)
ALTER PUBLICATION supabase_realtime ADD TABLE projetos;
```

### Storage

Bucket `projetos` — **criado via Supabase MCP** antes de aplicar a migration (não é criável via SQL DDL):
```
supabase.create_bucket('projetos', { public: false })
```

A migration apenas adiciona a política RLS no bucket já existente:

```sql
CREATE POLICY "projetos_storage_admin"
ON storage.objects FOR ALL TO authenticated
USING (
  bucket_id = 'projetos'
  AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND tipo = 'admin')
);
```

---

## 3. Templates por Órgão

Cada template é um arquivo TypeScript em `src/lib/templates/` que exporta um `TemplateConfig`. Os 7 templates e seus órgãos:

| Template | Órgão | Fundo | Sistema de submissão |
|---|---|---|---|
| `scfv` | MDS / SUAS | FNAS | Transferegov |
| `tea` | MDS / SUAS | FNAS | Transferegov |
| `caps` | MS / SUS | FNS | Transferegov |
| `idoso` | MDS / SUAS | FNAS | Transferegov |
| `esporte` | ME | Orçamento ME | Transferegov |
| `saude_basica` | MS / SUS | FNS | FNS fundo-a-fundo / SCNES |
| `educacao` | MEC / FNDE | FNDE | SIGPC / SIMEC |

> **Nota:** `saude_basica` (PAB, ESF, NASF) opera via repasse fundo-a-fundo do FNS, não via Transferegov. O SCNES é usado para cadastro de equipes de saúde.

### Interface `TemplateConfig`

```ts
interface CampoForm {
  nome: string
  label: string
  tipo: 'text' | 'number' | 'select' | 'textarea' | 'checkbox' | 'multi-select'
  // 'checkbox': boolean sim/não (ex: TEA — exige laudo) → serializa como boolean em campos_extras
  // 'multi-select': múltiplas opções (ex: SCFV — faixas etárias) → serializa como string[] em campos_extras
  opcoes?: string[]   // para tipo 'select' e 'multi-select'
  obrigatorio: boolean
}

interface SecaoConfig {
  id: string          // ex: 'plano_de_trabalho'
  titulo: string      // ex: 'Plano de Trabalho'
  obrigatoria: boolean
  instrucoes: string  // instrução específica ao Claude para ESTA seção (inline no prompt)
}

interface RubricaOrcamento {
  codigo: string      // ex: '3.3.90.30'
  descricao: string   // ex: 'Material de Consumo'
  percentualMaximo?: number   // ex: 0.30 = 30% do valor total
}

interface TemplateConfig {
  nome: string
  orgao: string
  fundo: string
  camposEspecificos: CampoForm[]     // renderizados dinamicamente no formulário
  secoes: SecaoConfig[]               // ordem das seções no documento
  indicadores: string[]               // indicadores SUAS/SUS aceitos pelo órgão
  rubricas: RubricaOrcamento[]        // rubricas orçamentárias aceitas pelo órgão
  declaracoesObrigatorias: string[]   // texto literal das declarações exigidas
  promptInstrucoes: string            // contexto geral do órgão para o Claude (sistema/contexto, não por seção)
  disclaimer: string                  // disclaimer obrigatório do órgão
}
```

**Relação entre `promptInstrucoes` e `SecaoConfig.instrucoes`:**
- `promptInstrucoes` → bloco de contexto geral no início do prompt ("Este projeto segue as normas do FNAS/SUAS. O plano de trabalho deve usar a linguagem SUAS...")
- `SecaoConfig.instrucoes` → instrução inline antes de cada seção ("Para esta seção, liste metas físicas mensais com indicadores SUAS compatíveis...")

`gerarPromptProjeto()` monta: `[promptInstrucoes] + [dados do município e diagnóstico] + [para cada secao: instrucoes + pedido de geração]`.

### Campos dinâmicos por template

| Template | Campos extras |
|---|---|
| `scfv` | Faixas etárias (multi-select: criança / adolescente / idoso) |
| `tea` | Tipo de atendimento (centro-dia / domiciliar), exige laudo diagnóstico (sim/não) |
| `caps` | Modalidade (CAPS I / II / III / AD / Infanto-juvenil) |
| `idoso` | Modalidade (Centro-Dia / ILPI / Serviço Domiciliar) |
| `esporte` | Modalidades esportivas, faixa etária alvo, equipamentos solicitados |
| `saude_basica` | Tipo de equipe (ESF / NASF / UBS), número de equipes |
| `educacao` | Nível (fundamental / médio), programa FNDE (PNAE / PDDE / Proinfância) — o programa selecionado deve ser incluído no prompt para que Claude use a terminologia e os critérios corretos por sub-programa |

---

## 4. API Routes

### `POST /api/projeto`

**Input (body JSON):**
```ts
{
  diagnostico_id: string         // UUID — obrigatório na v1; nullable no DB reserva standalone futuro
  template: TemplateName
  objeto: string
  justificativa: string
  num_beneficiarios: number
  valor_solicitado: number
  valor_contrapartida: number
  prazo_meses: number            // 1–60
  oscip_executora?: string
  capacidade_instalada: string
  campos_extras: Record<string, unknown>  // validação estrutural delegada a validarInputsProjeto()
}
```

**`municipio_ibge` é derivado do diagnóstico** — não aceito no body. O POST busca o diagnóstico pelo `diagnostico_id` para obter e persistir o `municipio_ibge`. Isso evita divergência entre o body e o diagnóstico de origem.

**Comportamento:**
1. Valida UUID (`diagnostico_id`) e inputs comuns
2. Busca diagnóstico para extrair `municipio_ibge`
3. `validarInputsProjeto()` valida `campos_extras` contra o `TemplateConfig` do template escolhido
4. INSERT `status='gerando'` — trata erro 23505 com 409
5. Fire-and-forget `generateProjeto(id, diagnosticoId, template, inputs)`
6. Retorna `202 { id }`

### `GET /api/projeto/[id]`

Valida UUID → retorna `{ status, pdf_url, docx_url }`.

---

## 5. Pipeline de Geração

### `src/lib/claude.ts` — função `gerarProjeto`

Adicionar ao `claude.ts` existente:

```ts
export async function gerarProjeto(prompt: string): Promise<SecoesProjeto> {
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 8192,   // projetos longos — 4096 é insuficiente. CAPS pode precisar de 16384.
    messages: [{ role: 'user', content: prompt }],
  })
  // Guardar contra truncamento (especialmente em templates longos como CAPS)
  if (message.stop_reason === 'max_tokens') {
    throw new Error('Claude response truncated at max_tokens=8192 — considerar aumentar para 16384 se CAPS falhar sistematicamente')
  }
  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  // Extrair JSON do bloco ```json ... ``` se necessário
  const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) ?? text.match(/(\{[\s\S]*\})/)
  if (!jsonMatch) throw new Error('Claude não retornou JSON válido para projeto')
  return JSON.parse(jsonMatch[1]) as SecoesProjeto
}
```

O `timeout` do client já é 65s (configurado no wrapper existente).

### `src/lib/generateProjeto.tsx` (server-only)

Pipeline roda fire-and-forget em Node.js persistente (EasyPanel always-on). Duração total estimada: até ~80s (Claude ≤65s + renderização + uploads). Seguro porque o 202 já foi enviado antes do pipeline iniciar. Não compatível com Vercel serverless.

```
1. Buscar diagnóstico + dados do município em paralelo (Promise.all)
   └── municipioNome vem de municipios_habilitacao.nome (join por diagnostico.municipio_ibge)
2. Carregar TemplateConfig via registry
3. Montar prompt: gerarPromptProjeto(config, inputs, municipioNome, programasCriticos)
4. gerarProjeto(prompt) → SecoesProjeto via Claude (max_tokens: 8192)
5. Gerar PDF e Word em paralelo: Promise.all([renderToBuffer(ProjetoPDF), Packer.toBuffer(ProjetoDocx)])
6. Upload PDF e Word em paralelo: Promise.all([storage.upload(pdf), storage.upload(docx)])
7. UPDATE projetos SET status='rascunho', secoes_ia, pdf_url, docx_url
   └── catch: UPDATE status='erro' WHERE status='gerando'
```

*Regeneração intencional: o dedup index previne apenas geração concorrente do mesmo par. Uma vez concluída (status ≠ 'gerando'), o admin pode regenerar livremente.*

### Saída estruturada do Claude — `SecoesProjeto`

```ts
interface SecoesProjeto {
  // Seções estruturadas
  metas_fisicas: Array<{ trimestre: number; meta: string; quantidade: number }>
  indicadores: Array<{ nome: string; formula: string; meta: string }>
  cronograma: Array<{ etapa: string; mes_inicio: number; mes_fim: number }>
  orcamento: Array<{ rubrica: string; descricao: string; valor: number }>
  declaracoes: string[]

  // Seções narrativas — keyed por SecaoConfig.id
  // Contém o texto gerado para cada seção definida em TemplateConfig.secoes
  // Ex: { 'objeto': '...', 'justificativa': '...', 'plano_de_trabalho': '...' }
  secoes_texto: Record<string, string>
}
```

O PDF e o Word iteram `TemplateConfig.secoes` em ordem: para cada seção, buscam o texto em `secoes_texto[secao.id]`. Seções estruturadas (metas, indicadores, cronograma, orçamento) têm seus próprios campos tipados e são renderizadas com formatação tabular.

### Word generation — pacote `docx`

```ts
// src/lib/docx/projeto-docx.ts
import 'server-only'
import { Document, Paragraph, Table, Packer, ... } from 'docx'

export async function gerarProjetoDocx(
  config: TemplateConfig,
  secoes: SecoesProjeto,
  municipioNome: string,
  inputs: ProjetoInputs
): Promise<Buffer> {
  const doc = new Document({ sections: [...] })
  return Packer.toBuffer(doc)   // não usar toStream() — Buffer é mais simples para upload
}
```

Estrutura do documento: capa → identificação do proponente → seções em `TemplateConfig.secoes` order → disclaimer do órgão.

---

## 6. Admin UI

### `/admin/projeto/novo`

**Bloco 1 — Contexto (pré-preenchido ao selecionar diagnóstico)**
- Select: diagnóstico de origem (lista diagnósticos com status `rascunho` ou `entregue`) → ao selecionar, exibe município, programas críticos, valor em risco
- Select: template → determina campos extras, label do órgão e fundo

**Bloco 2 — Dados comuns**
- Objeto, justificativa, nº beneficiários, valor solicitado (R$), contrapartida (R$), prazo (meses), OSCIP executora (opcional), capacidade instalada

**Bloco 3 — Campos dinâmicos** (renderizados dinamicamente por `TemplateConfig.camposEspecificos` ao mudar o template)

Submit → `ProjetoForm` (client component, baseado em `BriefingForm.tsx`) chama POST `/api/projeto`, obtém o `id`, assina `postgres_changes` em `projetos WHERE id = {id}`, e permanece na página exibindo spinner até resolver:
- `status === 'rascunho'` → renderiza botão "Ver Projeto →" (link para `/admin/projeto/${id}`) — sem redirect automático (alinhado com BriefingForm)
- `status === 'erro'` → renderiza mensagem de erro na mesma página — sem redirect (redirect para página de erro seria confuso)

O redirect automático não ocorre — o admin decide quando navegar.

### `/admin/projeto/[id]`

- Status badge + timestamp
- Botão **↓ Baixar PDF** — `createSignedUrl(projeto.pdf_url, 3600)` do bucket `projetos`
- Botão **↓ Baixar Word** — `createSignedUrl(projeto.docx_url, 3600)` do bucket `projetos` (ambos gerados em paralelo no server component)
- Resumo: template · órgão · município · valor solicitado · nº beneficiários
- Seções geradas exibidas em acordeões colapsáveis — iterar `TemplateConfig.secoes`, exibir `secoes_ia?.secoes_texto[secao.id]` com guard de presença antes de renderizar
- Botão "Forçar reset" se status = 'gerando' há mais de 10 min (padrão existente)

### `/admin/projeto`

Lista: município (nome via join `municipios_habilitacao`) · template · valor solicitado · status · data. Ordenada por `criado_em DESC`, limite 50 por página.

### Sidebar admin

Adicionar item "Projetos" (ícone `FileCheck`) em `src/app/admin/layout.tsx`.

---

## 7. Lógica de Negócio (TDD)

### Tipos — `src/types/index.ts`

```ts
type TemplateName = 'scfv' | 'tea' | 'caps' | 'idoso' | 'esporte' | 'saude_basica' | 'educacao'
type StatusProjeto = 'gerando' | 'rascunho' | 'erro'

interface ProjetoInputs {
  diagnostico_id: string
  municipio_ibge: string          // derivado do diagnóstico pelo POST route
  template: TemplateName
  objeto: string
  justificativa: string
  num_beneficiarios: number
  valor_solicitado: number
  valor_contrapartida: number
  prazo_meses: number
  oscip_executora?: string
  capacidade_instalada: string
  campos_extras: Record<string, unknown>
}

interface Projeto {
  id: string
  diagnostico_id: string | null
  municipio_ibge: string
  gerado_por: string
  template: TemplateName
  objeto: string | null
  justificativa: string | null
  num_beneficiarios: number | null
  valor_solicitado: number | null
  valor_contrapartida: number | null
  prazo_meses: number | null
  oscip_executora: string | null
  capacidade_instalada: string | null
  campos_extras: Record<string, unknown> | null
  status: StatusProjeto
  secoes_ia: SecoesProjeto | null
  pdf_url: string | null
  docx_url: string | null
  criado_em: string
}

interface ValidationResult {
  valid: boolean
  errors: string[]
}

interface ItemOrcamento {
  rubrica: string
  descricao: string
  valor: number
}
```

### `src/lib/projeto.ts` — funções exportadas

```ts
// Valida campos comuns + campos_extras obrigatórios do template
validarInputsProjeto(inputs: ProjetoInputs, config: TemplateConfig): ValidationResult

// Distribui valor_solicitado entre as rubricas do template.
// Algoritmo: divisão proporcional por número de rubricas, respeitando percentualMaximo.
// Se uma rubrica teria valor > percentualMaximo * total, o excedente é redistribuído nas demais.
// Soma sempre igual a valor_solicitado.
calcularOrcamentoBase(config: TemplateConfig, valor: number, prazo: number): ItemOrcamento[]

// Monta o prompt completo para gerarProjeto() em claude.ts.
// Estrutura: promptInstrucoes + dados do município/diagnóstico + por seção: instrucoes + pedido de geração
// Retorna string que será passada diretamente para gerarProjeto(prompt)
gerarPromptProjeto(
  config: TemplateConfig,
  inputs: ProjetoInputs,
  municipioNome: string,
  programasCriticos: ProgramaCritico[]
): string
```

### `src/lib/__tests__/projeto.test.ts`

- `validarInputsProjeto`: campos obrigatórios ausentes, `valor_solicitado ≤ 0`, `prazo_meses` fora de 1–60, campo obrigatório em `campos_extras` ausente
- `calcularOrcamentoBase`: soma das rubricas = `valor_solicitado` (±1 centavo de arredondamento), rubrica não ultrapassa `percentualMaximo`
- `gerarPromptProjeto`: prompt contém nome do município, nome do órgão (`config.orgao`), pelo menos um indicador do template, e `instrucoes` da primeira seção

*Nota: Task 3 pode iniciar com um `TemplateConfig` mock mínimo — os templates completos da Task 2 não são necessários para os testes de lógica de negócio.*

### `src/lib/__tests__/generate-projeto.test.ts`

- Happy path: `updatePayloads` contém `{ status: 'rascunho', pdf_url: 'projeto-test-id.pdf', docx_url: 'projeto-test-id.docx' }`
- Erro Claude: `updatePayloads` contém `{ status: 'erro' }`
- Erro upload PDF: `updatePayloads` contém `{ status: 'erro' }`
- Resolve sem throw em qualquer cenário de erro

---

## 8. Regras de Negócio

- Todo projeto inclui disclaimer por órgão (`TemplateConfig.disclaimer`) — conforme exigência do CLAUDE.md
- `gerado_por` sempre preenchido com o UUID do admin autenticado (rastreabilidade)
- `campos_extras` persistido em JSONB para permitir regeneração futura sem perda de inputs
- Nenhum dado pessoal de beneficiário individual é armazenado — apenas totais agregados
- Validação de `campos_extras` é responsabilidade de `validarInputsProjeto()` — o POST route delega para ela

---

## 9. Tasks de Implementação

| # | Task | Depende de |
|---|---|---|
| 1 | Criar bucket `projetos` via Supabase MCP + migration: tabela `projetos`, índices, dedup index, RLS, storage policy, Realtime | — |
| 2 | `src/lib/templates/` — 7 TemplateConfig + index.ts registry | — |
| 3 | `src/lib/projeto.ts` — lógica pura + `src/lib/__tests__/projeto.test.ts` (TDD, mock TemplateConfig) | 2 |
| 4 | `gerarProjeto()` em `src/lib/claude.ts` (max_tokens: 8192, JSON parse com fallback) | — |
| 5 | `src/lib/pdf/projeto-pdf.tsx` — template PDF iterando `TemplateConfig.secoes` | 2 |
| 6 | `src/lib/docx/projeto-docx.ts` (server-only, `Packer.toBuffer()`) | 2 |
| 7 | `src/lib/generateProjeto.tsx` — pipeline async server-only | 3, 4, 5, 6 |
| 8 | API: `POST /api/projeto` (com 409 em 23505) + `GET /api/projeto/[id]` | 1, 7 |
| 9 | `/admin/projeto/novo` — formulário dinâmico com Realtime | 8 |
| 10 | `/admin/projeto/[id]` — detalhe + downloads + Forçar reset | 8 |
| 11 | `/admin/projeto` — lista com join municipios_habilitacao | 1 |
| 12 | Sidebar admin: link "Projetos" em `src/app/admin/layout.tsx` | 11 |
| 13 | `src/lib/__tests__/generate-projeto.test.ts` | 7 |
