import { describe, test, expect } from 'vitest'
import { calcularRiscoBriefing, calcularScoresMunicipios } from '@/lib/briefing'
import type { EmendaParlamentar, MunicipioHabilitacao } from '@/types'

function makeEmenda(overrides: Partial<EmendaParlamentar> = {}): EmendaParlamentar {
  return {
    id: '1',
    parlamentar_id: 'DEP12345',
    parlamentar_nome: 'João Silva',
    tipo: 'RP6',
    parlamentar_tipo: 'individual',
    municipio_ibge: '2803500',
    area_tematica: 'assistencia_social',
    valor_autorizado: 1_000_000,
    valor_empenhado: 800_000,
    valor_executado: 0,
    percentual_execucao: 0,
    prazo_limite: null,
    status_cauc: true,
    exercicio: 2024,
    fonte: 'siga_brasil',
    coletado_em: '2024-01-01T00:00:00Z',
    ...overrides,
  }
}

function makeMunicipio(overrides: Partial<MunicipioHabilitacao> = {}): MunicipioHabilitacao {
  return {
    ibge: '2803500',
    nome: 'Lagarto',
    uf: 'SE',
    populacao: 100_000,
    idh: 0.6,
    cauc_regular: true,
    ultima_verificacao: null,
    programas_habilitados: [],
    programas_bloqueados: [],
    ...overrides,
  }
}

describe('calcularRiscoBriefing', () => {
  test('calcula totais corretamente', () => {
    const emendas = [
      makeEmenda({ valor_autorizado: 1_000_000, valor_executado: 0 }),
      makeEmenda({ id: '2', valor_autorizado: 500_000, valor_executado: 0 }),
    ]
    const { valorTotalEmendas, valorEmRisco, percentualExecutado } = calcularRiscoBriefing(emendas)
    expect(valorTotalEmendas).toBe(1_500_000)
    expect(valorEmRisco).toBe(1_500_000)
    expect(percentualExecutado).toBe(0)
  })

  test('percentual correto quando parcialmente executado', () => {
    const emendas = [makeEmenda({ valor_autorizado: 1_000_000, valor_executado: 400_000 })]
    const { percentualExecutado } = calcularRiscoBriefing(emendas)
    expect(percentualExecutado).toBeCloseTo(40, 1)
  })

  test('emendaVencendoMaisUrgente retorna null sem prazo', () => {
    const emendas = [makeEmenda({ prazo_limite: null })]
    const { emendaVencendoMaisUrgente } = calcularRiscoBriefing(emendas)
    expect(emendaVencendoMaisUrgente).toBeNull()
  })

  test('emendaVencendoMaisUrgente retorna a mais próxima', () => {
    const soon = new Date()
    soon.setDate(soon.getDate() + 30)
    const far = new Date()
    far.setDate(far.getDate() + 120)
    const emendas = [
      makeEmenda({ id: '1', prazo_limite: far.toISOString().split('T')[0], municipio_ibge: '2701209' }),
      makeEmenda({ id: '2', prazo_limite: soon.toISOString().split('T')[0], municipio_ibge: '2803500' }),
    ]
    const { emendaVencendoMaisUrgente } = calcularRiscoBriefing(emendas)
    expect(emendaVencendoMaisUrgente?.municipio).toBe('2803500')
  })

  test('lista vazia retorna zeros', () => {
    const { valorTotalEmendas, valorEmRisco } = calcularRiscoBriefing([])
    expect(valorTotalEmendas).toBe(0)
    expect(valorEmRisco).toBe(0)
  })
})

describe('calcularScoresMunicipios', () => {
  test('retorna top 5 ordenado por score decrescente', () => {
    const emendas = [
      makeEmenda({ municipio_ibge: '2803500', valor_autorizado: 1_000_000, valor_empenhado: 0 }),
      makeEmenda({ id: '2', municipio_ibge: '2701209', valor_autorizado: 500_000, valor_empenhado: 450_000 }),
    ]
    const municipios = [
      makeMunicipio({ ibge: '2803500', idh: 0.55, cauc_regular: true }),
      makeMunicipio({ ibge: '2701209', nome: 'Palmeira dos Índios', idh: 0.65, cauc_regular: true }),
    ]
    const result = calcularScoresMunicipios(emendas, municipios)
    expect(result.length).toBeLessThanOrEqual(5)
    // município com mais disponível (100%) deve ter score maior
    expect(result[0].ibge).toBe('2803500')
    expect(result[0].score_total).toBeGreaterThan(result[1].score_total)
  })

  test('cauc_regular=false reduz score', () => {
    const emendas = [
      makeEmenda({ municipio_ibge: 'A', valor_autorizado: 100, valor_empenhado: 0 }),
      makeEmenda({ id: '2', municipio_ibge: 'B', valor_autorizado: 100, valor_empenhado: 0 }),
    ]
    const municipios = [
      makeMunicipio({ ibge: 'A', cauc_regular: true, idh: 0.6 }),
      makeMunicipio({ ibge: 'B', cauc_regular: false, idh: 0.6 }),
    ]
    const result = calcularScoresMunicipios(emendas, municipios)
    const scoreA = result.find(m => m.ibge === 'A')!.score_total
    const scoreB = result.find(m => m.ibge === 'B')!.score_total
    expect(scoreA).toBeGreaterThan(scoreB)
  })

  test('ignora emendas sem municipio_ibge', () => {
    const emendas = [makeEmenda({ municipio_ibge: null })]
    const result = calcularScoresMunicipios(emendas, [])
    expect(result).toHaveLength(0)
  })

  test('ignora municípios sem dados em municipios_habilitacao', () => {
    const emendas = [makeEmenda({ municipio_ibge: '9999999' })]
    const result = calcularScoresMunicipios(emendas, [])
    expect(result).toHaveLength(0)
  })
})
