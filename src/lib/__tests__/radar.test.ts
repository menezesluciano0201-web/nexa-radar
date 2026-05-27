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
