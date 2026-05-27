# M1 — Radar de Subexecução Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar M1: pipeline Transferegov via GitHub Actions cron semanal + feed `/admin/radar` por estado (AL/SE/PE/BA) + detalhe `/admin/radar/[ibge]` com CTAs para M2/M3.

**Architecture:** Scraper Python existente roda em GH Actions com `--source transferegov --ufs AL,SE,PE,BA` e popula `transferencias_federais` via upsert. Server components em Next.js consultam direto via Supabase admin client com ranking SQL. CTAs linkam para `/admin/diagnostico/novo?ibge=X&from=radar` e `/admin/projeto/novo?ibge=X&from=radar` (M2/M3 já implementados).

**Tech Stack:** Python 3.11 (scrapers), GitHub Actions (cron), Next.js 15 App Router, TypeScript strict, Supabase (RLS admin-only), Vitest, Pytest.

**Spec de referência:** `docs/superpowers/specs/2026-05-27-m1-radar-subexecucao-design.md`

---

## Mapa de Arquivos

| Arquivo | Responsabilidade |
|---|---|
| `supabase/migrations/028_radar_indexes.sql` | 3 índices em `transferencias_federais` para acelerar ranking/freshness |
| `src/lib/risco-constants.ts` | Constantes compartilhadas `PCT_EXECUCAO_CRITICO` e `DIAS_PRAZO_CRITICO` |
| `src/lib/diagnostico.ts` | Refactor: importar constantes do novo arquivo |
| `src/lib/radar.ts` | Lógica pura: `isEmRisco`, `agruparPorMunicipio`, `rankearAlertas` |
| `src/lib/__tests__/radar.test.ts` | Vitest TDD para `radar.ts` |
| `src/lib/radar-data.ts` | Server-only: fetch + agregação para UI (usa admin client) |
| `scraper/run.py` | Refactor: aceitar `--source`/`--ufs` via argparse, fetch municípios da tabela |
| `.github/workflows/radar-scrape.yml` | Cron semanal + workflow_dispatch manual |
| `src/app/admin/radar/page.tsx` | Feed por estado (UF tabs, ranking top 50) |
| `src/app/admin/radar/[ibge]/page.tsx` | Detalhe município + CTAs M2/M3 |
| `src/app/admin/layout.tsx` | Adicionar item "Radar" como primeiro NAV_ITEM |
| `src/app/admin/diagnostico/novo/page.tsx` | Aceitar `?ibge=` (pré-seleciona município) |
| `src/components/diagnostico/DiagnosticoForm.tsx` | Aceitar prop `ibgeInicial` |
| `src/app/admin/projeto/novo/page.tsx` | Aceitar `?ibge=` (filtra diagnóstico do município) |

---

## Task 1: Migration — `028_radar_indexes.sql`

**Files:**
- Create: `supabase/migrations/028_radar_indexes.sql`

- [ ] **Step 1: Criar migration**

Criar `supabase/migrations/028_radar_indexes.sql`:

```sql
-- 028_radar_indexes.sql
-- Índices para acelerar queries do M1 Radar de Subexecução.
-- A tabela transferencias_federais já existe (migration 001) e tem RLS admin-only.

-- Acelera agregação por município no feed principal
CREATE INDEX IF NOT EXISTS transferencias_municipio_pct_idx
  ON transferencias_federais (municipio_ibge, percentual_execucao);

-- Acelera filtro de prazo crítico (próximos 90 dias)
CREATE INDEX IF NOT EXISTS transferencias_prazo_idx
  ON transferencias_federais (prazo_limite)
  WHERE prazo_limite IS NOT NULL;

-- Acelera "freshness check" (MAX(coletado_em) para banner stale-data)
CREATE INDEX IF NOT EXISTS transferencias_coletado_idx
  ON transferencias_federais (coletado_em DESC);
```

- [ ] **Step 2: Aplicar via Supabase MCP**

Aplicar com `mcp__plugin_supabase_supabase__apply_migration`:
- `project_id`: `sfzuoqnzdhknmqtprfly`
- `name`: `028_radar_indexes`
- `query`: conteúdo do SQL acima

- [ ] **Step 3: Verificar índices criados**

Executar via MCP `execute_sql`:

```sql
SELECT indexname FROM pg_indexes
WHERE tablename = 'transferencias_federais'
  AND indexname IN (
    'transferencias_municipio_pct_idx',
    'transferencias_prazo_idx',
    'transferencias_coletado_idx'
  );
```

Esperado: 3 rows.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/028_radar_indexes.sql
git commit -m "feat: add radar indexes for transferencias_federais (M1)"
```

---

## Task 2: Extrair `risco-constants.ts` + refactor `diagnostico.ts`

**Files:**
- Create: `src/lib/risco-constants.ts`
- Modify: `src/lib/diagnostico.ts:4-5`

- [ ] **Step 1: Criar `src/lib/risco-constants.ts`**

```ts
// src/lib/risco-constants.ts
// Constantes compartilhadas pela definição de "em risco" usada em M1 (Radar) e M2 (Diagnóstico).
// Fonte única para evitar drift silencioso quando ajustadas.

export const PCT_EXECUCAO_CRITICO = 70
export const DIAS_PRAZO_CRITICO = 90
```

- [ ] **Step 2: Atualizar `src/lib/diagnostico.ts` para importar**

Substituir as linhas 4-5 (`const PCT_EXECUCAO_CRITICO = 70` e `const DIAS_PRAZO_CRITICO = 90`) por:

```ts
import { PCT_EXECUCAO_CRITICO, DIAS_PRAZO_CRITICO } from '@/lib/risco-constants'
```

(O import deve ficar junto com o `import type` existente no topo, fora dele.)

- [ ] **Step 3: Rodar testes de diagnostico para garantir zero regressão**

```bash
npm test -- diagnostico 2>&1 | tail -15
```

Esperado: todos os testes que já passavam continuam passando.

- [ ] **Step 4: Commit**

```bash
git add src/lib/risco-constants.ts src/lib/diagnostico.ts
git commit -m "refactor: extract risco-constants for M1+M2 reuse"
```

---

## Task 3: Lógica pura `src/lib/radar.ts` (TDD)

**Files:**
- Create: `src/lib/__tests__/radar.test.ts`
- Create: `src/lib/radar.ts`

- [ ] **Step 1: Criar `src/lib/__tests__/radar.test.ts` ANTES da implementação**

```ts
import { describe, test, expect } from 'vitest'
import { isEmRisco, agruparPorMunicipio, rankearAlertas } from '@/lib/radar'
import type { TransferenciaFederal } from '@/types'

const FIXED_TODAY = new Date('2026-05-27T12:00:00Z')

function makeT(overrides: Partial<TransferenciaFederal> = {}): TransferenciaFederal & { municipio_nome: string } {
  return {
    id: 'uuid-1',
    municipio_ibge: '2803500',
    municipio_nome: 'Lagarto',
    programa: 'SCFV',
    fundo: 'FNAS',
    valor_empenhado: 1_000_000,
    valor_liquidado: 600_000,
    valor_pago: 600_000,
    percentual_execucao: 60, // <70 → em risco por pct
    competencia: '2026-01-01',
    prazo_limite: null,
    fonte: 'transferegov',
    coletado_em: '2026-05-20T00:00:00Z',
    ...overrides,
  }
}

describe('isEmRisco', () => {
  test('pct < 70 → true', () => {
    expect(isEmRisco(makeT({ percentual_execucao: 60, prazo_limite: null }), FIXED_TODAY)).toBe(true)
  })

  test('pct >= 70 e prazo > 90d → false', () => {
    expect(isEmRisco(makeT({ percentual_execucao: 90, prazo_limite: '2027-01-01' }), FIXED_TODAY)).toBe(false)
  })

  test('pct alta mas prazo nos próximos 90d → true (urgência)', () => {
    expect(isEmRisco(makeT({ percentual_execucao: 95, prazo_limite: '2026-07-01' }), FIXED_TODAY)).toBe(true)
  })

  test('pct alta e prazo vencido → true (overdue ainda demanda ação)', () => {
    expect(isEmRisco(makeT({ percentual_execucao: 95, prazo_limite: '2026-01-01' }), FIXED_TODAY)).toBe(true)
  })

  test('pct null tratado como 0 → true', () => {
    expect(isEmRisco(makeT({ percentual_execucao: 0, prazo_limite: null }), FIXED_TODAY)).toBe(true)
  })

  test('pct exatamente 70 → false (limite exclusivo)', () => {
    expect(isEmRisco(makeT({ percentual_execucao: 70, prazo_limite: null }), FIXED_TODAY)).toBe(false)
  })
})

describe('agruparPorMunicipio', () => {
  test('soma valor_em_risco (empenhado - pago) por município', () => {
    const rows = [
      makeT({ municipio_ibge: 'A', valor_empenhado: 1_000, valor_pago: 200 }), // risco 800
      makeT({ municipio_ibge: 'A', valor_empenhado: 500, valor_pago: 100 }),   // risco 400
      makeT({ municipio_ibge: 'B', valor_empenhado: 2_000, valor_pago: 500 }), // risco 1500
    ]
    const r = agruparPorMunicipio(rows, FIXED_TODAY)
    const a = r.find(x => x.municipio_ibge === 'A')!
    expect(a.valor_em_risco).toBe(1_200)
    expect(a.num_programas_risco).toBe(2)
  })

  test('ignora programas que NÃO estão em risco', () => {
    const rows = [
      makeT({ municipio_ibge: 'A', percentual_execucao: 60 }),              // risco
      makeT({ municipio_ibge: 'A', percentual_execucao: 95, prazo_limite: null }), // não risco
    ]
    const r = agruparPorMunicipio(rows, FIXED_TODAY)
    expect(r[0].num_programas_risco).toBe(1)
  })

  test('prazo_mais_proximo é o menor entre programas em risco', () => {
    const rows = [
      makeT({ municipio_ibge: 'A', prazo_limite: '2026-08-01' }),
      makeT({ municipio_ibge: 'A', prazo_limite: '2026-06-15' }),
      makeT({ municipio_ibge: 'A', prazo_limite: null }),
    ]
    const r = agruparPorMunicipio(rows, FIXED_TODAY)
    expect(r[0].prazo_mais_proximo).toBe('2026-06-15')
  })

  test('prazo_mais_proximo é null se nenhum programa tem prazo', () => {
    const rows = [makeT({ municipio_ibge: 'A', prazo_limite: null })]
    const r = agruparPorMunicipio(rows, FIXED_TODAY)
    expect(r[0].prazo_mais_proximo).toBeNull()
  })

  test('valor_em_risco nunca negativo (pago > empenhado por erro de dado)', () => {
    const rows = [makeT({ municipio_ibge: 'A', valor_empenhado: 100, valor_pago: 500, percentual_execucao: 60 })]
    const r = agruparPorMunicipio(rows, FIXED_TODAY)
    expect(r[0].valor_em_risco).toBe(0)
  })
})

describe('rankearAlertas', () => {
  test('ordena valor_em_risco DESC', () => {
    const alertas = [
      { municipio_ibge: 'A', municipio_nome: 'A', valor_em_risco: 1000, num_programas_risco: 1, prazo_mais_proximo: null },
      { municipio_ibge: 'B', municipio_nome: 'B', valor_em_risco: 5000, num_programas_risco: 2, prazo_mais_proximo: null },
      { municipio_ibge: 'C', municipio_nome: 'C', valor_em_risco: 3000, num_programas_risco: 1, prazo_mais_proximo: null },
    ]
    const r = rankearAlertas(alertas)
    expect(r.map(x => x.municipio_ibge)).toEqual(['B', 'C', 'A'])
  })

  test('desempata por prazo_mais_proximo ASC (urgente primeiro)', () => {
    const alertas = [
      { municipio_ibge: 'A', municipio_nome: 'A', valor_em_risco: 1000, num_programas_risco: 1, prazo_mais_proximo: '2026-12-01' },
      { municipio_ibge: 'B', municipio_nome: 'B', valor_em_risco: 1000, num_programas_risco: 1, prazo_mais_proximo: '2026-06-01' },
    ]
    const r = rankearAlertas(alertas)
    expect(r[0].municipio_ibge).toBe('B')
  })

  test('null em prazo_mais_proximo vai por último no desempate', () => {
    const alertas = [
      { municipio_ibge: 'A', municipio_nome: 'A', valor_em_risco: 1000, num_programas_risco: 1, prazo_mais_proximo: null },
      { municipio_ibge: 'B', municipio_nome: 'B', valor_em_risco: 1000, num_programas_risco: 1, prazo_mais_proximo: '2026-06-01' },
    ]
    const r = rankearAlertas(alertas)
    expect(r[0].municipio_ibge).toBe('B')
  })

  test('respeita parâmetro top', () => {
    const alertas = Array.from({ length: 10 }, (_, i) => ({
      municipio_ibge: String(i),
      municipio_nome: `M${i}`,
      valor_em_risco: 1000 - i,
      num_programas_risco: 1,
      prazo_mais_proximo: null,
    }))
    expect(rankearAlertas(alertas, 3)).toHaveLength(3)
  })

  test('top default = 50', () => {
    const alertas = Array.from({ length: 60 }, (_, i) => ({
      municipio_ibge: String(i),
      municipio_nome: `M${i}`,
      valor_em_risco: 1000 - i,
      num_programas_risco: 1,
      prazo_mais_proximo: null,
    }))
    expect(rankearAlertas(alertas)).toHaveLength(50)
  })
})
```

- [ ] **Step 2: Rodar testes (devem falhar — TDD red)**

```bash
npm test -- radar.test 2>&1 | tail -10
```

Esperado: erro de import (módulo não existe).

- [ ] **Step 3: Criar `src/lib/radar.ts`**

```ts
// src/lib/radar.ts
import type { TransferenciaFederal } from '@/types'
import { PCT_EXECUCAO_CRITICO, DIAS_PRAZO_CRITICO } from '@/lib/risco-constants'

export interface MunicipioRiscoAgregado {
  municipio_ibge: string
  municipio_nome: string
  valor_em_risco: number
  num_programas_risco: number
  prazo_mais_proximo: string | null
}

/**
 * "Em risco" = % execução < 70 OU prazo nos próximos 90 dias (inclui vencidos).
 * Mesma definição usada em diagnostico.ts.
 */
export function isEmRisco(
  t: Pick<TransferenciaFederal, 'percentual_execucao' | 'prazo_limite'>,
  hoje?: Date
): boolean {
  const pct = t.percentual_execucao ?? 0
  if (pct < PCT_EXECUCAO_CRITICO) return true
  if (!t.prazo_limite) return false

  const ref = hoje ?? new Date(new Date().toISOString().slice(0, 10) + 'T12:00:00Z')
  const prazo = new Date(t.prazo_limite + 'T12:00:00Z')
  const dias = Math.floor((prazo.getTime() - ref.getTime()) / 86_400_000)
  return dias <= DIAS_PRAZO_CRITICO
}

/**
 * Filtra rows em risco e agrupa por município:
 * - valor_em_risco = soma de max(0, empenhado - pago) dos programas em risco
 * - num_programas_risco = contagem dos programas em risco
 * - prazo_mais_proximo = menor prazo_limite (null se nenhum tem prazo)
 */
export function agruparPorMunicipio(
  rows: Array<TransferenciaFederal & { municipio_nome: string }>,
  hoje?: Date
): MunicipioRiscoAgregado[] {
  const mapa = new Map<string, MunicipioRiscoAgregado>()

  for (const r of rows) {
    if (!isEmRisco(r, hoje)) continue

    const valor = Math.max(0, (r.valor_empenhado ?? 0) - (r.valor_pago ?? 0))
    const atual = mapa.get(r.municipio_ibge)

    if (!atual) {
      mapa.set(r.municipio_ibge, {
        municipio_ibge: r.municipio_ibge,
        municipio_nome: r.municipio_nome,
        valor_em_risco: valor,
        num_programas_risco: 1,
        prazo_mais_proximo: r.prazo_limite,
      })
    } else {
      atual.valor_em_risco += valor
      atual.num_programas_risco += 1
      if (r.prazo_limite) {
        if (!atual.prazo_mais_proximo || r.prazo_limite < atual.prazo_mais_proximo) {
          atual.prazo_mais_proximo = r.prazo_limite
        }
      }
    }
  }

  return Array.from(mapa.values())
}

/**
 * Ordena: valor_em_risco DESC; desempate por prazo_mais_proximo ASC (urgente primeiro);
 * null em prazo vai por último no desempate. Limita ao top N (default 50).
 */
export function rankearAlertas(
  agregados: MunicipioRiscoAgregado[],
  top = 50
): MunicipioRiscoAgregado[] {
  const copia = [...agregados]
  copia.sort((a, b) => {
    if (a.valor_em_risco !== b.valor_em_risco) return b.valor_em_risco - a.valor_em_risco
    // Desempate por prazo: null no fim
    if (a.prazo_mais_proximo === null && b.prazo_mais_proximo === null) return 0
    if (a.prazo_mais_proximo === null) return 1
    if (b.prazo_mais_proximo === null) return -1
    return a.prazo_mais_proximo.localeCompare(b.prazo_mais_proximo)
  })
  return copia.slice(0, top)
}
```

- [ ] **Step 4: Rodar testes (devem passar — TDD green)**

```bash
npm test -- radar.test 2>&1 | tail -15
```

Esperado: todos os testes passam.

- [ ] **Step 5: Commit**

```bash
git add src/lib/radar.ts src/lib/__tests__/radar.test.ts
git commit -m "feat: add radar pure logic (isEmRisco, agruparPorMunicipio, rankearAlertas) with TDD"
```

---

## Task 4: Refactor `scraper/run.py` — argparse `--source` + `--ufs`

**Files:**
- Modify: `scraper/run.py` (rewrite main + add CLI)

**Contexto:** Hoje `run.py` itera `MUNICIPIOS_ATIVOS` (9 municípios hardcoded) e roda TODAS as fontes (portal_transparencia, transferegov, fnde, estaduais). O M1 precisa rodar **só transferegov** em **todos os municípios das UFs solicitadas** (AL/SE/PE/BA ≈ 400 municípios da tabela `municipios_habilitacao`).

- [ ] **Step 1: Substituir `scraper/run.py` por versão com CLI**

```python
# scraper/run.py
"""
Entry point dos scrapers Nexa Radar.
Execução:
  python -m scraper.run                                       # comportamento legado (MUNICIPIOS_ATIVOS, todas as fontes)
  python -m scraper.run --source transferegov --ufs AL,SE     # M1 Radar: só transferegov, UFs alvo
"""
import argparse
import logging
import sys
from datetime import datetime
from typing import Iterable

from scraper.config import MUNICIPIOS_ATIVOS, IBGE_TO_UF
from scraper.supabase_client import upsert, select
from scraper.sources.portal_transparencia import coletar_transferencias
from scraper.sources.siga_brasil import coletar_emendas_individuais
from scraper.sources.transferegov import coletar_convenios
from scraper.sources.fnde import coletar_fnde
from scraper.sources.portais_estaduais import tentar_coletar_estadual, registrar_pendencia_manual
from scraper.processors.calcular_subexecucao import calcular_por_municipio
from scraper.processors.atualizar_habilitacao import atualizar_programas_habilitados

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
log = logging.getLogger("nexaradar.run")


def fetch_municipios_por_uf(ufs: list[str]) -> list[tuple[str, str]]:
    """Busca (ibge, nome) de todos os municípios das UFs alvo via Supabase."""
    rows = select("municipios_habilitacao", filters={}, columns="ibge,nome,uf")
    return [(r["ibge"], f"{r['nome']} - {r['uf']}") for r in rows if r.get("uf") in ufs]


def run_transferegov(municipios: Iterable[tuple[str, str]]) -> None:
    """M1 Radar: coleta SÓ Transferegov para os municípios fornecidos."""
    total = 0
    for ibge, nome in municipios:
        try:
            rows = coletar_convenios(ibge)
            if rows:
                upsert(
                    "transferencias_federais",
                    rows,
                    on_conflict="municipio_ibge,programa,fonte,competencia",
                )
                total += len(rows)
        except Exception as e:
            log.error("Transferegov falhou em %s (%s): %s", nome, ibge, e, exc_info=True)
    log.info("Transferegov | TOTAL upserts: %d", total)


def coletar_municipio_full(ibge: str, nome: str, anos: list[int]) -> None:
    """Comportamento legado: todas as fontes para um município."""
    log.info("=== Iniciando coleta | %s (%s) ===", nome, ibge)

    rows_portal = coletar_transferencias(ibge, anos)
    if rows_portal:
        upsert("transferencias_federais", rows_portal,
               on_conflict="municipio_ibge,programa,fonte,competencia")

    rows_tgov = coletar_convenios(ibge)
    if rows_tgov:
        upsert("transferencias_federais", rows_tgov,
               on_conflict="municipio_ibge,programa,fonte,competencia")

    rows_fnde = coletar_fnde(ibge, anos)
    if rows_fnde:
        upsert("transferencias_federais", rows_fnde,
               on_conflict="municipio_ibge,programa,fonte,competencia")

    uf = IBGE_TO_UF.get(ibge, "")
    estadual = tentar_coletar_estadual(uf, ibge)
    if estadual is None:
        registrar_pendencia_manual(ibge, uf, "Coleta estadual requer validação manual")
    elif estadual:
        upsert("transferencias_federais", estadual,
               on_conflict="municipio_ibge,programa,fonte,competencia")

    atualizar_programas_habilitados(ibge)
    em_risco = calcular_por_municipio(ibge)
    log.info("  %d programas em risco identificados", len(em_risco))


def coletar_emendas(ano: int) -> None:
    log.info("=== Coletando emendas SIGA Brasil | %d ===", ano)
    rows = coletar_emendas_individuais(ano)
    if rows:
        upsert("emendas_parlamentares", rows,
               on_conflict="parlamentar_id,municipio_ibge,exercicio,fonte")


def main() -> None:
    parser = argparse.ArgumentParser(description="Nexa Radar scrapers")
    parser.add_argument(
        "--source",
        choices=["transferegov", "full"],
        default="full",
        help="'transferegov' = só Transferegov (M1); 'full' = todas as fontes (legado)",
    )
    parser.add_argument(
        "--ufs",
        type=str,
        default="",
        help="UFs separadas por vírgula (ex: AL,SE,PE,BA). Vazio = usa MUNICIPIOS_ATIVOS.",
    )
    args = parser.parse_args()

    log.info("Nexa Radar — Início | source=%s | ufs=%s | %s",
             args.source, args.ufs or "MUNICIPIOS_ATIVOS", datetime.now().isoformat())

    if args.source == "transferegov":
        if args.ufs:
            ufs_list = [u.strip().upper() for u in args.ufs.split(",") if u.strip()]
            municipios = fetch_municipios_por_uf(ufs_list)
            log.info("M1 Radar | %d municípios das UFs %s", len(municipios), ufs_list)
        else:
            municipios = [(ibge, nome) for nome, ibge in MUNICIPIOS_ATIVOS.items()]
        run_transferegov(municipios)
    else:
        # 'full' = comportamento legado
        hoje = datetime.now()
        anos = [hoje.year, hoje.year - 1]
        for nome, ibge in MUNICIPIOS_ATIVOS.items():
            try:
                coletar_municipio_full(ibge, nome, anos)
            except Exception as e:
                log.error("Falha em %s (%s): %s", nome, ibge, e, exc_info=True)
        for ano in anos:
            try:
                coletar_emendas(ano)
            except Exception as e:
                log.error("Falha emendas %d: %s", ano, e, exc_info=True)

    log.info("Nexa Radar — Coleta concluída")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Rodar testes existentes (regressão)**

```bash
python3 -m pytest scraper/tests/ -q 2>&1 | tail -10
```

Esperado: nenhum teste quebra (run.py não tem testes específicos; os testes de unit por source continuam passando).

- [ ] **Step 3: Smoke test local (apenas 1 município, sem rede)**

```bash
python3 -c "from scraper.run import fetch_municipios_por_uf; print('Function importable OK')"
```

Esperado: `Function importable OK` sem traceback.

- [ ] **Step 4: Commit**

```bash
git add scraper/run.py
git commit -m "feat: scraper/run.py argparse with --source transferegov --ufs for M1 Radar"
```

---

## Task 5: GitHub Actions workflow

**Files:**
- Create: `.github/workflows/radar-scrape.yml`

**Pré-requisito manual (após o commit):** o usuário precisa configurar 2 GitHub Secrets no repo `menezesluciano0201-web/nexa-radar`:
- `SUPABASE_URL` = `https://sfzuoqnzdhknmqtprfly.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY` = (valor real, não commit)

- [ ] **Step 1: Criar diretório `.github/workflows/` se não existir**

```bash
mkdir -p .github/workflows
```

- [ ] **Step 2: Criar `.github/workflows/radar-scrape.yml`**

```yaml
# .github/workflows/radar-scrape.yml
# M1 Radar de Subexecução — cron semanal Transferegov para AL/SE/PE/BA.
# Trigger manual disponível em Actions → "Radar — scrape Transferegov" → Run workflow.

name: Radar — scrape Transferegov

on:
  schedule:
    # Segunda-feira 06:00 UTC = 03:00 BRT (madrugada Brasil)
    - cron: '0 6 * * 1'
  workflow_dispatch:
    inputs:
      ufs:
        description: 'UFs (separadas por vírgula)'
        required: false
        default: 'AL,SE,PE,BA'

jobs:
  scrape:
    runs-on: ubuntu-latest
    timeout-minutes: 60
    env:
      SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
      SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
      RADAR_UFS: ${{ github.event.inputs.ufs || 'AL,SE,PE,BA' }}
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'
          cache: 'pip'

      - name: Install dependencies
        run: |
          python -m pip install --upgrade pip
          pip install -r scraper/requirements.txt

      - name: Run Transferegov scraper
        run: python -m scraper.run --source transferegov --ufs "$RADAR_UFS"
```

- [ ] **Step 3: Validar YAML syntax**

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/radar-scrape.yml'))" && echo "YAML OK"
```

Esperado: `YAML OK`

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/radar-scrape.yml
git commit -m "feat: add GitHub Actions workflow for M1 Radar weekly cron (Transferegov)"
```

- [ ] **Step 5: Documentar pré-requisito manual no final**

Adicionar comentário no commit message do passo 4 ou anotar em PR descrição: usuário deve configurar `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` em GitHub → Settings → Secrets and variables → Actions antes do primeiro run.

---

## Task 6: Server data layer — `src/lib/radar-data.ts`

**Files:**
- Create: `src/lib/radar-data.ts`

**Contexto:** Centraliza fetch + agregação em um arquivo server-only, para reutilização entre `/admin/radar/page.tsx` (feed) e `/admin/radar/[ibge]/page.tsx` (detalhe). Usa `requireAdminClient` (já existe em `src/lib/require-admin.ts`).

- [ ] **Step 1: Criar `src/lib/radar-data.ts`**

```ts
// src/lib/radar-data.ts
import 'server-only'
import { cache } from 'react'
import { requireAdminClient } from '@/lib/require-admin'
import { agruparPorMunicipio, rankearAlertas, type MunicipioRiscoAgregado } from '@/lib/radar'
import type { TransferenciaFederal } from '@/types'

const UFS_RADAR = ['AL', 'SE', 'PE', 'BA'] as const
export type UfRadar = (typeof UFS_RADAR)[number]

export function isUfRadar(uf: string): uf is UfRadar {
  return (UFS_RADAR as readonly string[]).includes(uf)
}

export interface FeedRadar {
  uf: UfRadar
  alertas: MunicipioRiscoAgregado[]
  total_municipios_analisados: number
  ultima_coleta: string | null   // ISO timestamp ou null
  stale: boolean                  // true se ultima_coleta > 14 dias atrás
}

const STALE_DAYS = 14

// React cache(): dedupe entre múltiplas calls no mesmo request.
export const getFeedRadar = cache(async (uf: UfRadar): Promise<FeedRadar> => {
  const admin = await requireAdminClient()

  // 1. Resolve municípios da UF (precisamos do nome para o feed)
  const { data: municipios } = await admin
    .from('municipios_habilitacao')
    .select('ibge, nome')
    .eq('uf', uf)
    .limit(2000)

  const mapaNomes = new Map<string, string>((municipios ?? []).map((m) => [m.ibge, m.nome]))

  if (mapaNomes.size === 0) {
    return { uf, alertas: [], total_municipios_analisados: 0, ultima_coleta: null, stale: false }
  }

  // 2. Pega todas as transferências dos municípios da UF
  const { data: rows } = await admin
    .from('transferencias_federais')
    .select('municipio_ibge, programa, fundo, valor_empenhado, valor_liquidado, valor_pago, percentual_execucao, prazo_limite, competencia, fonte, coletado_em, id')
    .in('municipio_ibge', Array.from(mapaNomes.keys()))
    .limit(10_000)

  const enriquecido = (rows ?? []).map((r) => ({
    ...(r as TransferenciaFederal),
    municipio_nome: mapaNomes.get(r.municipio_ibge) ?? r.municipio_ibge,
  }))

  const agregados = agruparPorMunicipio(enriquecido)
  const alertas = rankearAlertas(agregados, 50)

  // 3. Última coleta = max(coletado_em) entre todas as rows
  let ultima: string | null = null
  for (const r of enriquecido) {
    if (!ultima || r.coletado_em > ultima) ultima = r.coletado_em
  }

  const stale = ultima ? Date.now() - new Date(ultima).getTime() > STALE_DAYS * 86_400_000 : false

  return {
    uf,
    alertas,
    total_municipios_analisados: mapaNomes.size,
    ultima_coleta: ultima,
    stale,
  }
})

export interface DetalheRadar {
  municipio_ibge: string
  municipio_nome: string
  uf: string
  programas: TransferenciaFederal[]
  total_empenhado: number
  total_pago: number
  pct_execucao_medio: number
  valor_em_risco: number
  tem_diagnostico: boolean
}

export const getDetalheRadar = cache(async (ibge: string): Promise<DetalheRadar | null> => {
  const admin = await requireAdminClient()

  const [
    { data: municipio },
    { data: programas },
    { data: diag },
  ] = await Promise.all([
    admin.from('municipios_habilitacao').select('ibge, nome, uf').eq('ibge', ibge).single(),
    admin.from('transferencias_federais').select('*').eq('municipio_ibge', ibge),
    admin.from('diagnosticos').select('id').eq('municipio_ibge', ibge).in('status', ['rascunho', 'entregue']).limit(1),
  ])

  if (!municipio) return null

  const lista = (programas ?? []) as TransferenciaFederal[]
  const total_empenhado = lista.reduce((s, p) => s + (p.valor_empenhado ?? 0), 0)
  const total_pago = lista.reduce((s, p) => s + (p.valor_pago ?? 0), 0)
  const pct_execucao_medio =
    lista.length > 0
      ? lista.reduce((s, p) => s + (p.percentual_execucao ?? 0), 0) / lista.length
      : 0
  const valor_em_risco = lista.reduce(
    (s, p) => s + Math.max(0, (p.valor_empenhado ?? 0) - (p.valor_pago ?? 0)),
    0
  )

  return {
    municipio_ibge: municipio.ibge,
    municipio_nome: municipio.nome,
    uf: municipio.uf,
    programas: lista,
    total_empenhado,
    total_pago,
    pct_execucao_medio,
    valor_em_risco,
    tem_diagnostico: (diag ?? []).length > 0,
  }
})
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit --skipLibCheck 2>&1 | grep 'radar-data' | head -5
```

Esperado: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/lib/radar-data.ts
git commit -m "feat: add radar-data.ts server layer (getFeedRadar, getDetalheRadar)"
```

---

## Task 7: UI `/admin/radar/page.tsx` — feed

**Files:**
- Create: `src/app/admin/radar/page.tsx`

- [ ] **Step 1: Criar `src/app/admin/radar/page.tsx`**

```tsx
// src/app/admin/radar/page.tsx
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { brl } from '@/lib/format'
import { getFeedRadar, isUfRadar } from '@/lib/radar-data'

const UFS = ['AL', 'SE', 'PE', 'BA'] as const

export default async function RadarPage({
  searchParams,
}: {
  searchParams: Promise<{ uf?: string }>
}) {
  const params = await searchParams
  const ufParam = params.uf?.toUpperCase()
  if (ufParam && !isUfRadar(ufParam)) redirect('/admin/radar')

  const uf = (ufParam ?? 'AL') as (typeof UFS)[number]
  const feed = await getFeedRadar(uf)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-100">Radar de Subexecução</h1>
        <p className="text-slate-400 text-sm mt-1">
          Municípios com recursos federais empenhados e não executados (cron semanal Transferegov)
        </p>
      </div>

      {/* Tabs UF */}
      <div className="flex gap-2 border-b border-slate-800">
        {UFS.map((u) => (
          <Link
            key={u}
            href={`/admin/radar?uf=${u}`}
            className={
              u === uf
                ? 'px-4 py-2 text-sm font-semibold text-nexa-400 border-b-2 border-nexa-500 -mb-px'
                : 'px-4 py-2 text-sm text-slate-400 hover:text-slate-200'
            }
          >
            {u}
          </Link>
        ))}
      </div>

      {/* Meta info */}
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>
          {feed.total_municipios_analisados} municípios em {uf} ·
          {feed.alertas.length} com subexecução crítica
        </span>
        <span>
          {feed.ultima_coleta
            ? `Última coleta: ${new Date(feed.ultima_coleta).toLocaleString('pt-BR')}`
            : 'Nenhuma coleta ainda'}
        </span>
      </div>

      {/* Stale warning */}
      {feed.stale && (
        <div className="rounded-md bg-yellow-900/40 border border-yellow-800 p-4 text-sm text-yellow-300">
          Dados podem estar desatualizados — última varredura há mais de 14 dias.
        </div>
      )}

      {/* Empty state */}
      {feed.alertas.length === 0 && (
        <div className="rounded-md bg-slate-800/50 border border-slate-700 p-8 text-center">
          <p className="text-slate-300 font-medium">
            Nenhum município com subexecução crítica em {uf}.
          </p>
          <p className="text-slate-500 text-sm mt-2">
            {feed.ultima_coleta
              ? `Última varredura: ${new Date(feed.ultima_coleta).toLocaleString('pt-BR')}.`
              : 'O scraper ainda não rodou para este estado. Acesse GitHub → Actions → "Radar — scrape Transferegov" → Run workflow.'}
          </p>
        </div>
      )}

      {/* Feed */}
      {feed.alertas.length > 0 && (
        <div className="rounded-md border border-slate-800 divide-y divide-slate-800 bg-slate-800/30">
          {feed.alertas.map((a) => (
            <Link
              key={a.municipio_ibge}
              href={`/admin/radar/${a.municipio_ibge}`}
              className="flex items-center justify-between gap-4 p-4 hover:bg-slate-800/60 transition-colors"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-yellow-400">⚠</span>
                  <span className="font-medium text-slate-100">{a.municipio_nome} - {uf}</span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  {a.num_programas_risco} programa{a.num_programas_risco === 1 ? '' : 's'} em risco
                  {a.prazo_mais_proximo &&
                    ` · prazo +próximo: ${new Date(a.prazo_mais_proximo).toLocaleDateString('pt-BR')}`}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-base font-semibold text-slate-100">{brl(a.valor_em_risco)}</p>
                <p className="text-xs text-slate-500">em risco</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit --skipLibCheck 2>&1 | grep 'admin/radar/page' | head -5
```

Esperado: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/radar/page.tsx
git commit -m "feat: add /admin/radar feed page with UF tabs and stale-data warning"
```

---

## Task 8: UI `/admin/radar/[ibge]/page.tsx` — detalhe

**Files:**
- Create: `src/app/admin/radar/[ibge]/page.tsx`

- [ ] **Step 1: Criar `src/app/admin/radar/[ibge]/page.tsx`**

```tsx
// src/app/admin/radar/[ibge]/page.tsx
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { brl, IBGE_RE } from '@/lib/format'
import { isEmRisco } from '@/lib/radar'
import { getDetalheRadar } from '@/lib/radar-data'

export default async function RadarDetalhePage({
  params,
}: {
  params: Promise<{ ibge: string }>
}) {
  const { ibge } = await params
  if (!IBGE_RE.test(ibge)) notFound()

  const detalhe = await getDetalheRadar(ibge)
  if (!detalhe) notFound()

  // Ordena: risco primeiro, depois por valor empenhado desc
  const programasOrdenados = [...detalhe.programas].sort((a, b) => {
    const aRisco = isEmRisco(a) ? 1 : 0
    const bRisco = isEmRisco(b) ? 1 : 0
    if (aRisco !== bRisco) return bRisco - aRisco
    return (b.valor_empenhado ?? 0) - (a.valor_empenhado ?? 0)
  })

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            href={`/admin/radar?uf=${detalhe.uf}`}
            className="text-xs text-slate-500 hover:text-slate-300"
          >
            ← Voltar para {detalhe.uf}
          </Link>
          <h1 className="text-xl font-bold text-slate-100 mt-1">
            {detalhe.municipio_nome} - {detalhe.uf}
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            {brl(detalhe.valor_em_risco)} em risco · {detalhe.programas.length} programas analisados
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Empenhado total', valor: brl(detalhe.total_empenhado) },
          { label: 'Pago total', valor: brl(detalhe.total_pago) },
          { label: 'Execução média', valor: `${detalhe.pct_execucao_medio.toFixed(1)}%` },
        ].map((item) => (
          <div key={item.label} className="rounded-md bg-slate-800 p-4">
            <p className="text-xs text-slate-400">{item.label}</p>
            <p className="text-lg font-semibold text-slate-100 mt-1">{item.valor}</p>
          </div>
        ))}
      </div>

      {/* CTAs */}
      <div className="flex flex-wrap gap-3">
        <Link
          href={`/admin/diagnostico/novo?ibge=${detalhe.municipio_ibge}&from=radar`}
          className="rounded-md bg-nexa-600 px-4 py-2 text-sm font-semibold text-white hover:bg-nexa-500"
        >
          Gerar Diagnóstico →
        </Link>
        {detalhe.tem_diagnostico ? (
          <Link
            href={`/admin/projeto/novo?ibge=${detalhe.municipio_ibge}&from=radar`}
            className="rounded-md bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-600"
          >
            Gerar Projeto →
          </Link>
        ) : (
          <button
            disabled
            title="Gere um diagnóstico primeiro"
            className="rounded-md bg-slate-700 px-4 py-2 text-sm font-semibold text-slate-500 cursor-not-allowed"
          >
            Gerar Projeto (sem diagnóstico)
          </button>
        )}
      </div>

      {/* Programas */}
      {programasOrdenados.length === 0 ? (
        <div className="rounded-md bg-slate-800/50 border border-slate-700 p-8 text-center text-slate-400 text-sm">
          Nenhuma transferência registrada para este município ainda.
        </div>
      ) : (
        <div className="rounded-md border border-slate-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-800">
              <tr>
                {['Programa', 'Fundo', 'Empenhado', 'Pago', '%', 'Prazo', ''].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {programasOrdenados.map((p) => {
                const risco = isEmRisco(p)
                return (
                  <tr key={p.id} className="hover:bg-slate-800/50">
                    <td className="px-4 py-3 text-slate-300">{p.programa}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{p.fundo}</td>
                    <td className="px-4 py-3 text-slate-300 font-mono text-xs">{brl(p.valor_empenhado)}</td>
                    <td className="px-4 py-3 text-slate-300 font-mono text-xs">{brl(p.valor_pago)}</td>
                    <td className="px-4 py-3 text-slate-300 text-xs">{(p.percentual_execucao ?? 0).toFixed(0)}%</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      {p.prazo_limite ? new Date(p.prazo_limite).toLocaleDateString('pt-BR') : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {risco && (
                        <span className="rounded bg-yellow-900 text-yellow-300 px-2 py-0.5 text-xs font-semibold">
                          ⚠ risco
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit --skipLibCheck 2>&1 | grep 'admin/radar/\[ibge\]' | head -5
```

Esperado: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/radar/\[ibge\]/page.tsx
git commit -m "feat: add /admin/radar/[ibge] detalhe with CTAs to M2/M3"
```

---

## Task 9: Sidebar — link "Radar"

**Files:**
- Modify: `src/app/admin/layout.tsx:17-32`

- [ ] **Step 1: Adicionar import do ícone Radar**

Em `src/app/admin/layout.tsx`, na lista de imports da `lucide-react` (linhas ~6-16), adicionar `Radar`:

```ts
import {
  LayoutDashboard,
  Users,
  MapPin,
  FileText,
  FileCheck,
  Globe,
  Users2,
  Activity,
  Bell,
  LogOut,
  Radar,
} from 'lucide-react'
```

- [ ] **Step 2: Adicionar item no NAV_ITEMS como primeiro após "Visão Geral"**

Substituir o array `NAV_ITEMS` (linhas ~18-29) por:

```ts
const NAV_ITEMS = [
  { href: '/admin', label: 'Visão Geral', icon: LayoutDashboard },
  { href: '/admin/radar', label: 'Radar', icon: Radar },
  { href: '/admin/clientes', label: 'Clientes', icon: Users },
  { href: '/admin/municipios', label: 'Municípios', icon: MapPin },
  { href: '/admin/diagnostico/novo', label: 'Novo Diagnóstico', icon: FileText },
  { href: '/admin/projeto', label: 'Projetos', icon: FileCheck },
  { href: '/admin/portal', label: 'Portal', icon: Globe },
  { href: '/admin/parlamentar', label: 'Parlamentares', icon: Users2 },
  { href: '/admin/coleta', label: 'Coleta de Dados', icon: Activity },
  { href: '/admin/alertas', label: 'Alertas', icon: Bell },
]
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit --skipLibCheck 2>&1 | grep 'admin/layout' | head -5
```

Esperado: sem erros.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/layout.tsx
git commit -m "feat: add Radar to admin sidebar (M1)"
```

---

## Task 10: Aceitar `?ibge=&from=radar` em `/admin/diagnostico/novo`

**Files:**
- Modify: `src/app/admin/diagnostico/novo/page.tsx`
- Modify: `src/components/diagnostico/DiagnosticoForm.tsx`

- [ ] **Step 1: Atualizar `src/app/admin/diagnostico/novo/page.tsx` para ler searchParams**

Substituir o arquivo inteiro por:

```tsx
// src/app/admin/diagnostico/novo/page.tsx
import { requireAdminClient } from '@/lib/require-admin'
import DiagnosticoForm from '@/components/diagnostico/DiagnosticoForm'
import { IBGE_RE } from '@/lib/format'

export default async function NovoDiagnosticoPage({
  searchParams,
}: {
  searchParams: Promise<{ ibge?: string; from?: string }>
}) {
  const admin = await requireAdminClient()
  const { ibge: ibgeParam } = await searchParams
  const ibgeInicial = ibgeParam && IBGE_RE.test(ibgeParam) ? ibgeParam : ''

  const { data: municipios } = await admin
    .from('municipios_habilitacao')
    .select('ibge, nome, uf')
    .order('nome')
    .limit(6000)

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold text-slate-100 mb-1">Novo Diagnóstico</h1>
      <p className="text-slate-400 text-sm mb-8">
        Selecione o município e clique em gerar. O processo leva 30–60 segundos.
      </p>
      <DiagnosticoForm municipios={municipios ?? []} ibgeInicial={ibgeInicial} />
    </div>
  )
}
```

- [ ] **Step 2: Atualizar `src/components/diagnostico/DiagnosticoForm.tsx` para aceitar `ibgeInicial`**

Em `src/components/diagnostico/DiagnosticoForm.tsx`, alterar a interface `Props` e o `useState` inicial:

```ts
interface Props {
  municipios: Municipio[]
  ibgeInicial?: string
}

export default function DiagnosticoForm({ municipios, ibgeInicial = '' }: Props) {
  const [ibge, setIbge] = useState(ibgeInicial)
  // ... resto permanece igual
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit --skipLibCheck 2>&1 | grep -E 'diagnostico/novo|DiagnosticoForm' | head -5
```

Esperado: sem erros.

- [ ] **Step 4: Rodar testes existentes (regressão)**

```bash
npm test -- diagnostico 2>&1 | tail -10
```

Esperado: nenhuma regressão.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/diagnostico/novo/page.tsx src/components/diagnostico/DiagnosticoForm.tsx
git commit -m "feat: /admin/diagnostico/novo accepts ?ibge= for Radar deep-link"
```

---

## Task 11: Aceitar `?ibge=` em `/admin/projeto/novo`

**Files:**
- Modify: `src/app/admin/projeto/novo/page.tsx`
- Modify: `src/components/projeto/ProjetoFormCompleto.tsx` (se aceitar prop opcional)

**Contexto:** `/admin/projeto/novo` hoje carrega lista de diagnósticos e o usuário escolhe um. Com `?ibge=2803500`, queremos pré-filtrar a lista para mostrar apenas diagnósticos desse município.

- [ ] **Step 1: Ler estrutura atual de `ProjetoFormCompleto.tsx`**

```bash
head -40 src/components/projeto/ProjetoFormCompleto.tsx
```

Identificar como o componente recebe `diagnosticos` e como deixá-lo aceitar `ibgeInicial`.

- [ ] **Step 2: Atualizar `src/app/admin/projeto/novo/page.tsx`**

Adicionar `searchParams` no signature e filtrar diagnósticos quando `ibge` for fornecido:

```tsx
// src/app/admin/projeto/novo/page.tsx
import { requireAdminClient } from '@/lib/require-admin'
import { getTemplate, TEMPLATE_NAMES } from '@/lib/templates'
import ProjetoFormCompleto from '@/components/projeto/ProjetoFormCompleto'
import { IBGE_RE } from '@/lib/format'

export default async function NovoProjetoPage({
  searchParams,
}: {
  searchParams: Promise<{ ibge?: string; from?: string }>
}) {
  const admin = await requireAdminClient()
  const { ibge: ibgeParam } = await searchParams
  const ibgeFiltro = ibgeParam && IBGE_RE.test(ibgeParam) ? ibgeParam : null

  // Busca diagnósticos disponíveis (rascunho/entregue), filtrando por ibge se fornecido
  let query = admin
    .from('diagnosticos')
    .select('id, municipio_ibge, status, criado_em')
    .in('status', ['rascunho', 'entregue'])
    .order('criado_em', { ascending: false })
    .limit(200)
  if (ibgeFiltro) query = query.eq('municipio_ibge', ibgeFiltro)

  const { data: diagnosticosRaw } = await query
  const diagnosticos = diagnosticosRaw ?? []

  // Resolve nomes/UF dos municípios em uma única query
  const ibges = Array.from(new Set(diagnosticos.map((d) => d.municipio_ibge)))
  let municipiosMap = new Map<string, { nome: string; uf: string }>()
  if (ibges.length > 0) {
    const { data: municipios } = await admin
      .from('municipios_habilitacao')
      .select('ibge, nome, uf')
      .in('ibge', ibges)
    municipiosMap = new Map(
      (municipios ?? []).map((m) => [m.ibge, { nome: m.nome, uf: m.uf }])
    )
  }

  const diagnosticosComNome = diagnosticos.map((d) => ({
    ...d,
    municipio_nome: municipiosMap.get(d.municipio_ibge)?.nome ?? d.municipio_ibge,
    municipio_uf: municipiosMap.get(d.municipio_ibge)?.uf ?? '',
  }))

  const templates = TEMPLATE_NAMES.map((name) => {
    const cfg = getTemplate(name)
    return { name, label: cfg.nome, orgao: cfg.orgao, fundo: cfg.fundo, camposEspecificos: cfg.camposEspecificos }
  })

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-slate-100 mb-1">Novo Projeto</h1>
      <p className="text-slate-400 text-sm mb-8">
        {ibgeFiltro
          ? 'Diagnósticos pré-filtrados para o município selecionado no Radar.'
          : 'Escolha um diagnóstico existente e um template. A geração leva até 90 segundos.'}
      </p>
      <ProjetoFormCompleto diagnosticos={diagnosticosComNome} templates={templates} />
    </div>
  )
}
```

**Observação:** se o `ProjetoFormCompleto.tsx` atual já recebe `diagnosticos` e `templates` com a mesma estrutura, este step é só substituir a página. Se diferir, ajustar para casar com a interface existente do componente — ler o componente primeiro no Step 1.

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit --skipLibCheck 2>&1 | grep 'projeto/novo' | head -5
```

Esperado: sem erros.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/projeto/novo/page.tsx
git commit -m "feat: /admin/projeto/novo accepts ?ibge= filter for Radar deep-link"
```

---

## Verificação Final

- [ ] **Build limpo**

```bash
npm run build 2>&1 | tail -20
```

Esperado: build conclui sem erros.

- [ ] **Todos os testes TS passam**

```bash
npm test 2>&1 | tail -15
```

Esperado: pelo menos 18 (M3) + 16 (radar.test.ts) + diagnostico (não regredidos) passam.

- [ ] **Testes Python passam (sem regressão de scrapers)**

```bash
python3 -m pytest scraper/tests/ -q 2>&1 | tail -10
```

Esperado: todos passam.

- [ ] **Trigger manual do workflow no GitHub (verificação humana)**

1. Push o branch
2. GitHub → Settings → Secrets → Actions → adicionar `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`
3. GitHub → Actions → "Radar — scrape Transferegov" → Run workflow → ufs: `SE`
4. Aguardar conclusão (~10-15 min para SE com ~75 municípios)

- [ ] **Verificar dados em produção**

Via Supabase SQL Editor:

```sql
SELECT count(*) as total,
       count(DISTINCT municipio_ibge) as municipios,
       max(coletado_em) as ultima_coleta
FROM transferencias_federais
WHERE fonte = 'transferegov';
```

Esperado: rows > 0, municipios entre 50-100 (SE).

- [ ] **Acessar `/admin/radar?uf=SE` (verificação humana)**

1. Login como admin
2. Sidebar → "Radar"
3. Selecionar tab "SE"
4. Ver lista ranqueada de municípios com valor em risco

- [ ] **Click no card → ver detalhe → clicar "Gerar Diagnóstico"**

1. Click num município com risco
2. Conferir tabela completa de programas
3. Click "Gerar Diagnóstico →"
4. URL deve ser `/admin/diagnostico/novo?ibge=XXXXXXX&from=radar`
5. Município deve estar pré-selecionado no form

- [ ] **Limpeza final**

```bash
git log --oneline -15
git status
```

Esperado: working tree clean, ~12 commits novos (T1-T11 + verificação manual no fim).

---

## Checklist de critérios de aceitação (do spec)

1. [ ] Trigger manual do workflow popula `transferencias_federais` para AL/SE/PE/BA sem erros
2. [ ] `/admin/radar?uf=SE` exibe lista ranqueada de municípios com valor em risco
3. [ ] Click num card vai pra `/admin/radar/[ibge]` com tabela completa
4. [ ] CTAs levam pros fluxos M2/M3 com query param correto
5. [ ] Empty state e stale-data warning funcionam (validável removendo dados temporariamente em ambiente de teste)
6. [ ] Sidebar tem link "Radar" como primeiro item após "Visão Geral"
7. [ ] Testes TS passam (`radar.test.ts` — 16 cases)
8. [ ] Build limpo, sem regressão nos testes M2/M3/M5/M7 existentes
9. [ ] Cron agendado e secrets configurados (verificação manual no GitHub)

**Próximo módulo:** M1 completo desbloqueia operação real com dado vivo. Próximos candidatos: M4 (Casamento Emenda × OSCIP) ou M6 (Prestação de Contas), além de adicionar Portal Transparência/FNAS/FNS/FNDE como fontes adicionais ao Radar em iterações futuras.
