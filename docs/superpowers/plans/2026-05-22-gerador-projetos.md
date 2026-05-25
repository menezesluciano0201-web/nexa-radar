# Nexa Radar — Plano 2d: Gerador de Projetos Aprovávais (M3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar o módulo M3: o admin seleciona um diagnóstico municipal, preenche um formulário por template (SCFV, TEA, CAPS, Idoso, Esporte, Saúde Básica, Educação), e o sistema gera um projeto aprovável em PDF + Word via Claude, salvo no bucket privado `projetos`.

**Architecture:** Mesma arquitetura async do Plan 2b/2c: POST `/api/projeto` cria registro + dispara `generateProjeto()` fire-and-forget (EasyPanel always-on). Cliente subscreve Realtime. PDF gerado com `@react-pdf/renderer`, Word com `docx` (Packer.toBuffer). Ambos salvos no bucket `projetos` (RLS admin-only).

**Tech Stack:** Next.js 15 App Router, TypeScript strict, @react-pdf/renderer 4.x, docx (a instalar), @supabase/ssr, Supabase Realtime, Vitest.

**Pré-requisito:** Plans 2a, 2b e 2c completos. `gerarProjeto()` será adicionado a `src/lib/claude.ts` existente.

**Spec de referência:** `docs/superpowers/specs/2026-05-21-plan2d-gerador-projetos.md`

---

## Mapa de Arquivos

| Arquivo | Responsabilidade |
|---|---|
| `supabase/migrations/026_projetos.sql` | Tabela `projetos`, índices, dedup index, RLS, storage policy, Realtime |
| `src/lib/templates/index.ts` | Registry: `getTemplate(name)` → `TemplateConfig` |
| `src/lib/templates/scfv.ts` | TemplateConfig SCFV |
| `src/lib/templates/tea.ts` | TemplateConfig TEA |
| `src/lib/templates/caps.ts` | TemplateConfig CAPS |
| `src/lib/templates/idoso.ts` | TemplateConfig Idoso |
| `src/lib/templates/esporte.ts` | TemplateConfig Esporte |
| `src/lib/templates/saude_basica.ts` | TemplateConfig Saúde Básica |
| `src/lib/templates/educacao.ts` | TemplateConfig Educação |
| `src/lib/projeto.ts` | Lógica pura: validarInputsProjeto, calcularOrcamentoBase, gerarPromptProjeto |
| `src/lib/__tests__/projeto.test.ts` | Vitest TDD para lógica pura |
| `src/lib/__tests__/generate-projeto.test.ts` | Vitest TDD para pipeline generateProjeto |
| `src/lib/pdf/projeto-pdf.tsx` | Template PDF @react-pdf/renderer |
| `src/lib/docx/projeto-docx.ts` | Geração Word com docx (server-only) |
| `src/lib/generateProjeto.tsx` | Pipeline async server-only |
| `src/app/api/projeto/route.ts` | POST: criar + disparar, 202 |
| `src/app/api/projeto/[id]/route.ts` | GET: status polling (admin-only) |
| `src/app/admin/projeto/novo/page.tsx` | Admin: formulário dinâmico por template |
| `src/components/projeto/ProjetoForm.tsx` | Client component: submit + Realtime |
| `src/app/admin/projeto/[id]/page.tsx` | Admin: ver projeto + downloads + reset |
| `src/app/admin/projeto/[id]/actions.ts` | Server action: forçarResetProjeto |
| `src/app/admin/projeto/page.tsx` | Admin: lista projetos com join municipios_habilitacao |
| `src/app/admin/layout.tsx` | Modificar: adicionar link "Projetos" na sidebar |
| `src/hooks/useGenerationPolling.ts` | Hook compartilhado: Realtime + polling + timeout para fluxos async |
| `src/components/briefing/BriefingForm.tsx` | Refatorar: usar `useGenerationPolling` |
| `src/components/diagnostico/DiagnosticoForm.tsx` | Refatorar: usar `useGenerationPolling` |

---

## Task 1: Migration — tabela `projetos`, bucket e RLS

**Files:**
- Create: `supabase/migrations/026_projetos.sql`

- [ ] **Step 1: Criar bucket via Supabase MCP**

O bucket não é criável via SQL DDL — deve ser criado via MCP antes da migration:

```
supabase.create_bucket('projetos', { public: false })
```

- [ ] **Step 2: Criar migration**

Criar `supabase/migrations/026_projetos.sql`:

```sql
-- 026_projetos.sql
-- Tabela de projetos aprovávais gerados pelo M3

CREATE TABLE projetos (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnostico_id       uuid REFERENCES diagnosticos(id),
  municipio_ibge       text NOT NULL,
  gerado_por           uuid REFERENCES auth.users(id),
  template             text NOT NULL CHECK (template IN (
                         'scfv','tea','caps','idoso','esporte','saude_basica','educacao')),
  objeto               text,
  justificativa        text,
  num_beneficiarios    integer,
  valor_solicitado     numeric,
  valor_contrapartida  numeric,
  prazo_meses          integer,
  oscip_executora      text,
  capacidade_instalada text,
  campos_extras        jsonb,
  status               text NOT NULL DEFAULT 'gerando'
                         CHECK (status IN ('gerando','rascunho','erro')),
  secoes_ia            jsonb,
  pdf_url              text,
  docx_url             text,
  criado_em            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE projetos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "projetos_admin_all" ON projetos
  FOR ALL TO authenticated
  USING (_user_tipo() = 'admin');

CREATE INDEX ON projetos (municipio_ibge, criado_em DESC);
CREATE INDEX ON projetos (status) WHERE status = 'gerando';

-- Dedup guard: impede geração simultânea do mesmo par (município, template)
CREATE UNIQUE INDEX projetos_municipio_template_gerando_unique
  ON projetos (municipio_ibge, template) WHERE status = 'gerando';

-- Storage RLS para bucket 'projetos' (bucket já criado via MCP)
CREATE POLICY "projetos_storage_admin"
ON storage.objects FOR ALL TO authenticated
USING (
  bucket_id = 'projetos'
  AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND tipo = 'admin')
);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE projetos;
```

- [ ] **Step 3: Aplicar via MCP**

Aplicar via Supabase MCP `apply_migration` no projeto `sfzuoqnzdhknmqtprfly`.

- [ ] **Step 4: Verificar**

```sql
SELECT table_name FROM information_schema.tables WHERE table_name = 'projetos';
SELECT policyname FROM pg_policies WHERE tablename = 'projetos';
SELECT indexname FROM pg_indexes WHERE tablename = 'projetos';
```

Esperado: tabela `projetos`, policy `projetos_admin_all`, índices incluindo `projetos_municipio_template_gerando_unique`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/026_projetos.sql
git commit -m "feat: add projetos table, RLS, dedup index, storage policy (M3)"
```

---

## Task 2: Templates — 7 TemplateConfig + registry

**Files:**
- Create: `src/lib/templates/scfv.ts`
- Create: `src/lib/templates/tea.ts`
- Create: `src/lib/templates/caps.ts`
- Create: `src/lib/templates/idoso.ts`
- Create: `src/lib/templates/esporte.ts`
- Create: `src/lib/templates/saude_basica.ts`
- Create: `src/lib/templates/educacao.ts`
- Create: `src/lib/templates/index.ts`

Adicionar ao `src/types/index.ts` as interfaces `CampoForm`, `SecaoConfig`, `RubricaOrcamento`, `TemplateConfig` e os tipos `TemplateName`, `StatusProjeto`, `ProjetoInputs`, `Projeto`, `ValidationResult`, `ItemOrcamento`, `SecoesProjeto` conforme spec.

- [ ] **Step 1: Adicionar tipos em `src/types/index.ts`**

```ts
export type TemplateName = 'scfv' | 'tea' | 'caps' | 'idoso' | 'esporte' | 'saude_basica' | 'educacao'
export type StatusProjeto = 'gerando' | 'rascunho' | 'erro'

export interface CampoForm {
  nome: string
  label: string
  tipo: 'text' | 'number' | 'select' | 'textarea' | 'checkbox' | 'multi-select'
  opcoes?: string[]
  obrigatorio: boolean
}

export interface SecaoConfig {
  id: string
  titulo: string
  obrigatoria: boolean
  instrucoes: string
}

export interface RubricaOrcamento {
  codigo: string
  descricao: string
  percentualMaximo?: number
}

export interface TemplateConfig {
  nome: string
  orgao: string
  fundo: string
  camposEspecificos: CampoForm[]
  secoes: SecaoConfig[]
  indicadores: string[]
  rubricas: RubricaOrcamento[]
  declaracoesObrigatorias: string[]
  promptInstrucoes: string
  disclaimer: string
}

export interface ProjetoInputs {
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

export interface Projeto {
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

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

export interface ItemOrcamento {
  rubrica: string
  descricao: string
  valor: number
}

export interface SecoesProjeto {
  metas_fisicas: Array<{ trimestre: number; meta: string; quantidade: number }>
  indicadores: Array<{ nome: string; formula: string; meta: string }>
  cronograma: Array<{ etapa: string; mes_inicio: number; mes_fim: number }>
  orcamento: Array<{ rubrica: string; descricao: string; valor: number }>
  declaracoes: string[]
  secoes_texto: Record<string, string>
}
```

- [ ] **Step 2: Criar `src/lib/templates/scfv.ts`**

```ts
import type { TemplateConfig } from '@/types'

export const scfv: TemplateConfig = {
  nome: 'Serviço de Convivência e Fortalecimento de Vínculos (SCFV)',
  orgao: 'MDS / SUAS',
  fundo: 'FNAS',
  camposEspecificos: [
    {
      nome: 'faixas_etarias',
      label: 'Faixas etárias atendidas',
      tipo: 'multi-select',
      opcoes: ['criança (0-12)', 'adolescente (13-17)', 'idoso (60+)'],
      obrigatorio: true,
    },
  ],
  secoes: [
    {
      id: 'objeto',
      titulo: 'Objeto',
      obrigatoria: true,
      instrucoes: 'Descreva o objeto do convênio de forma clara e objetiva, mencionando o serviço SCFV, o público-alvo e o município. Máximo 3 parágrafos.',
    },
    {
      id: 'justificativa',
      titulo: 'Justificativa',
      obrigatoria: true,
      instrucoes: 'Apresente dados sociais do município (vulnerabilidade, CRAS, CREAS) e justifique a necessidade do SCFV. Use linguagem SUAS. 4-6 parágrafos.',
    },
    {
      id: 'plano_de_trabalho',
      titulo: 'Plano de Trabalho',
      obrigatoria: true,
      instrucoes: 'Liste atividades mensais do SCFV por faixa etária. Inclua facilitadores, carga horária semanal, metodologia socioeducativa. Formato narrativo, não tabela.',
    },
    {
      id: 'capacidade_instalada',
      titulo: 'Capacidade Instalada da Proponente',
      obrigatoria: true,
      instrucoes: 'Descreva a estrutura física, equipe técnica e experiência prévia da entidade proponente na execução de serviços SUAS.',
    },
  ],
  indicadores: [
    'Número de usuários atendidos mensalmente',
    'Taxa de frequência dos usuários (mínimo 75%)',
    'Número de famílias com Plano de Acompanhamento Familiar (PAF)',
    'Percentual de usuários referenciados ao CRAS',
  ],
  rubricas: [
    { codigo: '3.3.90.36', descricao: 'Outros Serviços de Terceiros - Pessoa Física (facilitadores)', percentualMaximo: 0.50 },
    { codigo: '3.3.90.30', descricao: 'Material de Consumo (material socioeducativo)', percentualMaximo: 0.20 },
    { codigo: '3.3.90.39', descricao: 'Outros Serviços de Terceiros - Pessoa Jurídica', percentualMaximo: 0.20 },
    { codigo: '3.3.90.47', descricao: 'Obrigações Tributárias e Contributivas', percentualMaximo: 0.10 },
  ],
  declaracoesObrigatorias: [
    'A entidade declara estar em dia com suas obrigações fiscais, trabalhistas e previdenciárias.',
    'A entidade declara não estar impedida de firmar convênio com a Administração Pública Federal.',
    'A entidade declara que as informações prestadas são verdadeiras e assume responsabilidade por sua veracidade.',
  ],
  promptInstrucoes: `Este projeto segue as normas do FNAS/MDS para o Serviço de Convivência e Fortalecimento de Vínculos (SCFV), regulamentado pela Resolução CNAS nº 1/2013 e Tipificação Nacional de Serviços Socioassistenciais. Use terminologia SUAS: usuários (não "beneficiários"), referenciamento, matricialidade sociofamiliar, CRAS, CREAS, PAF, frequência mínima de 75%. O plano de trabalho deve ser compatível com a Orientação Técnica SCFV do MDS. Metas físicas devem ser mensuráveis e compatíveis com a capacidade instalada declarada.`,
  disclaimer: 'ATENÇÃO: Este documento foi gerado com apoio de inteligência artificial como ferramenta de apoio técnico. O conteúdo deve ser revisado por profissional habilitado do SUAS antes da submissão ao Transferegov. A responsabilidade legal pela veracidade das informações é exclusivamente do gestor público signatário.',
}
```

- [ ] **Step 3: Criar `src/lib/templates/tea.ts`**

```ts
import type { TemplateConfig } from '@/types'

export const tea: TemplateConfig = {
  nome: 'Serviço de Proteção Social para Pessoas com Deficiência (TEA)',
  orgao: 'MDS / SUAS',
  fundo: 'FNAS',
  camposEspecificos: [
    {
      nome: 'tipo_atendimento',
      label: 'Tipo de atendimento',
      tipo: 'select',
      opcoes: ['centro-dia', 'domiciliar'],
      obrigatorio: true,
    },
    {
      nome: 'exige_laudo',
      label: 'Exige laudo diagnóstico (TEA/CID F84)',
      tipo: 'checkbox',
      obrigatorio: false,
    },
  ],
  secoes: [
    {
      id: 'objeto',
      titulo: 'Objeto',
      obrigatoria: true,
      instrucoes: 'Descreva o objeto mencionando o serviço de proteção para pessoas com deficiência (TEA/CID F84), modalidade (centro-dia ou domiciliar), público-alvo e município.',
    },
    {
      id: 'justificativa',
      titulo: 'Justificativa',
      obrigatoria: true,
      instrucoes: 'Apresente dados epidemiológicos de TEA no município ou região, demanda reprimida, ausência de serviço equivalente. Referencie a Política Nacional de Saúde da Pessoa com Deficiência e a Lei Berenice Piana (nº 12.764/2012).',
    },
    {
      id: 'plano_de_trabalho',
      titulo: 'Plano de Trabalho',
      obrigatoria: true,
      instrucoes: 'Descreva as atividades especializadas: terapia ocupacional, fonoaudiologia, psicologia, suporte familiar. Inclua frequência semanal, equipe mínima (conforme Resolução CNAS nº 9/2013) e metodologia de acompanhamento individual.',
    },
    {
      id: 'capacidade_instalada',
      titulo: 'Capacidade Instalada',
      obrigatoria: true,
      instrucoes: 'Descreva estrutura física acessível (ABNT NBR 9050), profissionais com habilitação em TEA, experiência prévia comprovada com pessoas com deficiência.',
    },
  ],
  indicadores: [
    'Número de pessoas com deficiência atendidas mensalmente',
    'Número de famílias com Plano Individual de Atendimento (PIA)',
    'Percentual de atendimentos realizados conforme cronograma',
    'Número de encaminhamentos para rede socioassistencial e de saúde',
  ],
  rubricas: [
    { codigo: '3.3.90.36', descricao: 'Outros Serviços de Terceiros - PF (terapeutas, cuidadores)', percentualMaximo: 0.55 },
    { codigo: '3.3.90.30', descricao: 'Material de Consumo (insumos terapêuticos)', percentualMaximo: 0.15 },
    { codigo: '3.3.90.39', descricao: 'Outros Serviços de Terceiros - PJ', percentualMaximo: 0.20 },
    { codigo: '3.3.90.47', descricao: 'Obrigações Tributárias', percentualMaximo: 0.10 },
  ],
  declaracoesObrigatorias: [
    'A entidade declara estar em dia com suas obrigações fiscais, trabalhistas e previdenciárias.',
    'A entidade declara não estar impedida de firmar convênio com a Administração Pública Federal.',
    'A entidade declara possuir equipe técnica habilitada para atendimento especializado a pessoas com Transtorno do Espectro Autista.',
  ],
  promptInstrucoes: `Este projeto segue as normas do FNAS/MDS para serviços de proteção social especial para pessoas com deficiência, com foco em Transtorno do Espectro Autista (TEA/CID F84). Referencie a Lei Berenice Piana (12.764/2012), a Tipificação Nacional de Serviços Socioassistenciais e a Resolução CNAS nº 9/2013 (equipe de referência). Use linguagem SUAS: Plano Individual de Atendimento (PIA), referenciamento familiar, equipe interdisciplinar. Todos os serviços devem ser em espaço acessível (ABNT NBR 9050).`,
  disclaimer: 'ATENÇÃO: Este documento foi gerado com apoio de inteligência artificial. Deve ser revisado por profissional habilitado do SUAS e especialista em deficiência antes da submissão ao Transferegov. A responsabilidade legal é exclusivamente do gestor público signatário.',
}
```

- [ ] **Step 4: Criar `src/lib/templates/caps.ts`**

```ts
import type { TemplateConfig } from '@/types'

export const caps: TemplateConfig = {
  nome: 'Centro de Atenção Psicossocial (CAPS)',
  orgao: 'MS / SUS',
  fundo: 'FNS',
  camposEspecificos: [
    {
      nome: 'modalidade',
      label: 'Modalidade do CAPS',
      tipo: 'select',
      opcoes: ['CAPS I', 'CAPS II', 'CAPS III', 'CAPSad', 'CAPSi'],
      obrigatorio: true,
    },
  ],
  secoes: [
    {
      id: 'objeto',
      titulo: 'Objeto',
      obrigatoria: true,
      instrucoes: 'Descreva o objeto mencionando a modalidade CAPS, o porte do município, a clientela-alvo (transtornos mentais graves/persistentes ou uso de álcool e drogas) e a abrangência territorial.',
    },
    {
      id: 'justificativa',
      titulo: 'Justificativa',
      obrigatoria: true,
      instrucoes: 'Apresente indicadores epidemiológicos de saúde mental do município (internações psiquiátricas, CAPS/100mil hab, cobertura da RAPS). Referencie a Portaria GM/MS 3.088/2011 (RAPS) e a Portaria 3.588/2017 (habilitação CAPS). Justifique a modalidade escolhida pelo porte populacional.',
    },
    {
      id: 'plano_de_trabalho',
      titulo: 'Plano de Trabalho',
      obrigatoria: true,
      instrucoes: 'Descreva os serviços ofertados: acolhimento, atendimento individual, grupos terapêuticos, visita domiciliar, articulação com RAPS. Liste a equipe mínima conforme Portaria 3.588/2017 para a modalidade. Inclua carga horária de funcionamento.',
    },
    {
      id: 'capacidade_instalada',
      titulo: 'Capacidade Instalada',
      obrigatoria: true,
      instrucoes: 'Descreva estrutura física (área mínima por modalidade conforme RDC ANVISA 50), equipe técnica com registros profissionais, e experiência em saúde mental comunitária.',
    },
  ],
  indicadores: [
    'Número de usuários ativos (com PTS vigente)',
    'Taxa de adesão ao tratamento (frequência média)',
    'Número de internações psiquiátricas evitadas (estimativa)',
    'Número de atendimentos individuais realizados mensalmente',
    'Número de grupos terapêuticos realizados mensalmente',
  ],
  rubricas: [
    { codigo: '3.3.90.36', descricao: 'Outros Serviços de Terceiros - PF (profissionais de saúde)', percentualMaximo: 0.60 },
    { codigo: '3.3.90.30', descricao: 'Material de Consumo (medicamentos, insumos)', percentualMaximo: 0.15 },
    { codigo: '3.3.90.39', descricao: 'Outros Serviços de Terceiros - PJ', percentualMaximo: 0.15 },
    { codigo: '3.3.90.47', descricao: 'Obrigações Tributárias', percentualMaximo: 0.10 },
  ],
  declaracoesObrigatorias: [
    'A entidade declara estar em dia com suas obrigações fiscais, trabalhistas e previdenciárias.',
    'A entidade declara não estar impedida de firmar convênio com a Administração Pública Federal.',
    'A entidade declara que a equipe técnica possui registro nos respectivos conselhos profissionais.',
    'A entidade declara que as instalações atendem aos requisitos da RDC ANVISA 50/2002.',
  ],
  promptInstrucoes: `Este projeto segue as normas do FNS/MS para habilitação e custeio de Centro de Atenção Psicossocial (CAPS) na Rede de Atenção Psicossocial (RAPS). Referencie obrigatoriamente: Portaria GM/MS 3.088/2011 (institui a RAPS), Portaria 3.588/2017 (redefine CAPS e equipes mínimas), Lei 10.216/2001 (Reforma Psiquiátrica). Use terminologia SUS/RAPS: Projeto Terapêutico Singular (PTS), acolhimento, clínica ampliada, território, desinstitucionalização. A equipe mínima deve ser especificada conforme a modalidade CAPS escolhida (CAPS I: 11 profissionais; CAPS II: 13; CAPS III: 16 + noturno; CAPSad: 13; CAPSi: 11).`,
  disclaimer: 'ATENÇÃO: Este documento foi gerado com apoio de inteligência artificial. Deve ser revisado por profissional de saúde mental e gestor do SUS antes da submissão ao Transferegov. A habilitação do CAPS requer vistoria presencial do Ministério da Saúde. A responsabilidade legal é exclusivamente do gestor público signatário.',
}
```

- [ ] **Step 5: Criar `src/lib/templates/idoso.ts`**

```ts
import type { TemplateConfig } from '@/types'

export const idoso: TemplateConfig = {
  nome: 'Serviço de Proteção Social ao Idoso',
  orgao: 'MDS / SUAS',
  fundo: 'FNAS',
  camposEspecificos: [
    {
      nome: 'modalidade',
      label: 'Modalidade',
      tipo: 'select',
      opcoes: ['Centro-Dia', 'ILPI (Instituição de Longa Permanência)', 'Serviço Domiciliar'],
      obrigatorio: true,
    },
  ],
  secoes: [
    {
      id: 'objeto',
      titulo: 'Objeto',
      obrigatoria: true,
      instrucoes: 'Descreva o objeto mencionando a modalidade (Centro-Dia, ILPI ou Domiciliar), faixa etária (60+), vulnerabilidade-alvo e município. Referencie o Estatuto do Idoso (Lei 10.741/2003).',
    },
    {
      id: 'justificativa',
      titulo: 'Justificativa',
      obrigatoria: true,
      instrucoes: 'Apresente dados demográficos de idosos no município (IBGE), demanda reprimida por serviços, situações de abandono ou vulnerabilidade. Referencie PNAS, NOB-SUAS e Política Nacional do Idoso.',
    },
    {
      id: 'plano_de_trabalho',
      titulo: 'Plano de Trabalho',
      obrigatoria: true,
      instrucoes: 'Descreva atividades por modalidade: Centro-Dia (atividades socioeducativas, reabilitação, alimentação); ILPI (cuidados pessoais, saúde, convívio); Domiciliar (visitas, cuidados, fortalecimento familiar). Inclua equipe mínima conforme RDC ANVISA 283/2005 para ILPI.',
    },
    {
      id: 'capacidade_instalada',
      titulo: 'Capacidade Instalada',
      obrigatoria: true,
      instrucoes: 'Descreva estrutura física acessível, equipe de cuidadores e técnicos, e experiência comprovada com idosos.',
    },
  ],
  indicadores: [
    'Número de idosos atendidos mensalmente',
    'Taxa de frequência (Centro-Dia: mínimo 75%)',
    'Número de famílias com Plano de Acompanhamento Familiar',
    'Percentual de idosos com avaliação multidimensional realizada',
  ],
  rubricas: [
    { codigo: '3.3.90.36', descricao: 'Outros Serviços de Terceiros - PF (cuidadores, profissionais)', percentualMaximo: 0.55 },
    { codigo: '3.3.90.30', descricao: 'Material de Consumo (alimentação, higiene, insumos)', percentualMaximo: 0.20 },
    { codigo: '3.3.90.39', descricao: 'Outros Serviços de Terceiros - PJ', percentualMaximo: 0.15 },
    { codigo: '3.3.90.47', descricao: 'Obrigações Tributárias', percentualMaximo: 0.10 },
  ],
  declaracoesObrigatorias: [
    'A entidade declara estar em dia com suas obrigações fiscais, trabalhistas e previdenciárias.',
    'A entidade declara não estar impedida de firmar convênio com a Administração Pública Federal.',
    'A entidade declara que as instalações atendem ao Estatuto do Idoso (Lei 10.741/2003) e, quando aplicável, à RDC ANVISA 283/2005.',
  ],
  promptInstrucoes: `Este projeto segue as normas do FNAS/MDS para serviços de proteção social ao idoso, conforme Tipificação Nacional de Serviços Socioassistenciais (Resolução CNAS nº 109/2009) e Estatuto do Idoso (Lei 10.741/2003). Para ILPI: observe obrigatoriamente a RDC ANVISA 283/2005 (condições de funcionamento). Use terminologia SUAS: referenciamento, centralidade familiar, cuidado integrado. Idosos em ILPI devem ter Plano Individual de Atenção.`,
  disclaimer: 'ATENÇÃO: Este documento foi gerado com apoio de inteligência artificial. Deve ser revisado por profissional do SUAS antes da submissão ao Transferegov. Para ILPI, a operação exige licença sanitária da ANVISA/VISA municipal. A responsabilidade legal é exclusivamente do gestor público signatário.',
}
```

- [ ] **Step 6: Criar `src/lib/templates/esporte.ts`**

```ts
import type { TemplateConfig } from '@/types'

export const esporte: TemplateConfig = {
  nome: 'Programa de Esporte e Lazer',
  orgao: 'ME (Ministério do Esporte)',
  fundo: 'Orçamento ME',
  camposEspecificos: [
    {
      nome: 'modalidades_esportivas',
      label: 'Modalidades esportivas',
      tipo: 'text',
      obrigatorio: true,
    },
    {
      nome: 'faixa_etaria_alvo',
      label: 'Faixa etária principal',
      tipo: 'select',
      opcoes: ['crianças (6-12)', 'adolescentes (13-17)', 'jovens (18-29)', 'adultos (30-59)', 'idosos (60+)', 'misto'],
      obrigatorio: true,
    },
    {
      nome: 'equipamentos_solicitados',
      label: 'Equipamentos esportivos solicitados (lista)',
      tipo: 'textarea',
      obrigatorio: false,
    },
  ],
  secoes: [
    {
      id: 'objeto',
      titulo: 'Objeto',
      obrigatoria: true,
      instrucoes: 'Descreva o objeto: modalidades esportivas, público-alvo, município e resultados esperados em termos de inclusão social pelo esporte.',
    },
    {
      id: 'justificativa',
      titulo: 'Justificativa',
      obrigatoria: true,
      instrucoes: 'Apresente dados de vulnerabilidade social, ausência de infraestrutura esportiva, e potencial do esporte como ferramenta de inclusão. Referencie o Programa Esporte e Lazer da Cidade (PELC) e a Lei Pelé (9.615/1998) quando aplicável.',
    },
    {
      id: 'plano_de_trabalho',
      titulo: 'Plano de Trabalho',
      obrigatoria: true,
      instrucoes: 'Liste atividades por modalidade: treinamentos semanais, torneios, eventos de inclusão. Inclua carga horária, professores/monitores e locais de prática. Descreva como os equipamentos serão usados.',
    },
    {
      id: 'capacidade_instalada',
      titulo: 'Capacidade Instalada',
      obrigatoria: true,
      instrucoes: 'Descreva infraestrutura disponível (quadras, campos, ginásios), equipe de professores/monitores com formação, e experiência prévia em projetos esportivos.',
    },
  ],
  indicadores: [
    'Número de participantes ativos mensalmente',
    'Número de modalidades esportivas ofertadas',
    'Número de eventos/torneios realizados',
    'Percentual de participantes em situação de vulnerabilidade social',
  ],
  rubricas: [
    { codigo: '3.3.90.36', descricao: 'Outros Serviços de Terceiros - PF (professores, monitores)', percentualMaximo: 0.45 },
    { codigo: '4.4.90.52', descricao: 'Equipamentos e Material Permanente (equipamentos esportivos)', percentualMaximo: 0.35 },
    { codigo: '3.3.90.30', descricao: 'Material de Consumo (material esportivo de consumo)', percentualMaximo: 0.10 },
    { codigo: '3.3.90.39', descricao: 'Outros Serviços de Terceiros - PJ', percentualMaximo: 0.10 },
  ],
  declaracoesObrigatorias: [
    'A entidade declara estar em dia com suas obrigações fiscais, trabalhistas e previdenciárias.',
    'A entidade declara não estar impedida de firmar convênio com a Administração Pública Federal.',
    'A entidade declara que os equipamentos adquiridos serão utilizados exclusivamente para os fins do objeto conveniado.',
  ],
  promptInstrucoes: `Este projeto segue as normas do Ministério do Esporte para convênios de esporte e lazer. Referencie o Programa Esporte e Lazer da Cidade (PELC), a Lei Pelé (9.615/1998) e, se aplicável, o Programa Segundo Tempo (PST). Use linguagem de inclusão social pelo esporte: territórios vulneráveis, democratização do acesso, esporte educacional vs. rendimento. Equipamentos devem ser justificados pelo número de beneficiários e modalidades.`,
  disclaimer: 'ATENÇÃO: Este documento foi gerado com apoio de inteligência artificial. Deve ser revisado por gestor municipal de esportes antes da submissão ao Transferegov. A responsabilidade legal é exclusivamente do gestor público signatário.',
}
```

- [ ] **Step 7: Criar `src/lib/templates/saude_basica.ts`**

```ts
import type { TemplateConfig } from '@/types'

export const saude_basica: TemplateConfig = {
  nome: 'Atenção Primária à Saúde',
  orgao: 'MS / SUS',
  fundo: 'FNS',
  camposEspecificos: [
    {
      nome: 'tipo_equipe',
      label: 'Tipo de equipe',
      tipo: 'select',
      opcoes: ['ESF (Equipe de Saúde da Família)', 'NASF-AB', 'UBS sem ESF'],
      obrigatorio: true,
    },
    {
      nome: 'numero_equipes',
      label: 'Número de equipes implantadas/ampliadas',
      tipo: 'number',
      obrigatorio: true,
    },
  ],
  secoes: [
    {
      id: 'objeto',
      titulo: 'Objeto',
      obrigatoria: true,
      instrucoes: 'Descreva o objeto: tipo de equipe (ESF/NASF-AB/UBS), número de equipes, cobertura territorial estimada e município. Referencie a Política Nacional de Atenção Básica (PNAB 2017).',
    },
    {
      id: 'justificativa',
      titulo: 'Justificativa',
      obrigatoria: true,
      instrucoes: 'Apresente indicadores de cobertura da APS no município (% população coberta por ESF, número de UBS, IDSUS), mortalidade infantil, doenças crônicas prevalentes. Justifique a necessidade das equipes pelo déficit de cobertura.',
    },
    {
      id: 'plano_de_trabalho',
      titulo: 'Plano de Trabalho',
      obrigatoria: true,
      instrucoes: 'Descreva a composição das equipes (conforme PNAB: médico, enfermeiro, técnico de enfermagem, ACS), áreas de abrangência, ações programáticas (pré-natal, hipertensos/diabéticos, saúde da criança, saúde bucal). Para NASF-AB: liste profissionais e apoio matricial.',
    },
    {
      id: 'capacidade_instalada',
      titulo: 'Capacidade Instalada',
      obrigatoria: true,
      instrucoes: 'Descreva UBS disponível (área, equipamentos), sistema de informação (e-SUS APS), equipe de gestão municipal de saúde e histórico de cobertura ESF.',
    },
  ],
  indicadores: [
    'Percentual de população coberta pela ESF',
    'Número de consultas de pré-natal realizadas (≥6 consultas)',
    'Taxa de cobertura vacinal (DTP, poliomielite)',
    'Número de pacientes hipertensos/diabéticos acompanhados',
    'Número de visitas domiciliares por ACS mensalmente',
  ],
  rubricas: [
    { codigo: '3.3.90.36', descricao: 'Outros Serviços de Terceiros - PF (profissionais de saúde)', percentualMaximo: 0.65 },
    { codigo: '3.3.90.30', descricao: 'Material de Consumo (insumos, medicamentos básicos)', percentualMaximo: 0.15 },
    { codigo: '4.4.90.52', descricao: 'Equipamentos e Material Permanente (equipamentos médicos)', percentualMaximo: 0.10 },
    { codigo: '3.3.90.47', descricao: 'Obrigações Tributárias', percentualMaximo: 0.10 },
  ],
  declaracoesObrigatorias: [
    'O gestor municipal declara que as equipes serão cadastradas no CNES após habilitação.',
    'O gestor declara que o município atende aos requisitos de contrapartida do Piso da Atenção Básica (PAB).',
    'A entidade declara não estar impedida de firmar convênio com a Administração Pública Federal.',
  ],
  promptInstrucoes: `Este projeto segue as normas do FNS/MS para Atenção Primária à Saúde (APS), conforme Política Nacional de Atenção Básica (PNAB 2017 — Portaria 2.436/2017) e Nota Técnica de habilitação de ESF. IMPORTANTE: saúde básica opera via repasse fundo-a-fundo (FNS → Fundo Municipal de Saúde), não via Transferegov — mencione isso no contexto. O cadastro das equipes é feito no SCNES (Sistema de Cadastro Nacional de Estabelecimentos de Saúde). Use terminologia SUS/APS: adstrição de clientela, microárea, agente comunitário de saúde (ACS), território de saúde, Caderno de Ações Programáticas (CAP).`,
  disclaimer: 'ATENÇÃO: Este documento foi gerado com apoio de inteligência artificial. A habilitação de equipes ESF requer cadastro no SCNES e habilitação pelo DAB/MS. O repasse é fundo-a-fundo (FNS → FMS), não via Transferegov. Revisar com gestor municipal de saúde antes de qualquer encaminhamento. A responsabilidade legal é exclusivamente do gestor público signatário.',
}
```

- [ ] **Step 8: Criar `src/lib/templates/educacao.ts`**

```ts
import type { TemplateConfig } from '@/types'

export const educacao: TemplateConfig = {
  nome: 'Educação — Programas FNDE',
  orgao: 'MEC / FNDE',
  fundo: 'FNDE',
  camposEspecificos: [
    {
      nome: 'nivel',
      label: 'Nível de ensino',
      tipo: 'select',
      opcoes: ['educação infantil', 'ensino fundamental', 'ensino médio'],
      obrigatorio: true,
    },
    {
      nome: 'programa_fnde',
      label: 'Programa FNDE',
      tipo: 'select',
      opcoes: ['PNAE (Alimentação Escolar)', 'PDDE (Dinheiro Direto na Escola)', 'Proinfância (infraestrutura)'],
      obrigatorio: true,
    },
  ],
  secoes: [
    {
      id: 'objeto',
      titulo: 'Objeto',
      obrigatoria: true,
      instrucoes: 'Descreva o objeto mencionando o programa FNDE escolhido, o nível de ensino, o número de alunos beneficiados e o município. Use a terminologia correta do programa.',
    },
    {
      id: 'justificativa',
      titulo: 'Justificativa',
      obrigatoria: true,
      instrucoes: 'Para PNAE: apresente número de alunos matriculados, percentual que depende da alimentação escolar, situação de insegurança alimentar. Para PDDE: descreva necessidades de manutenção/aquisição e autonomia escolar. Para Proinfância: apresente déficit de vagas em creches/pré-escolas, demanda não atendida.',
    },
    {
      id: 'plano_de_trabalho',
      titulo: 'Plano de Trabalho',
      obrigatoria: true,
      instrucoes: 'Para PNAE: descreva cardápio, fornecedores locais (30% da agricultura familiar), nutricionista responsável. Para PDDE: liste itens de manutenção/aquisição por escola. Para Proinfância: descreva projeto de construção/reforma, metragem, padrão construtivo FNDE.',
    },
    {
      id: 'capacidade_instalada',
      titulo: 'Capacidade Instalada',
      obrigatoria: true,
      instrucoes: 'Descreva a rede de escolas municipais, equipe gestora do programa, sistema de controle (SIGPC/SIMEC) e histórico de prestação de contas anterior.',
    },
  ],
  indicadores: [
    'Número de alunos atendidos pelo programa',
    'Percentual de aquisição da agricultura familiar (PNAE: mínimo 30%)',
    'Número de escolas beneficiadas',
    'Taxa de execução financeira do programa (PDDE)',
  ],
  rubricas: [
    { codigo: '3.3.90.30', descricao: 'Material de Consumo (gêneros alimentícios PNAE / material didático)', percentualMaximo: 0.60 },
    { codigo: '4.4.90.51', descricao: 'Obras e Instalações (Proinfância)', percentualMaximo: 0.70 },
    { codigo: '4.4.90.52', descricao: 'Equipamentos e Material Permanente', percentualMaximo: 0.25 },
    { codigo: '3.3.90.39', descricao: 'Outros Serviços de Terceiros - PJ', percentualMaximo: 0.15 },
  ],
  declaracoesObrigatorias: [
    'O gestor municipal declara que o município está adimplente com o FNDE e com as prestações de contas anteriores.',
    'A entidade declara estar cadastrada no SIGPC/SIMEC e com dados atualizados.',
    'A entidade declara não estar impedida de firmar convênio com a Administração Pública Federal.',
  ],
  promptInstrucoes: `Este projeto segue as normas do FNDE/MEC para programas educacionais. A submissão é via SIGPC (PDDE, Proinfância) ou SIMEC — não pelo Transferegov padrão. Adapte a linguagem ao programa escolhido: PNAE (Lei 11.947/2009, resolução FNDE vigente, nutricionista responsável, 30% agricultura familiar); PDDE (resolução FNDE CD nº 5/2020, unidade executora, conselho escolar); Proinfância (Resolução CD/FNDE 6/2012, projeto padrão FNDE tipo B/C/D). Use terminologia FNDE: unidade executora, entidade mantenedora, prestação de contas via SIGPC.`,
  disclaimer: 'ATENÇÃO: Este documento foi gerado com apoio de inteligência artificial. A submissão de programas FNDE é feita via SIGPC ou SIMEC, não pelo Transferegov. Revisar com gestor municipal de educação e secretaria de finanças antes de qualquer encaminhamento. A responsabilidade legal é exclusivamente do gestor público signatário.',
}
```

- [ ] **Step 9: Criar `src/lib/templates/index.ts`**

```ts
import type { TemplateConfig, TemplateName } from '@/types'
import { scfv } from './scfv'
import { tea } from './tea'
import { caps } from './caps'
import { idoso } from './idoso'
import { esporte } from './esporte'
import { saude_basica } from './saude_basica'
import { educacao } from './educacao'

const registry: Record<TemplateName, TemplateConfig> = {
  scfv,
  tea,
  caps,
  idoso,
  esporte,
  saude_basica,
  educacao,
}

export function getTemplate(name: TemplateName): TemplateConfig {
  const config = registry[name]
  if (!config) throw new Error(`Template desconhecido: ${name}`)
  return config
}

export const TEMPLATE_NAMES: TemplateName[] = Object.keys(registry) as TemplateName[]
```

- [ ] **Step 10: TypeScript check**

```bash
npx tsc --noEmit --skipLibCheck 2>&1 | head -20
```

Esperado: 0 erros nos novos arquivos.

- [ ] **Step 11: Commit**

```bash
git add src/types/index.ts src/lib/templates/
git commit -m "feat: add 7 TemplateConfig + registry + types for M3 project generator"
```

---

## Task 3: Lógica de negócio — `src/lib/projeto.ts` (TDD)

**Files:**
- Create: `src/lib/__tests__/projeto.test.ts`
- Create: `src/lib/projeto.ts`

- [ ] **Step 1: Instalar `docx`**

```bash
npm install docx
```

Verificar: `cat package.json | grep '"docx"'`

- [ ] **Step 2: Criar testes ANTES da implementação**

Criar `src/lib/__tests__/projeto.test.ts`:

```typescript
import { describe, test, expect } from 'vitest'
import { validarInputsProjeto, calcularOrcamentoBase, gerarPromptProjeto } from '@/lib/projeto'
import type { TemplateConfig, ProjetoInputs, TemplateName } from '@/types'

// Mock TemplateConfig mínimo — independente dos templates reais (Task 2)
const mockConfig: TemplateConfig = {
  nome: 'Mock Template',
  orgao: 'Órgão Mock',
  fundo: 'Fundo Mock',
  camposEspecificos: [
    { nome: 'campo_obrigatorio', label: 'Campo', tipo: 'text', obrigatorio: true },
    { nome: 'campo_opcional', label: 'Opcional', tipo: 'text', obrigatorio: false },
  ],
  secoes: [
    { id: 'objeto', titulo: 'Objeto', obrigatoria: true, instrucoes: 'Instrução do objeto aqui.' },
    { id: 'justificativa', titulo: 'Justificativa', obrigatoria: true, instrucoes: 'Instrução da justificativa.' },
  ],
  indicadores: ['Indicador 1', 'Indicador 2'],
  rubricas: [
    { codigo: '3.3.90.36', descricao: 'Rubrica A', percentualMaximo: 0.60 },
    { codigo: '3.3.90.30', descricao: 'Rubrica B', percentualMaximo: 0.40 },
  ],
  declaracoesObrigatorias: ['Declaração 1'],
  promptInstrucoes: 'Contexto geral do órgão mock.',
  disclaimer: 'Disclaimer mock.',
}

function makeInputs(overrides: Partial<ProjetoInputs> = {}): ProjetoInputs {
  return {
    diagnostico_id: 'diag-uuid-123',
    municipio_ibge: '2803500',
    template: 'scfv' as TemplateName,
    objeto: 'Objeto do projeto',
    justificativa: 'Justificativa detalhada',
    num_beneficiarios: 100,
    valor_solicitado: 200_000,
    valor_contrapartida: 20_000,
    prazo_meses: 12,
    capacidade_instalada: 'Estrutura existente',
    campos_extras: { campo_obrigatorio: 'valor preenchido' },
    ...overrides,
  }
}

describe('validarInputsProjeto', () => {
  test('retorna válido com inputs corretos', () => {
    const result = validarInputsProjeto(makeInputs(), mockConfig)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  test('erro quando objeto está vazio', () => {
    const result = validarInputsProjeto(makeInputs({ objeto: '' }), mockConfig)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('objeto'))).toBe(true)
  })

  test('erro quando valor_solicitado <= 0', () => {
    const result = validarInputsProjeto(makeInputs({ valor_solicitado: 0 }), mockConfig)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('valor_solicitado'))).toBe(true)
  })

  test('erro quando prazo_meses fora de 1–60', () => {
    expect(validarInputsProjeto(makeInputs({ prazo_meses: 0 }), mockConfig).valid).toBe(false)
    expect(validarInputsProjeto(makeInputs({ prazo_meses: 61 }), mockConfig).valid).toBe(false)
    expect(validarInputsProjeto(makeInputs({ prazo_meses: 1 }), mockConfig).valid).toBe(true)
    expect(validarInputsProjeto(makeInputs({ prazo_meses: 60 }), mockConfig).valid).toBe(true)
  })

  test('erro quando campo obrigatório de campos_extras está ausente', () => {
    const result = validarInputsProjeto(makeInputs({ campos_extras: {} }), mockConfig)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('campo_obrigatorio'))).toBe(true)
  })

  test('campos_extras opcional ausente não gera erro', () => {
    const inputs = makeInputs({ campos_extras: { campo_obrigatorio: 'ok' } })
    const result = validarInputsProjeto(inputs, mockConfig)
    expect(result.valid).toBe(true)
  })
})

describe('calcularOrcamentoBase', () => {
  test('soma das rubricas igual a valor_solicitado', () => {
    const itens = calcularOrcamentoBase(mockConfig, 200_000, 12)
    const soma = itens.reduce((acc, i) => acc + i.valor, 0)
    expect(Math.abs(soma - 200_000)).toBeLessThanOrEqual(0.01)
  })

  test('nenhuma rubrica ultrapassa percentualMaximo', () => {
    const itens = calcularOrcamentoBase(mockConfig, 200_000, 12)
    for (const item of itens) {
      const rubrica = mockConfig.rubricas.find(r => r.codigo === item.rubrica)
      if (rubrica?.percentualMaximo) {
        expect(item.valor).toBeLessThanOrEqual(rubrica.percentualMaximo * 200_000 + 0.01)
      }
    }
  })

  test('retorna um item por rubrica do template', () => {
    const itens = calcularOrcamentoBase(mockConfig, 100_000, 6)
    expect(itens).toHaveLength(mockConfig.rubricas.length)
  })
})

describe('gerarPromptProjeto', () => {
  test('prompt contém nome do município', () => {
    const prompt = gerarPromptProjeto(mockConfig, makeInputs(), 'Lagarto', [])
    expect(prompt).toContain('Lagarto')
  })

  test('prompt contém nome do órgão', () => {
    const prompt = gerarPromptProjeto(mockConfig, makeInputs(), 'Lagarto', [])
    expect(prompt).toContain('Órgão Mock')
  })

  test('prompt contém ao menos um indicador do template', () => {
    const prompt = gerarPromptProjeto(mockConfig, makeInputs(), 'Lagarto', [])
    expect(prompt).toContain('Indicador 1')
  })

  test('prompt contém instrucoes da primeira seção', () => {
    const prompt = gerarPromptProjeto(mockConfig, makeInputs(), 'Lagarto', [])
    expect(prompt).toContain('Instrução do objeto aqui.')
  })

  test('prompt contém promptInstrucoes do template', () => {
    const prompt = gerarPromptProjeto(mockConfig, makeInputs(), 'Lagarto', [])
    expect(prompt).toContain('Contexto geral do órgão mock.')
  })
})
```

- [ ] **Step 3: Rodar testes (devem falhar — TDD red)**

```bash
npm test -- projeto.test 2>&1 | tail -10
```

Esperado: erro de import (arquivo não existe ainda).

- [ ] **Step 4: Criar `src/lib/projeto.ts`**

```ts
import type { TemplateConfig, ProjetoInputs, ValidationResult, ItemOrcamento } from '@/types'

export function validarInputsProjeto(
  inputs: ProjetoInputs,
  config: TemplateConfig
): ValidationResult {
  const errors: string[] = []

  if (!inputs.objeto?.trim()) errors.push('objeto é obrigatório')
  if (!inputs.justificativa?.trim()) errors.push('justificativa é obrigatória')
  if (!inputs.capacidade_instalada?.trim()) errors.push('capacidade_instalada é obrigatória')
  if (!inputs.num_beneficiarios || inputs.num_beneficiarios <= 0)
    errors.push('num_beneficiarios deve ser maior que 0')
  if (!inputs.valor_solicitado || inputs.valor_solicitado <= 0)
    errors.push('valor_solicitado deve ser maior que 0')
  if (!inputs.prazo_meses || inputs.prazo_meses < 1 || inputs.prazo_meses > 60)
    errors.push('prazo_meses deve estar entre 1 e 60')

  for (const campo of config.camposEspecificos) {
    if (campo.obrigatorio) {
      const val = inputs.campos_extras?.[campo.nome]
      if (val === undefined || val === null || val === '' ||
          (Array.isArray(val) && val.length === 0)) {
        errors.push(`campo obrigatório ausente: ${campo.nome}`)
      }
    }
  }

  return { valid: errors.length === 0, errors }
}

export function calcularOrcamentoBase(
  config: TemplateConfig,
  valor: number,
  _prazo: number
): ItemOrcamento[] {
  const rubricas = config.rubricas
  if (rubricas.length === 0) return []

  const maximos = rubricas.map(r => r.percentualMaximo ?? 1)
  const totalMax = maximos.reduce((a, b) => a + b, 0)

  const itens: ItemOrcamento[] = rubricas.map((r, i) => ({
    rubrica: r.codigo,
    descricao: r.descricao,
    valor: Math.floor((maximos[i] / totalMax) * valor * 100) / 100,
  }))

  // Ajuste de arredondamento: soma dos centavos deve fechar exatamente
  const soma = itens.reduce((acc, i) => acc + i.valor, 0)
  const diff = Math.round((valor - soma) * 100) / 100
  if (diff !== 0 && itens.length > 0) {
    itens[0] = { ...itens[0], valor: Math.round((itens[0].valor + diff) * 100) / 100 }
  }

  return itens
}

export function gerarPromptProjeto(
  config: TemplateConfig,
  inputs: ProjetoInputs,
  municipioNome: string,
  programasCriticos: Array<{ nome: string; valor_em_risco: number }>
): string {
  const secoesPrompt = config.secoes.map(s =>
    `### Seção: ${s.titulo}\n${s.instrucoes}\nGere o conteúdo desta seção agora.`
  ).join('\n\n')

  const programasStr = programasCriticos.length > 0
    ? `Programas críticos do município: ${programasCriticos.map(p => `${p.nome} (R$ ${p.valor_em_risco.toLocaleString('pt-BR')} em risco)`).join(', ')}`
    : 'Sem programas críticos identificados no diagnóstico.'

  return `${config.promptInstrucoes}

## Dados do Projeto

Município: ${municipioNome} (IBGE: ${inputs.municipio_ibge})
Órgão: ${config.orgao}
Fundo: ${config.fundo}
Template: ${config.nome}
Objeto declarado: ${inputs.objeto}
Justificativa declarada: ${inputs.justificativa}
Número de beneficiários: ${inputs.num_beneficiarios}
Valor solicitado: R$ ${inputs.valor_solicitado.toLocaleString('pt-BR')}
Contrapartida: R$ ${inputs.valor_contrapartida.toLocaleString('pt-BR')}
Prazo: ${inputs.prazo_meses} meses
OSCIP executora: ${inputs.oscip_executora ?? 'não informada'}
Capacidade instalada: ${inputs.capacidade_instalada}
Campos específicos: ${JSON.stringify(inputs.campos_extras, null, 2)}

${programasStr}

## Indicadores aceitos pelo órgão
${config.indicadores.map(i => `- ${i}`).join('\n')}

## Rubricas orçamentárias permitidas
${config.rubricas.map(r => `- ${r.codigo}: ${r.descricao}${r.percentualMaximo ? ` (máx. ${r.percentualMaximo * 100}%)` : ''}`).join('\n')}

## Declarações obrigatórias a incluir
${config.declaracoesObrigatorias.map(d => `- ${d}`).join('\n')}

## Disclaimer obrigatório
${config.disclaimer}

---

Gere o projeto completo em JSON com a seguinte estrutura:
\`\`\`json
{
  "metas_fisicas": [{ "trimestre": 1, "meta": "...", "quantidade": 0 }],
  "indicadores": [{ "nome": "...", "formula": "...", "meta": "..." }],
  "cronograma": [{ "etapa": "...", "mes_inicio": 1, "mes_fim": 3 }],
  "orcamento": [{ "rubrica": "3.3.90.36", "descricao": "...", "valor": 0 }],
  "declaracoes": ["..."],
  "secoes_texto": {
    ${config.secoes.map(s => `"${s.id}": "..."`).join(',\n    ')}
  }
}
\`\`\`

${secoesPrompt}

Retorne APENAS o JSON, sem texto adicional antes ou depois.`
}
```

- [ ] **Step 5: Rodar testes (devem passar — TDD green)**

```bash
npm test -- projeto.test 2>&1 | tail -15
```

Esperado: todos os testes passam.

- [ ] **Step 6: Commit**

```bash
git add src/lib/projeto.ts src/lib/__tests__/projeto.test.ts
git commit -m "feat: add projeto business logic with TDD (validar, calcular, prompt)"
```

---

## Task 4: `gerarProjeto()` em `src/lib/claude.ts`

**Files:**
- Modify: `src/lib/claude.ts`

- [ ] **Step 1: Adicionar função `gerarProjeto` ao `claude.ts` existente**

Adicionar ao final do arquivo (após `gerarBriefingParlamentar` ou equivalente):

```ts
export async function gerarProjeto(prompt: string): Promise<SecoesProjeto> {
  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 8192,
    messages: [{ role: 'user', content: prompt }],
  })
  if (message.stop_reason === 'max_tokens') {
    throw new Error('Claude response truncated — considerar max_tokens: 16384 para templates longos como CAPS')
  }
  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) ?? text.match(/(\{[\s\S]*\})/)
  if (!jsonMatch) throw new Error('Claude não retornou JSON válido para projeto')
  return JSON.parse(jsonMatch[1]) as SecoesProjeto
}
```

Adicionar import de `SecoesProjeto` no topo do arquivo se ainda não importado.

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit --skipLibCheck 2>&1 | grep -E 'claude\.ts|SecoesProjeto' | head -10
```

Esperado: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/lib/claude.ts
git commit -m "feat: add gerarProjeto() to claude.ts (max_tokens 8192, JSON parse)"
```

---

## Task 5: PDF — `src/lib/pdf/projeto-pdf.tsx`

**Files:**
- Create: `src/lib/pdf/projeto-pdf.tsx`

- [ ] **Step 1: Criar template PDF**

Criar `src/lib/pdf/projeto-pdf.tsx` seguindo o padrão de `briefing-pdf.tsx` e `diagnostico-pdf.tsx`:

```tsx
import 'server-only'
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import type { TemplateConfig, SecoesProjeto, ProjetoInputs } from '@/types'

const styles = StyleSheet.create({
  page: { padding: 48, fontSize: 10, fontFamily: 'Helvetica', color: '#1e293b' },
  capa: { marginBottom: 32, borderBottom: '2pt solid #0f172a', paddingBottom: 16 },
  titulo: { fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  subtitulo: { fontSize: 12, color: '#475569', marginBottom: 4 },
  secao: { marginTop: 20, marginBottom: 8 },
  secaoTitulo: { fontSize: 13, fontWeight: 'bold', marginBottom: 6, color: '#0f172a', borderBottom: '1pt solid #e2e8f0', paddingBottom: 4 },
  paragrafo: { lineHeight: 1.6, marginBottom: 6, textAlign: 'justify' },
  tabela: { marginTop: 8 },
  tabelaHeader: { flexDirection: 'row', backgroundColor: '#f1f5f9', padding: 6, fontWeight: 'bold' },
  tabelaRow: { flexDirection: 'row', padding: 5, borderBottom: '0.5pt solid #e2e8f0' },
  celula: { flex: 1, fontSize: 9 },
  celulaNarrow: { width: 60, fontSize: 9 },
  disclaimer: { marginTop: 24, padding: 10, backgroundColor: '#fef9c3', fontSize: 8, lineHeight: 1.5 },
  badge: { fontSize: 8, padding: '2 6', backgroundColor: '#dbeafe', color: '#1e40af', marginLeft: 8 },
})

interface Props {
  config: TemplateConfig
  secoes: SecoesProjeto
  municipioNome: string
  inputs: ProjetoInputs
}

export function ProjetoPDF({ config, secoes, municipioNome, inputs }: Props) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Capa */}
        <View style={styles.capa}>
          <Text style={styles.titulo}>{config.nome}</Text>
          <Text style={styles.subtitulo}>{municipioNome} — {config.orgao} / {config.fundo}</Text>
          <Text style={styles.subtitulo}>
            Valor solicitado: R$ {inputs.valor_solicitado.toLocaleString('pt-BR')} ·
            Prazo: {inputs.prazo_meses} meses ·
            Beneficiários: {inputs.num_beneficiarios}
          </Text>
          {inputs.oscip_executora && (
            <Text style={styles.subtitulo}>OSCIP executora: {inputs.oscip_executora}</Text>
          )}
        </View>

        {/* Seções narrativas */}
        {config.secoes.map(s => {
          const texto = secoes.secoes_texto?.[s.id]
          if (!texto) return null
          return (
            <View key={s.id} style={styles.secao}>
              <Text style={styles.secaoTitulo}>{s.titulo}</Text>
              <Text style={styles.paragrafo}>{texto}</Text>
            </View>
          )
        })}

        {/* Metas físicas */}
        {secoes.metas_fisicas?.length > 0 && (
          <View style={styles.secao}>
            <Text style={styles.secaoTitulo}>Metas Físicas</Text>
            <View style={styles.tabela}>
              <View style={styles.tabelaHeader}>
                <Text style={styles.celulaNarrow}>Trimestre</Text>
                <Text style={styles.celula}>Meta</Text>
                <Text style={styles.celulaNarrow}>Qtd.</Text>
              </View>
              {secoes.metas_fisicas.map((m, i) => (
                <View key={i} style={styles.tabelaRow}>
                  <Text style={styles.celulaNarrow}>{m.trimestre}º</Text>
                  <Text style={styles.celula}>{m.meta}</Text>
                  <Text style={styles.celulaNarrow}>{m.quantidade}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Indicadores */}
        {secoes.indicadores?.length > 0 && (
          <View style={styles.secao}>
            <Text style={styles.secaoTitulo}>Indicadores de Monitoramento</Text>
            <View style={styles.tabela}>
              <View style={styles.tabelaHeader}>
                <Text style={styles.celula}>Indicador</Text>
                <Text style={styles.celula}>Fórmula</Text>
                <Text style={styles.celulaNarrow}>Meta</Text>
              </View>
              {secoes.indicadores.map((ind, i) => (
                <View key={i} style={styles.tabelaRow}>
                  <Text style={styles.celula}>{ind.nome}</Text>
                  <Text style={styles.celula}>{ind.formula}</Text>
                  <Text style={styles.celulaNarrow}>{ind.meta}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Cronograma */}
        {secoes.cronograma?.length > 0 && (
          <View style={styles.secao}>
            <Text style={styles.secaoTitulo}>Cronograma de Execução</Text>
            <View style={styles.tabela}>
              <View style={styles.tabelaHeader}>
                <Text style={styles.celula}>Etapa</Text>
                <Text style={styles.celulaNarrow}>Início</Text>
                <Text style={styles.celulaNarrow}>Fim</Text>
              </View>
              {secoes.cronograma.map((c, i) => (
                <View key={i} style={styles.tabelaRow}>
                  <Text style={styles.celula}>{c.etapa}</Text>
                  <Text style={styles.celulaNarrow}>Mês {c.mes_inicio}</Text>
                  <Text style={styles.celulaNarrow}>Mês {c.mes_fim}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Orçamento */}
        {secoes.orcamento?.length > 0 && (
          <View style={styles.secao}>
            <Text style={styles.secaoTitulo}>Plano de Aplicação / Orçamento</Text>
            <View style={styles.tabela}>
              <View style={styles.tabelaHeader}>
                <Text style={styles.celulaNarrow}>Rubrica</Text>
                <Text style={styles.celula}>Descrição</Text>
                <Text style={styles.celulaNarrow}>Valor (R$)</Text>
              </View>
              {secoes.orcamento.map((o, i) => (
                <View key={i} style={styles.tabelaRow}>
                  <Text style={styles.celulaNarrow}>{o.rubrica}</Text>
                  <Text style={styles.celula}>{o.descricao}</Text>
                  <Text style={styles.celulaNarrow}>{o.valor.toLocaleString('pt-BR')}</Text>
                </View>
              ))}
              <View style={[styles.tabelaRow, { backgroundColor: '#f1f5f9' }]}>
                <Text style={styles.celulaNarrow}></Text>
                <Text style={[styles.celula, { fontWeight: 'bold' }]}>TOTAL</Text>
                <Text style={[styles.celulaNarrow, { fontWeight: 'bold' }]}>
                  {secoes.orcamento.reduce((a, o) => a + o.valor, 0).toLocaleString('pt-BR')}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Declarações */}
        {secoes.declaracoes?.length > 0 && (
          <View style={styles.secao}>
            <Text style={styles.secaoTitulo}>Declarações</Text>
            {secoes.declaracoes.map((d, i) => (
              <Text key={i} style={[styles.paragrafo, { marginLeft: 12 }]}>• {d}</Text>
            ))}
          </View>
        )}

        {/* Disclaimer */}
        <View style={styles.disclaimer}>
          <Text>{config.disclaimer}</Text>
        </View>
      </Page>
    </Document>
  )
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit --skipLibCheck 2>&1 | grep 'projeto-pdf' | head -5
```

Esperado: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/lib/pdf/projeto-pdf.tsx
git commit -m "feat: add ProjetoPDF template (@react-pdf/renderer, all sections)"
```

---

## Task 6: Word — `src/lib/docx/projeto-docx.ts`

**Files:**
- Create: `src/lib/docx/projeto-docx.ts`

- [ ] **Step 1: Criar `src/lib/docx/projeto-docx.ts`**

```ts
import 'server-only'
import {
  Document, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, Packer, WidthType,
} from 'docx'
import type { TemplateConfig, SecoesProjeto, ProjetoInputs } from '@/types'

function heading(text: string, level: (typeof HeadingLevel)[keyof typeof HeadingLevel] = HeadingLevel.HEADING_2) {
  return new Paragraph({ text, heading: level, spacing: { before: 300, after: 100 } })
}

function body(text: string) {
  return new Paragraph({
    children: [new TextRun({ text, size: 22 })],
    alignment: AlignmentType.JUSTIFIED,
    spacing: { before: 80, after: 80 },
  })
}

function tableRow(cells: string[], isHeader = false) {
  return new TableRow({
    children: cells.map(c => new TableCell({
      children: [new Paragraph({
        children: [new TextRun({ text: c, bold: isHeader, size: 18 })],
      })],
      width: { size: 100 / cells.length, type: WidthType.PERCENTAGE },
    })),
  })
}

export async function gerarProjetoDocx(
  config: TemplateConfig,
  secoes: SecoesProjeto,
  municipioNome: string,
  inputs: ProjetoInputs
): Promise<Buffer> {
  const children: (Paragraph | Table)[] = []

  // Capa
  children.push(
    new Paragraph({ text: config.nome, heading: HeadingLevel.HEADING_1, spacing: { after: 200 } }),
    body(`Município: ${municipioNome} | Órgão: ${config.orgao} | Fundo: ${config.fundo}`),
    body(`Valor solicitado: R$ ${inputs.valor_solicitado.toLocaleString('pt-BR')} | Prazo: ${inputs.prazo_meses} meses | Beneficiários: ${inputs.num_beneficiarios}`),
    new Paragraph({ text: '', spacing: { after: 200 } }),
  )

  // Seções narrativas
  for (const s of config.secoes) {
    const texto = secoes.secoes_texto?.[s.id]
    if (!texto) continue
    children.push(heading(s.titulo))
    children.push(body(texto))
  }

  // Metas físicas
  if (secoes.metas_fisicas?.length > 0) {
    children.push(heading('Metas Físicas'))
    children.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        tableRow(['Trimestre', 'Meta', 'Quantidade'], true),
        ...secoes.metas_fisicas.map(m => tableRow([`${m.trimestre}º`, m.meta, String(m.quantidade)])),
      ],
    }))
  }

  // Indicadores
  if (secoes.indicadores?.length > 0) {
    children.push(heading('Indicadores de Monitoramento'))
    children.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        tableRow(['Indicador', 'Fórmula', 'Meta'], true),
        ...secoes.indicadores.map(i => tableRow([i.nome, i.formula, i.meta])),
      ],
    }))
  }

  // Cronograma
  if (secoes.cronograma?.length > 0) {
    children.push(heading('Cronograma de Execução'))
    children.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        tableRow(['Etapa', 'Mês Início', 'Mês Fim'], true),
        ...secoes.cronograma.map(c => tableRow([c.etapa, `Mês ${c.mes_inicio}`, `Mês ${c.mes_fim}`])),
      ],
    }))
  }

  // Orçamento
  if (secoes.orcamento?.length > 0) {
    children.push(heading('Plano de Aplicação / Orçamento'))
    const total = secoes.orcamento.reduce((a, o) => a + o.valor, 0)
    children.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        tableRow(['Rubrica', 'Descrição', 'Valor (R$)'], true),
        ...secoes.orcamento.map(o => tableRow([o.rubrica, o.descricao, o.valor.toLocaleString('pt-BR')])),
        tableRow(['', 'TOTAL', total.toLocaleString('pt-BR')], true),
      ],
    }))
  }

  // Declarações
  if (secoes.declaracoes?.length > 0) {
    children.push(heading('Declarações'))
    for (const d of secoes.declaracoes) children.push(body(`• ${d}`))
  }

  // Disclaimer
  children.push(new Paragraph({ text: '', spacing: { before: 400 } }))
  children.push(new Paragraph({
    children: [new TextRun({ text: config.disclaimer, size: 16, italics: true, color: '92400e' })],
    spacing: { before: 100, after: 100 },
  }))

  const doc = new Document({
    sections: [{ children }],
  })

  return Packer.toBuffer(doc)
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit --skipLibCheck 2>&1 | grep 'projeto-docx' | head -5
```

Esperado: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/lib/docx/projeto-docx.ts
git commit -m "feat: add gerarProjetoDocx() Word generation with docx package"
```

---

## Task 7: Pipeline — `src/lib/generateProjeto.tsx`

**Files:**
- Create: `src/lib/generateProjeto.tsx`

- [ ] **Step 1: Criar pipeline**

```tsx
import 'server-only'
import { renderToBuffer } from '@react-pdf/renderer'
import { createAdminClient } from '@/lib/supabase/admin'
import { ProjetoPDF } from './pdf/projeto-pdf'
import { gerarProjetoDocx } from './docx/projeto-docx'
import { gerarProjeto } from './claude'
import { gerarPromptProjeto } from './projeto'
import { getTemplate } from './templates'
import type { ProjetoInputs, TemplateName } from '@/types'

export async function generateProjeto(
  projetoId: string,
  diagnosticoId: string,
  template: TemplateName,
  inputs: ProjetoInputs
): Promise<void> {
  const supabase = createAdminClient()

  try {
    // 1. Buscar diagnóstico + município em paralelo — erros propagam para o catch
    const [{ data: diagnostico, error: diagError }, { data: municipio, error: munError }] = await Promise.all([
      supabase
        .from('diagnosticos')
        .select('municipio_ibge, programas_criticos')
        .eq('id', diagnosticoId)
        .single(),
      supabase
        .from('municipios_habilitacao')
        .select('nome')
        .eq('ibge', inputs.municipio_ibge)
        .single(),
    ])
    if (diagError) throw diagError
    if (munError) throw munError

    const municipioNome = municipio!.nome
    const programasCriticos = diagnostico!.programas_criticos ?? []

    // 2. Carregar TemplateConfig
    const config = getTemplate(template)

    // 3. Montar prompt e gerar via Claude
    const prompt = gerarPromptProjeto(config, inputs, municipioNome, programasCriticos)
    const secoes = await gerarProjeto(prompt)

    // 4. Gerar PDF e Word em paralelo
    const [pdfBuffer, docxBuffer] = await Promise.all([
      renderToBuffer(<ProjetoPDF config={config} secoes={secoes} municipioNome={municipioNome} inputs={inputs} />),
      gerarProjetoDocx(config, secoes, municipioNome, inputs),
    ])

    // 5. Upload PDF e Word em paralelo
    const pdfPath = `projeto-${projetoId}.pdf`
    const docxPath = `projeto-${projetoId}.docx`

    const [pdfUpload, docxUpload] = await Promise.all([
      supabase.storage.from('projetos').upload(pdfPath, pdfBuffer, { contentType: 'application/pdf' }),
      supabase.storage.from('projetos').upload(docxPath, docxBuffer, {
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      }),
    ])
    if (pdfUpload.error || docxUpload.error) throw pdfUpload.error ?? docxUpload.error

    // 6. Atualizar registro como rascunho
    await supabase.from('projetos').update({
      status: 'rascunho',
      secoes_ia: secoes,
      pdf_url: pdfPath,
      docx_url: docxPath,
    }).eq('id', projetoId)

  } catch (err) {
    console.error('[generateProjeto] erro:', err)
    await supabase.from('projetos').update({ status: 'erro' })
      .eq('id', projetoId)
      .eq('status', 'gerando')
  }
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit --skipLibCheck 2>&1 | grep 'generateProjeto' | head -10
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/generateProjeto.tsx
git commit -m "feat: add generateProjeto pipeline (Claude → PDF + Word → Storage)"
```

---

## Task 8: API Routes

**Files:**
- Create: `src/app/api/projeto/route.ts`
- Create: `src/app/api/projeto/[id]/route.ts`

- [ ] **Step 1: Criar `src/app/api/projeto/route.ts`**

```ts
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateProjeto } from '@/lib/generateProjeto'
import { validarInputsProjeto } from '@/lib/projeto'
import { getTemplate } from '@/lib/templates'
import type { TemplateConfig, TemplateName } from '@/types'

export async function POST(req: Request) {
  // Auth check via user-scoped client
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('tipo').eq('id', user.id).single()
  if (!profile || profile.tipo !== 'admin')
    return NextResponse.json({ error: 'Proibido' }, { status: 403 })

  const body = await req.json()
  const {
    diagnostico_id, template, objeto, justificativa,
    num_beneficiarios, valor_solicitado, valor_contrapartida,
    prazo_meses, oscip_executora, capacidade_instalada, campos_extras
  } = body

  if (!diagnostico_id || typeof diagnostico_id !== 'string') {
    return NextResponse.json({ error: 'diagnostico_id obrigatório' }, { status: 400 })
  }

  const templateName = template as TemplateName
  let config: TemplateConfig
  try {
    config = getTemplate(templateName)
  } catch {
    return NextResponse.json({ error: `Template inválido: ${template}` }, { status: 400 })
  }

  // Todas as operações de dados via service role
  const admin = createAdminClient()

  const { data: diagnostico, error: diagError } = await admin
    .from('diagnosticos')
    .select('municipio_ibge')
    .eq('id', diagnostico_id)
    .single()

  if (diagError || !diagnostico) {
    return NextResponse.json({ error: 'Diagnóstico não encontrado' }, { status: 404 })
  }

  const municipio_ibge = diagnostico.municipio_ibge

  const inputs = {
    diagnostico_id, municipio_ibge, template: templateName,
    objeto, justificativa, num_beneficiarios, valor_solicitado,
    valor_contrapartida, prazo_meses, oscip_executora,
    capacidade_instalada, campos_extras: campos_extras ?? {},
  }

  const validation = validarInputsProjeto(inputs, config)
  if (!validation.valid) {
    return NextResponse.json({ error: validation.errors.join('; ') }, { status: 400 })
  }

  const { data: projeto, error: insertError } = await admin
    .from('projetos')
    .insert({
      diagnostico_id,
      municipio_ibge,
      gerado_por: user.id,
      template: templateName,
      objeto, justificativa, num_beneficiarios, valor_solicitado,
      valor_contrapartida, prazo_meses, oscip_executora,
      capacidade_instalada, campos_extras,
      status: 'gerando',
    })
    .select('id')
    .single()

  if (insertError) {
    if (insertError.code === '23505') {
      return NextResponse.json(
        { error: `Já existe uma geração em andamento para ${municipio_ibge}/${template}` },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  generateProjeto(projeto.id, diagnostico_id, templateName, inputs).catch(console.error)

  return NextResponse.json({ id: projeto.id }, { status: 202 })
}
```

- [ ] **Step 2: Criar `src/app/api/projeto/[id]/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { UUID_RE } from '@/lib/format'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('tipo').eq('id', user.id).single()
  if (!profile || profile.tipo !== 'admin')
    return NextResponse.json({ error: 'Proibido' }, { status: 403 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('projetos')
    .select('status, pdf_url, docx_url')
    .eq('id', id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  return NextResponse.json(data)
}
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit --skipLibCheck 2>&1 | grep 'api/projeto' | head -10
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/projeto/
git commit -m "feat: add POST /api/projeto and GET /api/projeto/[id] (202, 409 dedup)"
```

---

## Task 8.5: Extrair `useGenerationPolling` + refatorar forms existentes

**Files:**
- Create: `src/hooks/useGenerationPolling.ts`
- Modify: `src/components/briefing/BriefingForm.tsx`
- Modify: `src/components/diagnostico/DiagnosticoForm.tsx`

`BriefingForm` e `DiagnosticoForm` têm `useEffect` ~95% idêntico (Realtime + polling 5s + timeout 120s + cleanup). ProjetoForm (Task 9) seria a 3ª cópia. Esta task extrai o padrão como hook compartilhado **antes** do ProjetoForm ser criado, evitando 3 cópias divergentes.

- [ ] **Step 1: Criar `src/hooks/useGenerationPolling.ts`**

```ts
'use client'
import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

type Entity = 'briefing' | 'diagnostico' | 'projeto'

interface Options<S extends string> {
  id: string | null            // null = hook inativo (sem subscription/poll)
  entity: Entity               // deriva: table=`${entity}s`, channel=`${entity}-{id}`, url=`/api/${entity}/{id}`
  isTerminal: (status: S) => boolean
  onUpdate: (status: S) => void
  onTimeout: () => void
  timeoutMs?: number           // default 120_000
  pollMs?: number              // default 5_000
}

/**
 * Realtime + polling + safety timeout para monitorar `status` enquanto geração
 * async roda. Cleanup automático ao desmontar, atingir terminal, ou expirar
 * timeout. Callbacks via refs — caller não precisa memoizar.
 */
export function useGenerationPolling<S extends string>(opts: Options<S>) {
  const { id, entity, timeoutMs = 120_000, pollMs = 5_000 } = opts

  const isTerminalRef = useRef(opts.isTerminal)
  const onUpdateRef = useRef(opts.onUpdate)
  const onTimeoutRef = useRef(opts.onTimeout)
  isTerminalRef.current = opts.isTerminal
  onUpdateRef.current = opts.onUpdate
  onTimeoutRef.current = opts.onTimeout

  useEffect(() => {
    if (!id) return

    const supabase = createClient()
    let channel: ReturnType<typeof supabase.channel> | null = null
    let pollId: ReturnType<typeof setInterval> | null = null
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    let done = false   // guard contra race: poll in-flight resolvendo após cleanup

    function cleanup() {
      done = true
      channel?.unsubscribe()
      if (pollId) clearInterval(pollId)
      if (timeoutId) clearTimeout(timeoutId)
    }

    function handleStatus(status: S) {
      if (done) return
      if (typeof status !== 'string') return
      onUpdateRef.current(status)
      if (isTerminalRef.current(status)) cleanup()
    }

    channel = supabase
      .channel(`${entity}-${id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: `${entity}s`,
        filter: `id=eq.${id}`,
      }, payload => {
        handleStatus((payload.new as { status: S }).status)
      })
      .subscribe()

    pollId = setInterval(async () => {
      try {
        const res = await fetch(`/api/${entity}/${id}`)
        if (!res.ok) return
        const data = await res.json() as { status: S }
        handleStatus(data.status)
      } catch { /* ignora */ }
    }, pollMs)

    timeoutId = setTimeout(() => {
      cleanup()
      onTimeoutRef.current()
    }, timeoutMs)

    return cleanup
  }, [id, entity, timeoutMs, pollMs])
}
```

- [ ] **Step 2: Refatorar `src/components/briefing/BriefingForm.tsx`**

Substituir o bloco `useEffect(...)` + `pollRef`/`timeoutRef` por:

```ts
import { useGenerationPolling } from '@/hooks/useGenerationPolling'

// ... dentro do componente, remover useEffect/useRef de poll/timeout e adicionar:
useGenerationPolling<StatusBriefing>({
  id: briefingId,
  entity: 'briefing',
  isTerminal: s => s === 'rascunho' || s === 'erro',
  onUpdate: setStatus,
  onTimeout: () => setStatus('timeout'),
})
```

Remover imports `useEffect`, `useRef`, e `createClient from '@/lib/supabase/client'` se não usados em outro lugar.

- [ ] **Step 3: Refatorar `src/components/diagnostico/DiagnosticoForm.tsx`**

Mesma substituição:

```ts
import { useGenerationPolling } from '@/hooks/useGenerationPolling'

useGenerationPolling<StatusDiagnostico>({
  id: diagnosticoId,
  entity: 'diagnostico',
  isTerminal: s => s === 'rascunho' || s === 'erro',
  onUpdate: setStatus,
  onTimeout: () => setStatus('timeout'),
})
```

- [ ] **Step 4: Rodar testes existentes (regressão)**

```bash
npm test 2>&1 | tail -15
```

Esperado: todos os testes que já passavam continuam passando. Como o hook não tem dependências externas além de `@supabase/ssr` e o comportamento observável dos forms é idêntico, nenhum teste deve quebrar.

- [ ] **Step 5: Build check**

```bash
npm run build 2>&1 | tail -20
```

Esperado: build limpo, sem novos erros de tipo.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useGenerationPolling.ts \
        src/components/briefing/BriefingForm.tsx \
        src/components/diagnostico/DiagnosticoForm.tsx
git commit -m "refactor: extract useGenerationPolling hook (briefing, diagnostico)"
```

---

## Task 9: Admin UI — `/admin/projeto/novo`

**Files:**
- Create: `src/components/projeto/ProjetoForm.tsx`
- Create: `src/app/admin/projeto/novo/page.tsx`

- [ ] **Step 1: Criar `src/components/projeto/ProjetoForm.tsx`** (client component)

Baseado no `BriefingForm.tsx` existente. Responsabilidades: POST para `/api/projeto`, subscrição Realtime em `projetos WHERE id = {id}`, exibir spinner enquanto `status === 'gerando'`, botão "Ver Projeto →" quando `status === 'rascunho'`, mensagem de erro quando `status === 'erro'`.

```tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useGenerationPolling } from '@/hooks/useGenerationPolling'
import type { StatusProjeto, TemplateName } from '@/types'

interface Props {
  diagnosticoId: string
  template: TemplateName
  formData: Record<string, unknown>
}

type LocalStatus = StatusProjeto | 'idle' | 'timeout'

export function ProjetoForm({ diagnosticoId, template, formData }: Props) {
  const [estado, setEstado] = useState<LocalStatus>('idle')
  const [projetoId, setProjetoId] = useState<string | null>(null)
  const [erroMsg, setErroMsg] = useState<string | null>(null)
  const router = useRouter()

  useGenerationPolling<StatusProjeto>({
    id: projetoId,
    entity: 'projeto',
    isTerminal: s => s === 'rascunho' || s === 'erro',
    onUpdate: setEstado,
    onTimeout: () => setEstado('timeout'),
  })

  function resetar() {
    setEstado('idle')
    setErroMsg(null)
    setProjetoId(null)
  }

  async function handleSubmit() {
    setEstado('gerando')
    setErroMsg(null)

    const res = await fetch('/api/projeto', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ diagnostico_id: diagnosticoId, template, ...formData }),
    })

    if (!res.ok) {
      const json = await res.json()
      setErroMsg(json.error ?? 'Erro desconhecido')
      setEstado('erro')
      return
    }

    const { id } = await res.json()
    setProjetoId(id)
  }

  if (estado === 'idle') {
    return (
      <button
        onClick={handleSubmit}
        className="rounded-md bg-nexa-600 px-4 py-2 text-sm font-semibold text-white hover:bg-nexa-500"
      >
        Gerar Projeto
      </button>
    )
  }

  if (estado === 'gerando') {
    return (
      <div className="flex items-center gap-3 text-slate-400 text-sm">
        <svg className="animate-spin h-4 w-4 text-nexa-400" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
        Gerando projeto... (pode levar até 90s)
      </div>
    )
  }

  if (estado === 'rascunho' && projetoId) {
    return (
      <button
        onClick={() => router.push(`/admin/projeto/${projetoId}`)}
        className="inline-flex items-center gap-2 rounded-md bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-600"
      >
        Ver Projeto →
      </button>
    )
  }

  const mensagem = estado === 'timeout'
    ? 'A geração demorou mais que 120s. Verifique a página de detalhe ou tente novamente.'
    : (erroMsg ?? 'Erro na geração do projeto. Tente novamente.')

  return (
    <div className="space-y-3">
      <div className="rounded-md bg-red-900/40 border border-red-800 p-4 text-sm text-red-300">
        {mensagem}
      </div>
      <button
        onClick={resetar}
        className="rounded-md bg-slate-700 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-600"
      >
        Tentar novamente
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Criar `src/app/admin/projeto/novo/page.tsx`**

Server component que carrega lista de diagnósticos rascunho/entregue e os templates. Renderiza formulário estático (Bloco 1: selecionar diagnóstico e template; Bloco 2: campos comuns; Bloco 3: campos dinâmicos do template via JS no client). O `ProjetoForm` encapsula o submit e o polling.

A página deve:
- Buscar diagnósticos via `supabase.from('diagnosticos').select('id, municipio_ibge, status, criado_em').in('status', ['rascunho', 'entregue'])`
- Listar os 7 templates disponíveis com label e órgão
- Ao submeter, enviar todos os campos via `ProjetoForm`

> Implementar como form controlado em client component separado `ProjetoFormCompleto` que encapsula todos os campos e usa `ProjetoForm` apenas para o botão + status. Alternativamente, implementar como `'use client'` page completa — decisão pragmática conforme padrão existente no projeto.

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit --skipLibCheck 2>&1 | grep 'projeto/novo' | head -5
```

- [ ] **Step 4: Commit**

```bash
git add src/components/projeto/ src/app/admin/projeto/novo/
git commit -m "feat: add /admin/projeto/novo with dynamic form and Realtime polling"
```

---

## Task 10: Admin UI — `/admin/projeto/[id]`

**Files:**
- Create: `src/app/admin/projeto/[id]/page.tsx`
- Create: `src/app/admin/projeto/[id]/actions.ts`

- [ ] **Step 1: Criar server action `forçarResetProjeto`**

Criar `src/app/admin/projeto/[id]/actions.ts`:

```ts
'use server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { requireAdminClient } from '@/lib/require-admin'
import { UUID_RE } from '@/lib/format'

export async function forcarResetProjeto(projetoId: string) {
  if (!UUID_RE.test(projetoId)) redirect('/admin')

  const admin = await requireAdminClient()

  await admin
    .from('projetos')
    .update({ status: 'erro' })
    .eq('id', projetoId)
    .eq('status', 'gerando')

  revalidatePath(`/admin/projeto/${projetoId}`)
}
```

- [ ] **Step 2: Criar `src/app/admin/projeto/[id]/page.tsx`**

```tsx
import { notFound } from 'next/navigation'
import { requireAdminClient } from '@/lib/require-admin'
import { brl, UUID_RE } from '@/lib/format'
import { getTemplate } from '@/lib/templates'
import { forcarResetProjeto } from './actions'
import type { Projeto, TemplateName } from '@/types'

function statusColor(status: string) {
  switch (status) {
    case 'gerando':  return 'bg-yellow-900 text-yellow-300'
    case 'rascunho': return 'bg-green-900 text-green-300'
    case 'erro':     return 'bg-red-900 text-red-300'
    default:         return 'bg-slate-700 text-slate-400'
  }
}

export default async function ProjetoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  if (!UUID_RE.test(id)) notFound()

  const admin = await requireAdminClient()

  const { data: projeto } = await admin
    .from('projetos')
    .select('id,status,template,municipio_ibge,valor_solicitado,num_beneficiarios,prazo_meses,pdf_url,docx_url,criado_em,secoes_ia')
    .eq('id', id)
    .single()

  if (!projeto) notFound()

  const p = projeto as Projeto
  const config = getTemplate(p.template as TemplateName)

  // Gerar signed URLs em paralelo
  const [pdfUrlResult, docxUrlResult] = await Promise.all([
    p.pdf_url
      ? admin.storage.from('projetos').createSignedUrl(p.pdf_url, 3600)
      : Promise.resolve({ data: null }),
    p.docx_url
      ? admin.storage.from('projetos').createSignedUrl(p.docx_url, 3600)
      : Promise.resolve({ data: null }),
  ])

  const gerandoHaMuito = p.status === 'gerando' &&
    new Date(p.criado_em).getTime() < Date.now() - 10 * 60 * 1000

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100">{config.nome}</h1>
          <p className="text-slate-400 text-sm mt-1">
            {p.municipio_ibge} · {config.orgao} · {config.fundo}
          </p>
        </div>
        <span className={`rounded px-3 py-1 text-xs font-semibold ${statusColor(p.status)}`}>
          {p.status}
        </span>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Valor solicitado', valor: p.valor_solicitado ? brl(p.valor_solicitado) : '—' },
          { label: 'Beneficiários', valor: String(p.num_beneficiarios ?? '—') },
          { label: 'Prazo', valor: p.prazo_meses ? `${p.prazo_meses} meses` : '—' },
        ].map(item => (
          <div key={item.label} className="rounded-md bg-slate-800 p-4">
            <p className="text-xs text-slate-400">{item.label}</p>
            <p className="text-lg font-semibold text-slate-100 mt-1">{item.valor}</p>
          </div>
        ))}
      </div>

      {/* Downloads */}
      {p.status === 'rascunho' && (
        <div className="flex gap-3">
          {pdfUrlResult.data?.signedUrl && (
            <a
              href={pdfUrlResult.data.signedUrl}
              target="_blank"
              className="inline-flex items-center gap-2 rounded-md bg-blue-800 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              ↓ Baixar PDF
            </a>
          )}
          {docxUrlResult.data?.signedUrl && (
            <a
              href={docxUrlResult.data.signedUrl}
              target="_blank"
              className="inline-flex items-center gap-2 rounded-md bg-slate-700 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-600"
            >
              ↓ Baixar Word
            </a>
          )}
        </div>
      )}

      {/* Seções geradas */}
      {p.status === 'rascunho' && p.secoes_ia && (
        <div className="space-y-4">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
            Seções Geradas
          </h2>
          {config.secoes.map(s => {
            const texto = p.secoes_ia?.secoes_texto?.[s.id]
            if (!texto) return null
            return (
              <details key={s.id} className="rounded-md border border-slate-800 bg-slate-800/50">
                <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-slate-300 hover:text-slate-100">
                  {s.titulo}
                </summary>
                <div className="px-4 pb-4 pt-2 text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                  {texto}
                </div>
              </details>
            )
          })}
        </div>
      )}

      {/* Forçar reset */}
      {gerandoHaMuito && (
        <form action={forcarResetProjeto.bind(null, p.id)}>
          <button
            type="submit"
            className="rounded-md bg-red-900/40 border border-red-800 px-4 py-2 text-sm text-red-300 hover:bg-red-900/60"
          >
            Forçar reset (geração travada há +10 min)
          </button>
        </form>
      )}
    </div>
  )
}
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit --skipLibCheck 2>&1 | grep 'projeto/\[id\]' | head -5
```

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/projeto/
git commit -m "feat: add /admin/projeto/[id] with PDF/Word downloads and force reset"
```

---

## Task 11: Admin UI — `/admin/projeto` (lista)

**Files:**
- Create: `src/app/admin/projeto/page.tsx`

- [ ] **Step 1: Criar `src/app/admin/projeto/page.tsx`**

```tsx
import Link from 'next/link'
import { requireAdminClient } from '@/lib/require-admin'
import { brl } from '@/lib/format'
import type { TemplateName, StatusProjeto } from '@/types'
import { getTemplate } from '@/lib/templates'

type ProjetoRow = {
  id: string
  template: TemplateName
  municipio_ibge: string
  valor_solicitado: number | null
  status: StatusProjeto
  criado_em: string
  municipios_habilitacao: { nome: string } | null
}

function statusColor(status: StatusProjeto) {
  switch (status) {
    case 'rascunho': return 'bg-green-900 text-green-300'
    case 'erro':     return 'bg-red-900 text-red-300'
    default:         return 'bg-yellow-900 text-yellow-300'
  }
}

export default async function ProjetosPage() {
  const admin = await requireAdminClient()

  const { data: projetos } = await admin
    .from('projetos')
    .select(`
      id, template, municipio_ibge, valor_solicitado, status, criado_em,
      municipios_habilitacao!inner(nome)
    `)
    .order('criado_em', { ascending: false })
    .limit(50)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-100">Projetos Gerados</h1>
        <Link
          href="/admin/projeto/novo"
          className="rounded-md bg-nexa-600 px-4 py-2 text-sm font-semibold text-white hover:bg-nexa-500"
        >
          + Novo Projeto
        </Link>
      </div>

      <div className="rounded-md border border-slate-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-800">
            <tr>
              {['Município', 'Template', 'Valor', 'Status', 'Data'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {((projetos ?? []) as ProjetoRow[]).map(p => {
              const config = getTemplate(p.template)
              return (
                <tr key={p.id} className="hover:bg-slate-800/50">
                  <td className="px-4 py-3 text-slate-300">
                    <Link href={`/admin/projeto/${p.id}`} className="hover:text-nexa-400">
                      {p.municipios_habilitacao?.nome ?? p.municipio_ibge}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{config.nome}</td>
                  <td className="px-4 py-3 text-slate-300 font-mono text-xs">
                    {p.valor_solicitado ? brl(p.valor_solicitado) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded px-2 py-0.5 text-xs font-semibold ${statusColor(p.status)}`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">
                    {new Date(p.criado_em).toLocaleDateString('pt-BR')}
                  </td>
                </tr>
              )
            })}
            {(!projetos || projetos.length === 0) && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500 text-sm">
                  Nenhum projeto gerado ainda.
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

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit --skipLibCheck 2>&1 | grep 'projeto/page' | head -5
```

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/projeto/page.tsx
git commit -m "feat: add /admin/projeto list with municipio join and status badges"
```

---

## Task 12: Sidebar admin — link "Projetos"

**Files:**
- Modify: `src/app/admin/layout.tsx`

- [ ] **Step 1: Ler o layout atual**

Ler `src/app/admin/layout.tsx` para localizar onde estão os links da sidebar (Diagnósticos, Parlamentares, etc.).

- [ ] **Step 2: Adicionar link "Projetos"**

Adicionar item de navegação com ícone `FileCheck` (ou equivalente já usado no projeto) após o link de Diagnósticos ou Parlamentares:

```tsx
{ href: '/admin/projeto', label: 'Projetos', icon: FileCheck }
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit --skipLibCheck 2>&1 | grep 'admin/layout' | head -5
```

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/layout.tsx
git commit -m "feat: add Projetos link to admin sidebar"
```

---

## Task 13: Testes do pipeline — `generate-projeto.test.ts`

**Files:**
- Create: `src/lib/__tests__/generate-projeto.test.ts`

- [ ] **Step 1: Criar testes**

Criar `src/lib/__tests__/generate-projeto.test.ts` seguindo o padrão de `generate-diagnostico.test.ts`:

```typescript
import { describe, test, expect, vi, beforeEach } from 'vitest'

// Mocks devem ser declarados ANTES dos imports do módulo testado
vi.mock('@/lib/claude', () => ({
  gerarProjeto: vi.fn(),
}))
vi.mock('@react-pdf/renderer', () => ({
  renderToBuffer: vi.fn(),
}))
vi.mock('@/lib/docx/projeto-docx', () => ({
  gerarProjetoDocx: vi.fn(),
}))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}))

import { gerarProjeto } from '@/lib/claude'
import { renderToBuffer } from '@react-pdf/renderer'
import { gerarProjetoDocx } from '@/lib/docx/projeto-docx'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateProjeto } from '@/lib/generateProjeto'
import type { SecoesProjeto, TemplateName } from '@/types'

const mockSecoes: SecoesProjeto = {
  metas_fisicas: [{ trimestre: 1, meta: 'Meta teste', quantidade: 50 }],
  indicadores: [{ nome: 'Ind. 1', formula: 'n/total', meta: '100%' }],
  cronograma: [{ etapa: 'Etapa 1', mes_inicio: 1, mes_fim: 3 }],
  orcamento: [{ rubrica: '3.3.90.36', descricao: 'Facilitadores', valor: 120000 }],
  declaracoes: ['Declaração 1'],
  secoes_texto: { objeto: 'Texto objeto', justificativa: 'Texto justificativa' },
}

const mockInputs = {
  diagnostico_id: 'diag-uuid',
  municipio_ibge: '2803500',
  template: 'scfv' as TemplateName,
  objeto: 'Objeto do projeto',
  justificativa: 'Justificativa',
  num_beneficiarios: 100,
  valor_solicitado: 200_000,
  valor_contrapartida: 20_000,
  prazo_meses: 12,
  capacidade_instalada: 'Boa estrutura',
  campos_extras: { faixas_etarias: ['criança (0-12)'] },
}

function makeSupabaseMock(updatePayloads: object[]) {
  const updateFn = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    }),
  })

  return {
    from: vi.fn((table: string) => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue(
            table === 'diagnosticos'
              ? { data: { municipio_ibge: '2803500', programas_criticos: [] }, error: null }
              : { data: { nome: 'Lagarto' }, error: null }
          ),
        }),
      }),
      update: vi.fn((payload: object) => {
        updatePayloads.push(payload)
        return updateFn()
      }),
    })),
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn().mockResolvedValue({ error: null }),
      })),
    },
  }
}

describe('generateProjeto', () => {
  beforeEach(() => vi.clearAllMocks())

  test('happy path: updatePayloads contém status rascunho com pdf_url e docx_url', async () => {
    const updatePayloads: object[] = []
    ;(createAdminClient as ReturnType<typeof vi.fn>).mockReturnValue(makeSupabaseMock(updatePayloads))
    ;(gerarProjeto as ReturnType<typeof vi.fn>).mockResolvedValue(mockSecoes)
    ;(renderToBuffer as ReturnType<typeof vi.fn>).mockResolvedValue(Buffer.from('pdf'))
    ;(gerarProjetoDocx as ReturnType<typeof vi.fn>).mockResolvedValue(Buffer.from('docx'))

    await generateProjeto('projeto-test-id', 'diag-uuid', 'scfv', mockInputs)

    const rascunhoPayload = updatePayloads.find((p: any) => p.status === 'rascunho') as any
    expect(rascunhoPayload).toBeDefined()
    expect(rascunhoPayload.pdf_url).toBe('projeto-test-id.pdf')
    expect(rascunhoPayload.docx_url).toBe('projeto-test-id.docx')
  })

  test('erro Claude: updatePayloads contém status erro', async () => {
    const updatePayloads: object[] = []
    ;(createAdminClient as ReturnType<typeof vi.fn>).mockReturnValue(makeSupabaseMock(updatePayloads))
    ;(gerarProjeto as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Claude falhou'))

    await generateProjeto('projeto-test-id', 'diag-uuid', 'scfv', mockInputs)

    const erroPayload = updatePayloads.find((p: any) => p.status === 'erro')
    expect(erroPayload).toBeDefined()
  })

  test('erro upload PDF: updatePayloads contém status erro', async () => {
    const updatePayloads: object[] = []
    const mock = makeSupabaseMock(updatePayloads)
    mock.storage.from = vi.fn(() => ({
      upload: vi.fn().mockResolvedValue({ error: new Error('Upload falhou') }),
    }))
    ;(createAdminClient as ReturnType<typeof vi.fn>).mockReturnValue(mock)
    ;(gerarProjeto as ReturnType<typeof vi.fn>).mockResolvedValue(mockSecoes)
    ;(renderToBuffer as ReturnType<typeof vi.fn>).mockResolvedValue(Buffer.from('pdf'))
    ;(gerarProjetoDocx as ReturnType<typeof vi.fn>).mockResolvedValue(Buffer.from('docx'))

    await generateProjeto('projeto-test-id', 'diag-uuid', 'scfv', mockInputs)

    const erroPayload = updatePayloads.find((p: any) => p.status === 'erro')
    expect(erroPayload).toBeDefined()
  })

  test('resolve sem throw em qualquer cenário de erro', async () => {
    const updatePayloads: object[] = []
    ;(createAdminClient as ReturnType<typeof vi.fn>).mockReturnValue(makeSupabaseMock(updatePayloads))
    ;(gerarProjeto as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Falha grave'))

    await expect(
      generateProjeto('projeto-test-id', 'diag-uuid', 'scfv', mockInputs)
    ).resolves.toBeUndefined()
  })
})
```

- [ ] **Step 2: Rodar testes**

```bash
npm test -- generate-projeto.test 2>&1 | tail -15
```

Esperado: 4 testes passam.

- [ ] **Step 3: Commit**

```bash
git add src/lib/__tests__/generate-projeto.test.ts
git commit -m "test: add generate-projeto.test.ts (happy path, Claude error, upload error)"
```

---

## Verificação Final do Plano 2d

- [ ] `npm run build` sem erros TypeScript
- [ ] `npm test` — todos os testes passam (incluindo os 7+ novos de projeto e 4 de generate-projeto)
- [ ] `python3 -m pytest scraper/tests/ -q` — 33 testes passam (sem regressão)
- [ ] Admin consegue ver lista em `/admin/projeto`
- [ ] Admin consegue criar projeto em `/admin/projeto/novo` selecionando diagnóstico e template
- [ ] Spinner aparece durante geração; botão "Ver Projeto →" aparece ao finalizar
- [ ] `/admin/projeto/[id]` exibe seções em acordeões, botões PDF e Word
- [ ] PDFs e Words são gerados com conteúdo real (não vazios)
- [ ] Dedup index impede geração simultânea (POST retorna 409)
- [ ] Forçar reset funciona após 10 min de status `gerando`
- [ ] Sidebar admin exibe link "Projetos"

**Fluxo de teste manual** (requer `ANTHROPIC_API_KEY` real + diagnóstico na base):
1. Login como admin → `/admin/diagnostico` — selecionar diagnóstico existente com status `rascunho`
2. Ir para `/admin/projeto/novo` — selecionar o diagnóstico, template `scfv`, preencher campos
3. Clicar "Gerar Projeto" → aguardar até ~90s
4. Ver "Ver Projeto →" → clicar → `/admin/projeto/{id}`
5. Baixar PDF e Word → verificar conteúdo gerado
6. Tentar gerar outro SCFV para o mesmo município → deve receber 409

**Próximo:** M3 completo. Próximos módulos candidatos: M4 (Casamento Emenda × OSCIP) ou M6 (Prestação de Contas).
