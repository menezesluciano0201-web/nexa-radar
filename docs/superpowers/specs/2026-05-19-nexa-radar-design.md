# Nexa Radar — Design Spec
**Data:** 2026-05-19  
**Status:** Aprovado  
**Autor:** Luciano Menezes + Claude Code (brainstorming colaborativo)

---

## 1. Problema e Oportunidade

### O problema central
Prefeituras brasileiras deixam bilhões de reais em verbas públicas inacessadas todo ano — fenômeno conhecido no setor como "dinheiro deixado na mesa". Isso acontece em três formas principais:

1. **Saldos represados em convênios antigos** — contas bancárias vinculadas a convênios de exercícios anteriores com saldo remanescente que ninguém acompanha após troca de gestão
2. **Prazos de renovação perdidos** — programas de repasse automático (especialmente Saúde e Assistência Social) exigem cadastro simples ou cumprimento de meta burocrática básica; municípios perdem os prazos por falta de controle de calendário
3. **Programas habilitados não acessados** — prefeituras não sabem quais programas federais e estaduais estão disponíveis para elas

### Por que isso acontece
- **Apagão técnico:** a rotina da prefeitura (folha, saúde, infraestrutura) consome toda a capacidade técnica disponível
- **Falta de continuidade:** nova gestão não sabe o que a anterior deixou tramitando; convênios antigos caem no esquecimento
- **Ausência de monitoramento sistemático:** nenhuma ferramenta consolida oportunidades, prazos e status em um lugar só

### O diferencial do sistema
Um consultor humano consegue monitorar 1-2 municípios. O sistema monitora centenas simultaneamente, nunca esquece, não troca de gestor e não é absorvido pela rotina operacional. Isso é o que torna inviável replicar manualmente.

### O argumento de venda perfeito
> "Prefeito, não vim propor criar imposto novo nem pedir favor a deputado. Vim te mostrar o dinheiro que já é seu, está parado e você não está pegando."

---

## 2. Clientes e Definição de Sucesso

| Cliente | O que quer | Sucesso em 90 dias |
|---|---|---|
| **Prefeito** | Mais recursos sem briga política, proteção jurídica | "R$ X ativados que a prefeitura não teria capturado sozinha" + zero processo no TCU |
| **Deputado Federal** | Emendas executadas, visibilidade eleitoral, evitar devolução | "Executei X% das emendas antes do prazo + relatório de impacto para divulgar" |
| **Senador** | Visão estadual consolidada, instrumento de poder | "Tenho o único mapa consolidado do meu estado — nenhum assessor rival tem isso" |
| **OSCIP** | Previsibilidade financeira, ser encontrada por quem tem recurso | "Fomos procurados por 2 parlamentares novos por causa da plataforma" |

---

## 3. Stack Técnica

| Camada | Tecnologia | Motivo |
|---|---|---|
| Frontend + Backend | Next.js (TypeScript) com App Router | Full-stack em uma linguagem, API Routes eliminam servidor separado |
| Banco de dados | Supabase (PostgreSQL) | Auth + RLS + Storage gerenciados, sem administrar servidor |
| Coleta de dados | Python 3.11+ com cron | Scripts já iniciados, separados do app web |
| IA | Claude API (claude-sonnet-4-20250514) | Geração de diagnósticos, briefings e scores |
| PDF | @react-pdf/renderer | Gera PDFs a partir de componentes React, mesma linguagem do resto |
| Deploy | EasyPanel com Nixpacks | Auto-detecção de stack, sem Dockerfile, VPS próprio, sem limite de timeout |

---

## 4. Segurança

### Modelo de acesso

| Perfil | Acesso | Mecanismo |
|---|---|---|
| Equipe Nexa (admin) | Tudo — todos os clientes e dados | Role admin no Supabase |
| Prefeito/assessor | Só o próprio município (leitura) | RLS por municipio_ibge no JWT |
| Deputado/assessor | Só as próprias emendas e mapa político (leitura) | RLS por parlamentar_id no JWT |
| Portal público | Só dados aprovados para publicação | Rota pública sem auth |

### Camadas de segurança

1. **Supabase Auth** — email/senha para equipe Nexa; magic link para clientes com fallback obrigatório para email/senha (domínios municipais frequentemente bloqueiam links externos por política de TI)
2. **Row Level Security (RLS)** — políticas no PostgreSQL, segurança no banco não na aplicação. Políticas críticas obrigatórias na migration `002_rls_policies.sql`:
   - `diagnosticos`: `USING (municipio_ibge = (SELECT municipio_ibge FROM profiles WHERE id = auth.uid()))`
   - `mapa_politico`: `USING (parlamentar_id = (SELECT parlamentar_id FROM profiles WHERE id = auth.uid()) OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND tipo = 'admin'))`
   - `contratos`: `USING (profile_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND tipo = 'admin'))` — cliente só vê o próprio contrato
   - `publicacoes_portal` SELECT: `USING (true)` — leitura pública irrestrita; INSERT/UPDATE/DELETE: `USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND tipo = 'admin'))` — apenas admin cria publicações
   - `transferencias_federais` e `emendas_parlamentares`: sem acesso direto pelo cliente — leitura apenas via API Route com service role
3. **Next.js Middleware** — protege rotas `/admin` e `/portal`, redireciona para `/login`
4. **Variáveis de ambiente server-side** — `SUPABASE_SERVICE_ROLE_KEY` e `ANTHROPIC_API_KEY` nunca chegam ao browser
5. **Zero dados pessoais de beneficiários** — apenas dados agregados por município/programa

---

## 5. Modelo de Dados

### Clientes e acesso
```sql
profiles (
  id uuid references auth.users,
  tipo: 'admin' | 'prefeito' | 'deputado' | 'senador' | 'oscip',
  nome text,
  municipio_ibge text,
  parlamentar_id text,
  created_at timestamptz
)

contratos (
  id uuid,
  profile_id uuid references profiles,
  tipo_produto: 'diagnostico' | 'monitoramento_prefeito' | 'monitoramento_parlamentar',
  status: 'ativo' | 'suspenso' | 'encerrado',
  valor_mensal numeric,
  data_inicio date,
  data_fim date,
  criado_em timestamptz
  -- Restrição de modelagem: 1 profile = 1 município ou 1 parlamentar.
  -- Consórcios intermunicipais ou parlamentares com múltiplas bases
  -- devem ser representados como profiles distintos com contratos separados.
  -- Migration 001 deve incluir:
  -- CREATE UNIQUE INDEX contratos_profile_ativo_unique
  --   ON contratos (profile_id) WHERE status = 'ativo';
)
```

### Dados brutos — escritos pelos scrapers Python
```sql
transferencias_federais (
  id uuid,
  municipio_ibge text,
  programa text,
  fundo text,
  valor_empenhado numeric,
  valor_liquidado numeric,
  valor_pago numeric,
  percentual_execucao numeric,
  competencia date,
  prazo_limite date,
  fonte text,
  raw_json jsonb,
  coletado_em timestamptz
)

emendas_parlamentares (
  id uuid,
  parlamentar_id text,
  parlamentar_nome text,
  tipo: 'RP6' | 'RP7' | 'RP8' | 'PIX',
  parlamentar_tipo: 'individual' | 'bancada' | 'comissao',
  -- individual = RP6/PIX (entra no score M5 do parlamentar)
  -- bancada/comissao = RP7/RP8 (não entra no score individual)
  municipio_ibge text,
  area_tematica text,
  valor_autorizado numeric,
  valor_empenhado numeric,
  valor_executado numeric,
  percentual_execucao numeric,
  prazo_limite date,
  status_cauc boolean,
  exercicio int,
  fonte text,
  coletado_em timestamptz
)

municipios_habilitacao (
  ibge text primary key,
  nome text,
  uf text,
  populacao int,
  idh numeric,
  cauc_regular boolean,
  ultima_verificacao timestamptz,
  programas_habilitados text[],
  programas_bloqueados text[]
  -- índice GIN obrigatório na migration 003:
  -- CREATE INDEX idx_habilitacao_programas ON municipios_habilitacao USING GIN(programas_habilitados)
)
```

### Inteligência — gerada pela Nexa
```sql
diagnosticos (
  id uuid,
  municipio_ibge text,
  gerado_por uuid references profiles NOT NULL,
  valor_total_identificado numeric,
  valor_em_risco numeric,
  programas_criticos jsonb,
  acoes_recomendadas jsonb,
  texto_ia text,
  pdf_url text,
  status: 'gerando' | 'rascunho' | 'entregue' | 'convertido' | 'erro',
  -- 'gerando': Claude API em andamento (status atualizado antes de chamar a API)
  -- 'erro': falha na Claude API ou geração de PDF — permite retry manual pelo admin
  criado_em timestamptz
)

mapa_politico (
  id uuid,
  parlamentar_id text,
  municipio_ibge text,
  relacao: 'aliado_forte' | 'aliado' | 'neutro' | 'oposicao',
  liderancas_locais text,
  notas text,
  origem: 'manual' | 'inferido',
  confianca_inferencia numeric,
  confirmado_pelo_assessor boolean,
  criado_por uuid references profiles,
  atualizado_em timestamptz
)

scores_municipio_parlamentar (
  id uuid,
  parlamentar_id text,       -- referencia emendas_parlamentares.parlamentar_id
  municipio_ibge text,       -- referencia municipios_habilitacao.ibge
  score_total numeric,       -- dado calculado, não tem FK direta (intencional)
  score_politico numeric,    -- ver seção 7 para definição e pesos de cada score
  score_saude_alocacao numeric, -- EC 86/2015 headroom — ver seção 7
  score_capacidade numeric,
  score_impacto_visual numeric,
  score_idh numeric,
  calculado_em timestamptz
)
```

### Briefings parlamentares — gerados pela Nexa
```sql
briefings (
  id uuid,
  parlamentar_id text,
  gerado_por uuid references profiles NOT NULL, -- sempre preenchido no MVP (admin dispara manualmente)
  valor_total_emendas numeric,
  valor_em_risco numeric,
  municipios_recomendados jsonb,   -- top 5 com scores e justificativas
  texto_ia text,
  pdf_url text,
  status: 'gerando' | 'rascunho' | 'entregue' | 'erro',
  -- mesma semântica de status que diagnosticos
  criado_em timestamptz
)
```
RLS SELECT/UPDATE/DELETE: `USING (parlamentar_id = (SELECT parlamentar_id FROM profiles WHERE id = auth.uid()) OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND tipo = 'admin'))`
INSERT e UPDATE de status: apenas via service role nas API Routes — cliente nunca escreve diretamente nesta tabela.

### Publicação pública
```sql
publicacoes_portal (
  id uuid,
  municipio_ibge text,
  aprovado_por uuid references profiles,
  titulo text,
  resumo_execucao jsonb,
  publicado_em timestamptz,
  ativo boolean
)
```

### Reservado para M1+ (pós-MVP)
```sql
cnds_municipios (
  municipio_ibge text,
  tipo text,
  status: 'valida' | 'irregular' | 'vencendo' | 'vencida',
  validade date,
  dias_restantes int,
  alerta boolean,
  verificado_em timestamptz
)
```

---

## 6. Coleta de Dados — Três Camadas

### Camada 1 — Automática (federal)
Cron job semanal sem intervenção humana.

| Fonte | Dado coletado | Endpoint |
|---|---|---|
| Portal da Transparência | Transferências por município | api.portaldatransparencia.gov.br |
| Transferegov | Convênios e instrumentos | api.transferegov.sistema.gov.br |
| SIGA Brasil | Emendas parlamentares por autor | www12.senado.leg.br/orcamento/sparql |
| FNDE | PNAE, PNATE, PDDE, Proinfância | fnde.gov.br/dadosabertos |
| Câmara API | Emendas por deputado | dadosabertos.camara.leg.br |

### Camada 2 — Semi-automática (estadual)
Scraper roda, analista Nexa valida antes de publicar no painel do cliente.

- Alagoas: transparencia.al.gov.br
- Sergipe: transparencia.se.gov.br
- Pernambuco: transparencia.pe.gov.br

### Camada 3 — Curadoria manual (conhecimento proprietário)
Nunca vem de API. Acumulado pela equipe Nexa com cada cliente atendido.
- Perfis de OSCIPs e histórico de execução
- Mapa político inicial de parlamentares
- Contexto local ("esse deputado não repassa para município de oposição")

Este é o ativo que cresce com o tempo e que nenhum concorrente consegue copiar.

---

## 7. Módulos

### MVP

#### M1+M2 — Diagnóstico Municipal (entrada do produto para prefeito)

**Fluxo:**
```
Admin digita IBGE
→ Busca dados no Supabase (transferencias_federais + municipios_habilitacao)
→ Calcula subexecução por programa
→ Chama Claude API com JSON estruturado
→ Claude gera diagnóstico em 4 blocos: situação, risco, oportunidade, ação
→ @react-pdf/renderer monta PDF
→ PDF salvo no Supabase Storage
→ Prefeito acessa no portal
```

**Páginas:**
- `/admin/diagnostico/novo` — selecionar município e disparar
- `/admin/diagnostico/[id]` — preview antes de entregar
- `/portal/diagnostico` — prefeito vê diagnóstico entregue

**API Routes:**
- `POST /api/diagnostico/gerar`
- `GET /api/diagnostico/[id]`
- `POST /api/diagnostico/[id]/pdf`

**Nota de runtime:** a API Route `/api/diagnostico/[id]/pdf` usa `@react-pdf/renderer` que depende de APIs Node.js (streams, canvas). Deve usar Node.js runtime explicitamente — não declarar `export const runtime = 'edge'`. O arquivo `DiagnosticoPDF.tsx` não deve ser importado em nenhum contexto Edge.

**Fluxo assíncrono de geração:** a chamada Claude API + geração de PDF pode levar 15-45 segundos. O fluxo correto é:
1. `POST /api/diagnostico/gerar` — cria registro com `status: 'gerando'` e retorna `{ id }` imediatamente (202 Accepted)
2. Frontend assina o canal Supabase Realtime na tabela `diagnosticos` filtrando pelo `id` retornado
3. Quando `status` mudar para `'rascunho'` ou `'erro'`, Supabase Realtime notifica o frontend
4. Frontend atualiza a UI sem polling manual

**Fallback de conectividade:** se a conexão Realtime cair (comum em prefeituras com internet instável), o frontend deve implementar polling de backup a cada 5 segundos por no máximo 2 minutos. Se após 2 minutos o status ainda for `'gerando'`, exibir mensagem "Geração demorou mais que o esperado — recarregue a página para verificar o resultado."

Isso usa Supabase Realtime (já disponível no projeto, sem custo extra) e evita timeout na API Route.

---

#### Briefing de Emendas + M5 — Inteligência Parlamentar (entrada do produto para deputado)

**Fluxo:**
```
Admin seleciona parlamentar
→ Busca emendas_parlamentares do Supabase (apenas parlamentar_tipo = 'individual')
→ Calcula: % executado, valor em risco de devolução, prazo crítico por emenda
→ Busca mapa_politico e scores_municipio_parlamentar
→ Claude gera briefing com linguagem política
→ PDF gerado e entregue
```

**Estrutura do PDF do briefing (`BriefingParlamentarPDF.tsx`):**
1. **Capa** — nome do parlamentar, período analisado, data de geração
2. **Resumo executivo** — total de emendas individuais, % executado geral, R$ em risco de devolução com prazo
3. **Tabela de emendas por município** — município, área temática, valor autorizado, % executado, status (no prazo / em risco / vencida)
4. **Top 5 municípios recomendados** — baseado no score M5, com pontuação e justificativa resumida por critério
5. **Próximos passos** — ações prioritárias nos próximos 30/60/90 dias geradas pela Claude

**Score M5 calculado automaticamente:**
```
score_total =
  score_politico × 0.35         ← mapa inserido pelo assessor
  + score_saude_alocacao × 0.25 ← headroom de saúde disponível do parlamentar
  + score_capacidade × 0.25     ← CAUC regular + histórico de execução
  + score_impacto_visual × 0.10 ← obras concluídas por área temática
  + score_idh × 0.05            ← vulnerabilidade social (IBGE)
```

**Definição de `score_saude_alocacao`:** mede o percentual de emendas individuais do parlamentar já alocadas em saúde (regra EC 86/2015 exige mínimo 50%). Um parlamentar com 30% em saúde tem headroom para outras áreas — score alto para municípios de assistência social e educação. Um parlamentar com 55% em saúde tem headroom mínimo — score alto apenas para municípios de saúde. Apenas emendas `parlamentar_tipo = 'individual'` entram nesse cálculo.

**Páginas:**
- `/admin/parlamentar/[id]` — painel com emendas e score M5
- `/admin/parlamentar/[id]/mapa` — assessor cadastra mapa político
- `/portal/emendas` — deputado vê briefing e mapa (leitura)

**API Routes:**
- `POST /api/briefing/parlamentar/[id]` — cria registro na tabela `briefings` com `status: 'gerando'`, retorna `{ id }` imediatamente (202 Accepted), gera texto via Claude em background, atualiza status para `'rascunho'` ou `'erro'`. Frontend usa Supabase Realtime com fallback de polling a cada 5s por 2 minutos (mesma lógica do diagnóstico municipal)
- `GET /api/briefing/parlamentar/[id]` — retorna briefing existente (re-hidratação ao recarregar a página). Mesmo arquivo `route.ts` exporta `GET` e `POST`
- `POST /api/briefing/parlamentar/[id]/pdf` — gera PDF do briefing usando `BriefingParlamentarPDF.tsx` (Node.js runtime, mesma regra do DiagnosticoPDF)
- `POST /api/mapa-politico`
- `POST /api/score/calcular/[parlamentar_id]`

---

#### Dashboard Admin — Operação interna Nexa

**Páginas:**
- `/admin` — visão geral: clientes ativos, alertas de prazo, municípios com maior subexecução
- `/admin/clientes` — contratos, tipo de cliente, status
- `/admin/municipios` — mapa de subexecução por município/programa/prazo
- `/admin/coleta` — status dos scrapers: última execução, erros, pendentes de validação manual
- `/admin/alertas` — prazos críticos nos próximos 30/60/90 dias (página + arquivo `admin/alertas/page.tsx`)

**API Routes:**
- `GET /api/admin/alertas`

---

#### Portal do Cliente — Leitura protegida

**Páginas:**
- `/portal` — resumo: valor monitorado, alertas ativos, último diagnóstico
- `/portal/diagnostico` — diagnóstico com link para PDF
- `/portal/alertas` — prazos por programa
- `/portal/emendas` — (só deputado) painel de emendas com score de municípios

**Princípio:** o cliente vê outputs, nunca dados brutos. Sempre o insight: "Você tem R$ 340k no SCFV com prazo em 45 dias."

---

### Pós-MVP (fases seguintes)

#### M1+ — Monitoramento de CNDs
Consolidar status de todas as certidões relevantes do município com alertas de vencimento. CNDs monitoradas: CAUC, CND Federal/PGFN, FGTS, TCU, TCE estadual.

Impacto: o diagnóstico municipal fica completo — identifica o dinheiro disponível E os bloqueios burocráticos que impedem o acesso.

Tabela `cnds_municipios` já reservada no schema. Implementação pós-primeiro contrato.

---

#### M5+ — Mapa Político Inferido
Antes de o assessor preencher qualquer campo, a Nexa Radar gera uma lista inferida com score de confiança por município, baseada em:
- Histórico de emendas destinadas nos últimos 3 anos (Transferegov + SIGA Brasil)
- Partido do prefeito de cada município (TSE — resultados eleitorais)
- Concentração de votos do parlamentar por município (TSE API)

O assessor recebe a lista e confirma, corrige ou adiciona entradas. O mapa político deixa de ser preenchido do zero.

Tabela `mapa_politico` já suporta os campos `origem`, `confianca_inferencia` e `confirmado_pelo_assessor` para esse fluxo. Exige nova pipeline de ingestão de dados do TSE.

---

#### M3 — Gerador de Projetos Aprováveis
Templates para SCFV, TEA, CAPS, Idoso, Esporte, Saúde Básica, Criança Feliz, BPC Escola, Proinfância. IA gera plano de trabalho, metas físicas mensuráveis, indicadores SUAS/SUS, cronograma e orçamento. Entra após validar receita com diagnósticos.

#### M4 — Casamento Emenda × OSCIP
Score de compatibilidade com peso por área temática (40%), cobertura municipal (30%), habilitação Transferegov (15%) e histórico de execução (15%). Exige base de dados de OSCIPs construída ao longo do tempo.

#### M6 — Prestação de Contas como Serviço
App mobile para coleta de evidências (foto + GPS + timestamp), OCR de nota fiscal, relatório narrativo auditado, submissão no Transferegov. Escopo de produto completo — fase 2.

#### M7 — Portal de Transparência Municipal
Widget embeddável ou site gerado automaticamente. Atualização automática a cada submissão aprovada. Depende do M6 estar funcionando.

---

## 8. Estrutura de Arquivos

```
nexa-radar/
├── .env.local
├── .env.example
├── next.config.ts
├── tsconfig.json
├── package.json
│
├── supabase/
│   ├── migrations/
│   │   ├── 001_init_schema.sql
│   │   ├── 002_rls_policies.sql  ← políticas RLS obrigatórias (ver seção 4)
│   │   └── 003_indexes.sql       ← inclui GIN em programas_habilitados
│   └── seed.sql                  ← 5.570 municípios brasileiros com código IBGE,
│                                    nome, UF e população (fonte: IBGE SIDRA)
│
├── scraper/
│   ├── requirements.txt
│   ├── config.py
│   ├── supabase_client.py
│   ├── sources/
│   │   ├── portal_transparencia.py
│   │   ├── siga_brasil.py
│   │   ├── transferegov.py
│   │   ├── fnde.py
│   │   └── portais_estaduais.py
│   ├── processors/
│   │   ├── calcular_subexecucao.py
│   │   └── atualizar_habilitacao.py
│   └── run.py
│
└── src/
    ├── app/
    │   ├── layout.tsx
    │   ├── page.tsx
    │   ├── login/page.tsx
    │   ├── admin/
    │   │   ├── layout.tsx
    │   │   ├── page.tsx
    │   │   ├── clientes/page.tsx
    │   │   ├── municipios/page.tsx
    │   │   ├── diagnostico/
    │   │   │   ├── novo/page.tsx
    │   │   │   └── [id]/page.tsx
    │   │   ├── alertas/page.tsx
    │   │   ├── parlamentar/
    │   │   │   ├── page.tsx
    │   │   │   └── [id]/
    │   │   │       ├── page.tsx
    │   │   │       └── mapa/page.tsx
    │   │   └── coleta/page.tsx
    │   ├── portal/
    │   │   ├── layout.tsx
    │   │   ├── page.tsx
    │   │   ├── diagnostico/page.tsx
    │   │   ├── alertas/page.tsx
    │   │   └── emendas/page.tsx
    │   ├── municipio/[slug]/page.tsx  ← portal público do município (sem login)
    │   │                                  exibe dados aprovados de publicacoes_portal
    │   │                                  slug = nome-do-municipio-uf (ex: lagarto-se)
    │   └── api/
    │       ├── diagnostico/
    │       │   ├── gerar/route.ts
    │       │   └── [id]/
    │       │       ├── route.ts
    │       │       └── pdf/route.ts
    │       ├── briefing/parlamentar/[id]/
    │       │   ├── route.ts
    │       │   └── pdf/route.ts
    │       ├── mapa-politico/route.ts
    │       ├── score/calcular/[parlamentar_id]/route.ts
    │       └── admin/alertas/route.ts
    ├── components/
    │   ├── ui/
    │   ├── diagnostico/
    │   ├── emendas/
    │   ├── mapa-politico/
    │   └── pdf/
    │       ├── DiagnosticoPDF.tsx
    │       └── BriefingParlamentarPDF.tsx
    ├── lib/
    │   ├── supabase/
    │   │   ├── client.ts
    │   │   └── server.ts
    │   ├── claude.ts
    │   ├── diagnostico.ts
    │   ├── score-municipio.ts
    │   └── pdf.ts
    ├── types/index.ts
    └── middleware.ts
```

---

## 9. Deploy

### Infraestrutura

```
EasyPanel (VPS único)
├── nexa-radar-app      ← Next.js | Nixpacks auto-detecta | porta 3000
│   └── deploy automático via GitHub webhook na branch main
└── nexa-radar-scraper  ← Python | Nixpacks auto-detecta requirements.txt
    └── cron semanal: python scraper/run.py

Supabase Cloud (externo)
└── PostgreSQL + Auth + Storage (PDFs)
```

Sem Dockerfile necessário — Nixpacks detecta e configura automaticamente Next.js e Python.

**Cron do scraper no EasyPanel:** o EasyPanel não tem cron nativo por serviço. Configurar via crontab do sistema operacional do VPS via SSH, ou usar Supabase pg_cron para disparar um webhook que aciona o scraper. Alternativa mais simples: criar um serviço `nexa-radar-scraper` com `CMD sleep infinity` e usar o cron do SO do VPS: `0 6 * * 1 docker exec nexa-radar-scraper python scraper/run.py`.

### Variáveis de ambiente

```bash
# Next.js (.env.local)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=      # server-side only
ANTHROPIC_API_KEY=              # server-side only

# Python scraper (EasyPanel env vars)
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
PORTAL_TRANSPARENCIA_API_KEY=
```

---

## 10. Riscos e Mitigações

| Risco | Mitigação |
|---|---|
| Dado que não existe ou API quebra | Output do diagnóstico distingue "verificado" vs "estimado". Scrapers estaduais têm validação humana antes de publicar |
| Cliente cancela quando muda aliança política | Contrato mínimo de 6 meses. Diagnóstico inicial pago cria âncora de valor antes do fim do primeiro mês |
| Time solo sobrecarregado | Toda coleta federal é automática. Curadoria manual só para dados estaduais. Sem intervenção humana no fluxo crítico |
| Expectativa não entregue | Diagnóstico promete menos do que entrega. KPIs definidos antes de assinar: "R$ X identificados em 30 dias" |

---

## 11. Regras de Desenvolvimento

- Nunca commitar chaves de API — `.env.local` no `.gitignore`
- Todo scraping com `User-Agent: nexaradar-pesquisa-publica/1.0`
- Rate limiting mínimo de 300ms entre requests nas APIs governamentais
- Municípios indexados por código IBGE, nunca por nome
- Diagnóstico gerado pela IA inclui disclaimer: "revisar com especialista antes de submeter"
- Gestor público mantém responsabilidade legal — sistema prepara, humano autoriza
- Zero dados pessoais de beneficiários — apenas dados agregados

---

## 12. Fora do Escopo (MVP)

- M3 — Gerador de projetos aprovável
- M4 — Casamento emenda × OSCIP (banco de OSCIPs não construído)
- M5+ — Mapa político inferido (exige pipeline TSE)
- M6 — Prestação de contas (app mobile, OCR, GPS — produto inteiro)
- M7 — Portal de transparência automático (depende de M6)
- Scraping estadual automatizado (entra como curadoria manual)
- Portal do cliente em dashboard (primeiros clientes recebem PDF)
- OSCIP como cliente direto (fase 2)
