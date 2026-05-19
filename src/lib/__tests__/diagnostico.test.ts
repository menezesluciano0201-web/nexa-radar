import { describe, test, expect } from 'vitest'
import { identificarProgramasCriticos, calcularRisco } from '@/lib/diagnostico'
import type { TransferenciaFederal } from '@/types'

function makeTransferencia(overrides: Partial<TransferenciaFederal> = {}): TransferenciaFederal {
  return {
    id: '1',
    municipio_ibge: '2803500',
    programa: 'SCFV',
    fundo: 'FNAS',
    valor_empenhado: 100_000,
    valor_liquidado: 60_000,
    valor_pago: 60_000,
    percentual_execucao: 60,
    competencia: '2024-01-01',
    prazo_limite: null,
    fonte: 'portal_transparencia',
    coletado_em: '2024-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('identificarProgramasCriticos', () => {
  test('percentual < 70% é crítico', () => {
    const t = [makeTransferencia({ percentual_execucao: 60 })]
    const criticos = identificarProgramasCriticos(t)
    expect(criticos).toHaveLength(1)
    expect(criticos[0].programa).toBe('SCFV')
  })

  test('percentual >= 70% sem prazo não é crítico', () => {
    const t = [makeTransferencia({ percentual_execucao: 80, prazo_limite: null })]
    expect(identificarProgramasCriticos(t)).toHaveLength(0)
  })

  test('percentual >= 70% com prazo > 90 dias não é crítico', () => {
    const future = new Date()
    future.setDate(future.getDate() + 120)
    const prazo = future.toISOString().split('T')[0]
    const t = [makeTransferencia({ percentual_execucao: 80, prazo_limite: prazo })]
    expect(identificarProgramasCriticos(t)).toHaveLength(0)
  })

  test('percentual >= 70% com prazo <= 90 dias é crítico', () => {
    const soon = new Date()
    soon.setDate(soon.getDate() + 60)
    const prazo = soon.toISOString().split('T')[0]
    const t = [makeTransferencia({ percentual_execucao: 75, prazo_limite: prazo })]
    const criticos = identificarProgramasCriticos(t)
    expect(criticos).toHaveLength(1)
    expect(criticos[0].percentual_execucao).toBe(75)
  })

  test('lista vazia retorna vazia', () => {
    expect(identificarProgramasCriticos([])).toHaveLength(0)
  })

  test('mapeia campos corretamente para ProgramaCritico', () => {
    const t = [makeTransferencia({
      percentual_execucao: 50,
      programa: 'CAPS',
      fundo: 'FNS',
      valor_empenhado: 200_000,
      valor_pago: 100_000,
      prazo_limite: '2025-12-31',
    })]
    const criticos = identificarProgramasCriticos(t)
    expect(criticos[0]).toMatchObject({
      programa: 'CAPS',
      fundo: 'FNS',
      valor_empenhado: 200_000,
      valor_pago: 100_000,
      percentual_execucao: 50,
      prazo_limite: '2025-12-31',
    })
  })
})

describe('calcularRisco', () => {
  test('soma correta de dois programas', () => {
    const criticos = [
      {
        programa: 'SCFV', fundo: 'FNAS',
        valor_empenhado: 100_000, valor_pago: 60_000,
        percentual_execucao: 60, prazo_limite: null,
      },
      {
        programa: 'ATENCAO_BASICA', fundo: 'FNS',
        valor_empenhado: 200_000, valor_pago: 150_000,
        percentual_execucao: 75, prazo_limite: null,
      },
    ]
    const { valorTotalIdentificado, valorEmRisco } = calcularRisco(criticos)
    expect(valorTotalIdentificado).toBe(300_000)
    expect(valorEmRisco).toBe(90_000)
  })

  test('lista vazia retorna zeros', () => {
    const { valorTotalIdentificado, valorEmRisco } = calcularRisco([])
    expect(valorTotalIdentificado).toBe(0)
    expect(valorEmRisco).toBe(0)
  })
})
