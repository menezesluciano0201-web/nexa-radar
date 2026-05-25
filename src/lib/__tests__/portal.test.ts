import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import { ordenarKpis, gerarUrlShare } from '@/lib/portal'
import type { KpiPortal } from '@/types'

function kpi(ordem: number, label: string, valor: string): KpiPortal {
  return { id: `k-${ordem}`, municipio_ibge: '2803500', ordem, label, valor, sufixo: null }
}

describe('ordenarKpis', () => {
  test('retorna 4 slots — preenche faltantes com null', () => {
    const result = ordenarKpis([kpi(2, 'B', '20'), kpi(4, 'D', '40')])
    expect(result).toHaveLength(4)
    expect(result[0]).toBeNull()
    expect(result[1]?.label).toBe('B')
    expect(result[2]).toBeNull()
    expect(result[3]?.label).toBe('D')
  })

  test('ordena por ordem ascendente mesmo se vier embaralhado', () => {
    const result = ordenarKpis([kpi(3, 'C', '30'), kpi(1, 'A', '10')])
    expect(result[0]?.label).toBe('A')
    expect(result[2]?.label).toBe('C')
  })

  test('lista vazia retorna 4 nulls', () => {
    expect(ordenarKpis([])).toEqual([null, null, null, null])
  })

  test('ignora kpis com ordem fora de 1-4', () => {
    const result = ordenarKpis([kpi(0, 'X', '0'), kpi(5, 'Y', '50'), kpi(2, 'B', '20')])
    expect(result[1]?.label).toBe('B')
    expect(result.filter(x => x !== null)).toHaveLength(1)
  })
})

describe('gerarUrlShare', () => {
  const originalEnv = process.env.NEXT_PUBLIC_SITE_URL

  beforeEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://nexaradar.com.br'
  })

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.NEXT_PUBLIC_SITE_URL
    else process.env.NEXT_PUBLIC_SITE_URL = originalEnv
  })

  test('URL completa sem pubId', () => {
    expect(gerarUrlShare('se', 'lagarto')).toBe('https://nexaradar.com.br/p/se/lagarto')
  })

  test('URL com hash de publicação', () => {
    expect(gerarUrlShare('se', 'lagarto', 'abc-123')).toBe('https://nexaradar.com.br/p/se/lagarto#pub-abc-123')
  })

  test('fallback localhost quando env não setada', () => {
    delete process.env.NEXT_PUBLIC_SITE_URL
    expect(gerarUrlShare('se', 'lagarto')).toBe('http://localhost:3000/p/se/lagarto')
  })

  test('UF é minúscula no path', () => {
    expect(gerarUrlShare('SE', 'lagarto')).toBe('https://nexaradar.com.br/p/se/lagarto')
  })
})
