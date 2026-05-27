# M1 — Radar de Subexecução — Design Spec

**Data:** 2026-05-27
**Módulo:** M1 (Radar de Subexecução)
**Status:** Em design — aguardando review do usuário antes do plan

---

## Objetivo

Identificar, semanalmente e por estado, municípios com recursos federais empenhados mas subexecutados — e ligar essa visão direto aos fluxos de monetização da Nexa Radar (M2 Diagnóstico, M3 Gerador de Projetos).

**Output literal (do CLAUDE.md):** "Prefeitura de X deixou R$ 2,3M parados no programa Y. Prazo: 15/12."

**Não é objetivo do MVP:**
- Brasil inteiro (foco regional AL/SE/PE/BA)
- Múltiplas fontes (só Transferegov)
- Mapa coroplético, dashboard multivariado, alertas push, export PDF
- UI pública (M1 é admin-only)

---

## Arquitetura

```
┌──────────────────────────────┐
│  GitHub Actions cron         │
│  segunda 06:00 UTC (03 BRT)  │
│  + workflow_dispatch manual  │
└──────────────┬───────────────┘
               │ executa
               v
┌──────────────────────────────┐
│  scraper/sources/            │
│  transferegov.py             │
│  --ufs AL,SE,PE,BA           │
│  (rate limit 300ms)          │
└──────────────┬───────────────┘
               │ upsert (service role)
               v
┌──────────────────────────────┐
│  transferencias_federais     │
│  (RLS admin-only, já existe) │
└──────────────┬───────────────┘
               │ select
               v
┌──────────────────────────────┐         click           ┌──────────────────────────────┐
│  /admin/radar                │ ─────────────────────>  │  /admin/radar/[ibge]         │
│  feed por estado (UF tabs)   │                         │  detalhe município           │
│  top 50 municípios em risco  │                         │  + CTAs M2 (Diagnóstico)     │
└──────────────────────────────┘                         │  + CTAs M3 (Projeto)         │
                                                         └──────────────────────────────┘
```

**Princípio central:** Radar é a **porta de entrada** que alimenta M2 e M3. Não duplica lógica deles — identifica oportunidade e linka direto via query param (`?ibge=&from=radar`).

---

## Componentes

### 1. Scraping

**`scraper/sources/transferegov.py`** (já existe — vai ser auditado e ajustado):
- Aceita parâmetro `--ufs AL,SE,PE,BA` (filtragem antes do loop)
- Resolve UFs → códigos IBGE via tabela `municipios_habilitacao`
- Loop por município: chama API Transferegov, parseia convênios/transferências
- Upsert em `transferencias_federais` com chave dedup `(municipio_ibge, programa, competencia)`
- Rate limiting obrigatório: 300ms entre requests (CLAUDE.md)
- User-Agent identificado: `nexaradar-pesquisa-publica/1.0`
- Log estruturado por município: `"Transferegov | 2803500 Lagarto | 12 convênios | 4 em risco"`

**`.github/workflows/radar-scrape.yml`** (novo):
- Trigger: `schedule: cron '0 6 * * 1'` (segunda 06h UTC = 03h BRT) + `workflow_dispatch`
- Job em `ubuntu-latest`, Python 3.11
- Env via GitHub Secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RADAR_UFS=AL,SE,PE,BA`
- Comando: `python -m scraper.run --source transferegov --ufs $RADAR_UFS`
- Sem upload de artefato — observabilidade via logs do GH Actions

### 2. UI Admin

**`/admin/radar` (server component, feed por estado):**

Layout (texto, não pixel-perfect):
```
┌─ Radar de Subexecução ─────────────────────────────────┐
│  UF: [AL] [SE ▸ selecionada] [PE] [BA]                  │
│  Última atualização: há 22h · 412 municípios analisados │
├────────────────────────────────────────────────────────┤
│  ⚠  Lagarto - SE                          R$ 2,3M       │
│     3 programas em risco · prazo +próximo: 15/12/2026  │
│  ─────────────────────────────────────────────────────  │
│  ⚠  Aracaju - SE                          R$ 1,8M       │
│     5 programas em risco · prazo +próximo: 22/01/2027  │
└────────────────────────────────────────────────────────┘
```

- UF via search param (`?uf=SE`), default `AL` (primeiro alfabético)
- Server-side ranking: `valor_em_risco DESC, prazo_limite ASC` — top 50 municípios
- `valor_em_risco = sum(max(0, valor_empenhado - valor_pago))` agregado por município (programas em risco apenas)
- **Empty state** (UF sem dados): mensagem informativa com link para trigger manual do scraper (instrução em texto, sem botão na UI — trigger é via GitHub Actions UI)
- **Stale data warning**: se `MAX(coletado_em) < now() - 14 dias`, mostra banner amarelo *"Dados podem estar desatualizados — última varredura: [data]"*

**`/admin/radar/[ibge]` (server component, detalhe município):**

Layout:
```
┌─ Lagarto - SE · R$ 2,3M em risco ──────────────────────┐
│  Empenhado total: R$ 5,1M · Pago: R$ 2,8M · Exec: 54%  │
├────────────────────────────────────────────────────────┤
│  Programa         Fundo  Empen.   Pago    %    Prazo   │
│  SCFV - Idoso     FNAS   800k     400k   50%   15/12 ⚠ │
│  CAPS II          FNS    1,2M     600k   50%   22/01 ⚠ │
│  PNAE             FNDE   3,1M     1,8M   58%   —        │
├────────────────────────────────────────────────────────┤
│  [Gerar Diagnóstico →]   [Gerar Projeto →]*           │
│  *só habilita se já existe diagnóstico com status      │
│   'rascunho' ou 'entregue' para o município            │
└────────────────────────────────────────────────────────┘
```

- Validar IBGE com `IBGE_RE` (já existe em `src/lib/format.ts`)
- `notFound()` se IBGE não casa um município ou não tem transferências
- Stats agregadas (empenhado, pago, % média) no header — todos os programas, não só em risco
- Tabela ordenada por valor em risco DESC; programas em risco com badge `⚠`
- CTAs:
  - **Gerar Diagnóstico** → `/admin/diagnostico/novo?ibge=2803500&from=radar`
  - **Gerar Projeto** → `/admin/projeto/novo?ibge=2803500&from=radar` (desabilitado com tooltip se sem diagnóstico)

### 3. Sidebar

**`src/app/admin/layout.tsx`** — adicionar link "Radar" como **primeiro** item da navegação (antes de "Diagnósticos"), pois é a porta de entrada natural do fluxo. Ícone: `Radar` da lucide-react (já usada no projeto).

---

## Dados

**Tabela existente `transferencias_federais`** — sem alteração de schema:

| coluna | tipo |
|---|---|
| id | uuid |
| municipio_ibge | text |
| programa | text |
| fundo | text |
| valor_empenhado | numeric |
| valor_liquidado | numeric |
| valor_pago | numeric |
| percentual_execucao | numeric |
| competencia | date |
| prazo_limite | date |
| fonte | text |
| raw_json | jsonb |
| coletado_em | timestamptz |

**Migration `028_radar_indexes.sql`** — apenas índices:

```sql
-- Acelera ranking por município no feed
CREATE INDEX IF NOT EXISTS transferencias_municipio_pct_idx
  ON transferencias_federais (municipio_ibge, percentual_execucao);

-- Acelera filtro de prazo crítico (próximos 90 dias)
CREATE INDEX IF NOT EXISTS transferencias_prazo_idx
  ON transferencias_federais (prazo_limite)
  WHERE prazo_limite IS NOT NULL;

-- Acelera o "freshness check" (último coletado_em)
CREATE INDEX IF NOT EXISTS transferencias_coletado_idx
  ON transferencias_federais (coletado_em DESC);
```

**RLS:** já é admin-only via política existente (`_user_tipo() = 'admin'`). Sem mudança.

---

## Lógica pura — `src/lib/radar.ts`

```ts
import type { TransferenciaFederal } from '@/types'
import { PCT_EXECUCAO_CRITICO, DIAS_PRAZO_CRITICO } from '@/lib/risco-constants'

export interface MunicipioRiscoAgregado {
  municipio_ibge: string
  municipio_nome: string
  valor_em_risco: number
  num_programas_risco: number
  prazo_mais_proximo: string | null
}

/** Mesma definição usada em diagnostico.ts: % execução < 70 OU prazo nos próximos 90 dias (inclui vencidos) */
export function isEmRisco(t: TransferenciaFederal, hoje?: Date): boolean

/** Filtra somente programas em risco e agrupa por município (input: rows + nome resolvido) */
export function agruparPorMunicipio(
  rows: Array<TransferenciaFederal & { municipio_nome: string }>,
  hoje?: Date
): MunicipioRiscoAgregado[]

/** Ordena valor_em_risco DESC; entre valores iguais, prazo_mais_proximo ASC (urgente primeiro). Limita ao top N. */
export function rankearAlertas(
  agregados: MunicipioRiscoAgregado[],
  top?: number
): MunicipioRiscoAgregado[]
```

### Extração de constantes compartilhadas

`src/lib/risco-constants.ts` (novo, evita drift entre `diagnostico.ts` e `radar.ts`):

```ts
export const PCT_EXECUCAO_CRITICO = 70
export const DIAS_PRAZO_CRITICO = 90
```

`src/lib/diagnostico.ts` passa a importar dessas constantes (refactor pequeno, sem mudar comportamento).

---

## Testes

### TypeScript (Vitest)

`src/lib/__tests__/radar.test.ts`:
- `isEmRisco` — todas as combinações: pct alta+prazo distante (false), pct baixa (true), prazo próximo (true), prazo vencido (true), pct null (false)
- `agruparPorMunicipio` — soma valor_em_risco corretamente, conta programas, escolhe prazo mais próximo, ignora programas não em risco
- `rankearAlertas` — ordena por valor desc, desempata por prazo asc, respeita top N

### Python (Pytest)

`scraper/tests/test_transferegov.py` (verificar se já existe; criar/ajustar):
- Mock de response da API Transferegov
- Parse extrai campos corretos
- Rate limit é respeitado (mock `time.sleep`)
- Upsert chamado com chave dedup correta
- Sem hit em API real

### Manual / E2E

1. Trigger manual do workflow GitHub Actions com `RADAR_UFS=SE` (estado pequeno)
2. Verificar via Supabase SQL que `transferencias_federais` tem rows
3. Acessar `/admin/radar?uf=SE` → ver feed com municípios
4. Click num card → ver detalhe → click "Gerar Diagnóstico" → checar query string passada

---

## Edge cases e error handling

| Caso | Comportamento |
|---|---|
| Scraper nunca rodou (tabela vazia) | Empty state na `/admin/radar` com instrução de trigger manual via GH Actions |
| UF sem dados | Mensagem específica: "Nenhum município com subexecução crítica em [UF]." |
| `coletado_em` > 14 dias | Banner amarelo de stale data com timestamp |
| IBGE inválido em `/admin/radar/[ibge]` | `notFound()` (404) |
| Município sem programas em risco | Página detalhe ainda renderiza, com mensagem "Nenhum programa em risco" |
| Scraper Transferegov falha durante run | Log no GH Actions; dados anteriores permanecem (upsert dedup garante consistência) |
| Sem `?from=radar` no query param | M2/M3 funcionam normalmente — query param é meramente analítico |

---

## Decisões de design e tradeoffs

**Por que GitHub Actions e não cron no EasyPanel?**
Zero infra extra, logs nativos, trigger manual via UI, push direto pro Supabase via service role. EasyPanel exigiria container Python separado.

**Por que só Transferegov no MVP?**
YAGNI. Cobre ~80% do dado de subexecução com prazo real. Portal Transparência, FNAS/FNS/FNDE entram em iterações futuras (specs separados quando demandado).

**Por que ranking server-side em SQL, não em TS?**
Indexes garantem que isso escala mesmo com 5571 municípios futuros. TS faria full scan.

**Por que extrair `risco-constants.ts`?**
M1 e M2 usam as mesmas duas constantes. Mantê-las em arquivo único evita drift silencioso quando uma mudar.

**Por que não Realtime na UI?**
Cron semanal = dado refresha 1×/semana. Realtime seria overkill. `revalidate: 300` ou refresh manual basta.

**Por que default UF = AL (não "all")?**
Feed mostrando 4 estados misturados perde a leitura. Tabs por UF é mais clara. Default AL = primeiro alfabético (estável, neutro).

---

## Arquivos que vão entrar/mudar

| Arquivo | Status |
|---|---|
| `supabase/migrations/028_radar_indexes.sql` | criar |
| `scraper/sources/transferegov.py` | auditar/ajustar (suporte `--ufs`) |
| `scraper/run.py` | ajustar (aceitar `--source` e `--ufs`) |
| `scraper/tests/test_transferegov.py` | criar/ajustar |
| `.github/workflows/radar-scrape.yml` | criar |
| `src/lib/risco-constants.ts` | criar |
| `src/lib/diagnostico.ts` | ajustar imports (refactor pequeno) |
| `src/lib/radar.ts` | criar |
| `src/lib/__tests__/radar.test.ts` | criar |
| `src/app/admin/radar/page.tsx` | criar |
| `src/app/admin/radar/[ibge]/page.tsx` | criar |
| `src/app/admin/layout.tsx` | modificar (sidebar) |
| `src/app/admin/diagnostico/novo/page.tsx` | verificar/ajustar (aceitar `?ibge=&from=radar`) |
| `src/app/admin/projeto/novo/page.tsx` | verificar/ajustar (aceitar `?ibge=&from=radar`) |

---

## Critérios de aceitação

1. Trigger manual do workflow popula `transferencias_federais` para AL/SE/PE/BA sem erros
2. `/admin/radar?uf=SE` exibe lista ranqueada de municípios com valor em risco
3. Click num card vai pra `/admin/radar/[ibge]` com tabela completa
4. CTAs levam pros fluxos M2/M3 com query param correto
5. Empty state e stale-data warning funcionam
6. Sidebar tem link "Radar" como primeiro item
7. Testes TS passam (`radar.test.ts`) — pelo menos 8 cases
8. Build limpo, sem regressão nos testes M2/M3/M5/M7 existentes
9. Cron agendado e secrets configurados (verificação manual no GitHub)

---

**Próximo passo:** após aprovação, escrever plano de implementação detalhado em `docs/superpowers/plans/2026-05-27-m1-radar-subexecucao.md` via writing-plans skill.
