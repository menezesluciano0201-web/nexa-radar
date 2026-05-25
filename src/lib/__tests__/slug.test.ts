import { describe, test, expect } from 'vitest'
import { slugifyMunicipio } from '@/lib/slug'

describe('slugifyMunicipio', () => {
  test('lowercase simples', () => {
    expect(slugifyMunicipio('Lagarto', '2803500')).toBe('lagarto')
  })

  test('remove acentos comuns', () => {
    expect(slugifyMunicipio('São Paulo', '3550308')).toBe('sao-paulo')
    expect(slugifyMunicipio('Cuité', '2505907')).toBe('cuite')
    expect(slugifyMunicipio('Tatuí', '3553609')).toBe('tatui')
    expect(slugifyMunicipio('Iguaçu', '0000000')).toBe('iguacu')
    expect(slugifyMunicipio('Ñunoa', '0000000')).toBe('nunoa')
  })

  test('espaços viram hífen único', () => {
    expect(slugifyMunicipio('Rio de Janeiro', '3304557')).toBe('rio-de-janeiro')
    expect(slugifyMunicipio('São José dos Campos', '3549904')).toBe('sao-jose-dos-campos')
  })

  test('caracteres especiais viram hífen', () => {
    expect(slugifyMunicipio("D'Ávila", '0000000')).toBe('d-avila')
    expect(slugifyMunicipio('Senador Sá', '0000000')).toBe('senador-sa')
  })

  test('trim de hífens nas bordas', () => {
    expect(slugifyMunicipio('-Lagarto-', '2803500')).toBe('lagarto')
  })

  test('fallback ibge quando string sanitiza vazio', () => {
    expect(slugifyMunicipio('', '2803500')).toBe('2803500')
    expect(slugifyMunicipio('---', '2803500')).toBe('2803500')
    expect(slugifyMunicipio('!@#$', '2803500')).toBe('2803500')
  })
})
