# Plan 2d — Gerador de Projetos Aprovávais (M3)
**Data:** 2026-05-21
**Status:** Aprovado
**Autor:** Luciano Menezes + Claude Code (brainstorming colaborativo)

---

## 1. Contexto

O Nexa Radar já entrega diagnóstico municipal (M2) e briefing parlamentar. O Gerador de Projetos (M3) fecha o ciclo: identifica o recurso disponível → estrutura o projeto que vai capturar esse recurso. É o produto de maior valor percebido pelo cliente (prefeito e OSCIP) porque resulta em um documento que pode ser submetido diretamente ao órgão federal.

**Escopo do Plan 2d:**
- Geração admin-only (mesma lógica de diagnóstico e briefing)
- 7 templates de programas públicos
- Saída: PDF + Word (.docx)
- Entrega ao cliente: manual (download pelo admin, envio por e-mail/WhatsApp)
- Sem portal de cliente nesta fase

---

## 2. Modelo de Dados

### Tabela `projetos`

```sql
CREATE TABLE projetos (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnostico_id       uuid REFERENCES diagnosticos(id),   -- nullable: vínculo com diagnóstico de origem
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
  secoes_ia            jsonb,   -- JSON estruturado com todas as seções geradas pelo Claude
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
- `(municipio_ibge, criado_em DESC)` — lista por município
- `(status)` WHERE status = 'gerando' — monitoramento de stuck records

### Storage

Novo bucket `projetos` (separado de `relatorios` que serve diagnósticos e briefings). Admin-only via service role. Política RLS:

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
| `caps` | MS / SUS | FNS | Transferegov / SCTIE |
| `idoso` | MDS / SUAS | FNAS | Transferegov |
| `esporte` | ME | Orçamento ME | Transferegov / SNELIS |
| `saude_basica` | MS / SUS | FNS | REDE / Transferegov |
| `educacao` | MEC / FNDE | FNDE | SIGPC / SIMEC |

### Interface `TemplateConfig`

```ts
interface CampoForm {
  nome: string
  label: string
  tipo: 'text' | 'number' | 'select' | 'textarea'
  opcoes?: string[]   // para tipo 'select'
  obrigatorio: boolean
}

interface SecaoConfig {
  id: string          // ex: 'plano_de_trabalho'
  titulo: string      // ex: 'Plano de Trabalho'
  obrigatoria: boolean
  instrucoes: string  // instrução para o Claude nessa seção
}

interface RubricaOrcamento {
  codigo: string      // ex: '3.3.90.30'
  descricao: string   // ex: 'Material de Consumo'
  percentualMaximo?: number
}

interface TemplateConfig {
  nome: string
  orgao: string
  fundo: string
  camposEspecificos: CampoForm[]     // renderizados dinamicamente no formulário
  secoes: SecaoConfig[]               // ordem e estrutura do documento
  indicadores: string[]               // indicadores SUAS/SUS aceitos pelo órgão
  rubricas: RubricaOrcamento[]        // rubricas orçamentárias aceitas
  declaracoesObrigatorias: string[]   // texto literal das declarações exigidas
  promptInstrucoes: string            // instruções ao Claude sobre padrões do órgão
  disclaimer: string                  // disclaimer do órgão (diferente por programa)
}
```

### Campos dinâmicos por template (exemplos)

| Template | Campos extras |
|---|---|
| `scfv` | Faixas etárias (checkbox: criança / adolescente / idoso) |
| `tea` | Tipo de atendimento (centro-dia / domiciliar), exige laudo (sim/não) |
| `caps` | Modalidade (CAPS I / II / III / AD / Infanto-juvenil) |
| `idoso` | Modalidade (Centro-Dia / ILPI / Serviço Domiciliar) |
| `esporte` | Modalidades esportivas, faixa etária alvo, equipamentos |
| `saude_basica` | Tipo de equipe (ESF / NASF / UBS), número de equipes |
| `educacao` | Nível (fundamental / médio), programa FNDE (PNAE / PDDE / Proinfância) |

---

## 4. API Routes

### `POST /api/projeto`

**Input (body JSON):**
```ts
{
  diagnostico_id: string         // UUID do diagnóstico de origem — obrigatório na v1 (nullable no DB reserva standalone futuro)
  template: TemplateName
  objeto: string
  justificativa: string
  num_beneficiarios: number
  valor_solicitado: number
  valor_contrapartida: number
  prazo_meses: number
  oscip_executora?: string
  capacidade_instalada: string
  campos_extras: Record<string, unknown>  // campos dinâmicos do template
}
```

**Comportamento:** Valida UUID + inputs → INSERT `status='gerando'` → fire-and-forget `generateProjeto()` → retorna `202 { id }`.

### `GET /api/projeto/[id]`

Valida UUID → retorna `{ status, pdf_url, docx_url }` para polling.

---

## 5. Pipeline de Geração

### `src/lib/generateProjeto.tsx` (server-only)

```
1. Buscar diagnóstico + município em paralelo (Promise.all)
2. Carregar TemplateConfig do registry
3. Montar prompt com: instruções do órgão + inputs do admin + dados do diagnóstico
   └── Claude retorna SecoesProjeto (JSON com todas as seções)
4. Gerar PDF via @react-pdf/renderer (ProjetoPDF)
5. Gerar Word via pacote `docx` (ProjetoDocx)
6. Upload PDF → Storage: projetos/projeto-{id}.pdf
7. Upload Word → Storage: projetos/projeto-{id}.docx
8. UPDATE projetos SET status='rascunho', secoes_ia, pdf_url, docx_url
   └── catch: UPDATE status='erro' WHERE status='gerando'
```

### Saída estruturada do Claude

```ts
interface SecoesProjeto {
  objeto: string
  justificativa: string
  metas_fisicas: Array<{ trimestre: number; meta: string; quantidade: number }>
  indicadores: Array<{ nome: string; formula: string; meta: string }>
  cronograma: Array<{ etapa: string; mes_inicio: number; mes_fim: number }>
  orcamento: Array<{ rubrica: string; descricao: string; valor: number }>
  declaracoes: string[]
}
```

### Word generation — pacote `docx`

Instalar: `npm install docx` (não está no package.json atual). Gera `.docx` nativo em Node.js sem LibreOffice. Estrutura do documento segue `TemplateConfig.secoes`: capa → identificação do proponente → seções em ordem → disclaimer obrigatório do órgão.

---

## 6. Admin UI

### `/admin/projeto/novo`

**Bloco 1 — Contexto (pré-preenchido ao selecionar diagnóstico)**
- Select: diagnóstico de origem → exibe município, programas críticos, valor em risco
- Select: template → determina campos extras e label do órgão

**Bloco 2 — Dados comuns**
- Objeto, justificativa, nº beneficiários, valor solicitado, contrapartida, prazo, OSCIP, capacidade instalada

**Bloco 3 — Campos dinâmicos (renderizados pelo TemplateConfig.camposEspecificos)**

Submit → POST /api/projeto → redirect para `/admin/projeto/[id]` com Realtime polling (padrão existente).

### `/admin/projeto/[id]`

- Status badge + timestamp
- Download PDF (signed URL 1h)
- Download Word (signed URL 1h)
- Resumo dos inputs (template, município, valor, beneficiários)
- Seções geradas exibidas em accordions colapsáveis (revisão sem download)
- Botão "Forçar reset" se gerando há mais de 10 min

### `/admin/projeto`

Lista paginada: município · template · valor solicitado · status · data · link para detalhe.

### Sidebar admin

Adicionar item "Projetos" (ícone `FileCheck`) entre "Parlamentares" e demais itens existentes.

---

## 7. Lógica de Negócio (TDD)

### `src/lib/projeto.ts`

Tipos de suporte (adicionados a `src/types/index.ts`):
```ts
type TemplateName = 'scfv' | 'tea' | 'caps' | 'idoso' | 'esporte' | 'saude_basica' | 'educacao'
type StatusProjeto = 'gerando' | 'rascunho' | 'erro'

interface ProjetoInputs {
  diagnostico_id: string
  municipio_ibge: string
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
```

Funções exportadas:
```ts
validarInputsProjeto(inputs: ProjetoInputs, config: TemplateConfig): ValidationResult
calcularOrcamentoBase(config: TemplateConfig, valor: number, prazo: number): ItemOrcamento[]
gerarPromptProjeto(config: TemplateConfig, inputs: ProjetoInputs, municipioNome: string, programasCriticos: ProgramaCritico[]): string
```

### `src/lib/__tests__/projeto.test.ts`

- `validarInputsProjeto`: campos obrigatórios ausentes, valor ≤ 0, prazo fora de 1–60 meses
- `calcularOrcamentoBase`: soma das rubricas = valor solicitado, respeita percentuais máximos
- `gerarPromptProjeto`: prompt contém nome do município, nome do órgão, indicadores do template

### `src/lib/__tests__/generate-projeto.test.ts`

- Happy path: status atualizado para 'rascunho', pdf_url e docx_url preenchidos
- Erro Claude: status → 'erro'
- Erro upload: status → 'erro'
- Resolve sem throw em qualquer cenário de erro

---

## 8. Regras de Negócio

- Todo projeto gerado inclui disclaimer: *"Este documento foi gerado com auxílio de inteligência artificial. Revisar com especialista antes de submeter ao órgão."* (conforme CLAUDE.md)
- O disclaimer varia por órgão (texto no `TemplateConfig.disclaimer`)
- `gerado_por` é sempre preenchido — rastreabilidade de quem solicitou
- Campos `campos_extras` são persistidos em JSONB para permitir regeneração futura sem perda de inputs
- Nenhum dado pessoal de beneficiário individual é armazenado — apenas agregados (nº total)

---

## 9. Tasks de Implementação

| # | Task | Depende de |
|---|---|---|
| 1 | Migration: tabela `projetos` + RLS + bucket Storage `projetos` | — |
| 2 | `src/lib/templates/` — 7 TemplateConfig + index.ts | — |
| 3 | `src/lib/projeto.ts` — lógica pura + testes (TDD) | 2 |
| 4 | `src/lib/pdf/projeto-pdf.tsx` — template PDF por órgão | 2 |
| 5 | `src/lib/docx/projeto-docx.ts` — geração Word (`docx` package) | 2 |
| 6 | `src/lib/generateProjeto.tsx` — pipeline async | 3, 4, 5 |
| 7 | API: `POST /api/projeto` + `GET /api/projeto/[id]` | 1, 6 |
| 8 | `/admin/projeto/novo` — formulário dinâmico | 7 |
| 9 | `/admin/projeto/[id]` — detalhe + downloads + polling | 7 |
| 10 | `/admin/projeto` — lista | 1 |
| 11 | Sidebar admin: link "Projetos" | 10 |
| 12 | Testes `generate-projeto.test.ts` | 6 |
