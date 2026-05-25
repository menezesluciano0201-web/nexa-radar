import { describe, test, expect } from 'vitest'
import { validarFotoUpload } from '@/lib/upload'

function file(name: string, type: string, sizeKb: number): File {
  const blob = new Blob(['x'.repeat(sizeKb * 1024)], { type })
  return new File([blob], name, { type })
}

describe('validarFotoUpload', () => {
  test('PNG dentro do limite válido para publicação', () => {
    expect(validarFotoUpload(file('a.png', 'image/png', 1000), 'publicacao').valid).toBe(true)
  })

  test('JPEG dentro do limite válido para publicação', () => {
    expect(validarFotoUpload(file('a.jpg', 'image/jpeg', 1000), 'publicacao').valid).toBe(true)
  })

  test('WEBP dentro do limite válido para publicação', () => {
    expect(validarFotoUpload(file('a.webp', 'image/webp', 1000), 'publicacao').valid).toBe(true)
  })

  test('SVG REJEITADO em publicacao', () => {
    const r = validarFotoUpload(file('a.svg', 'image/svg+xml', 100), 'publicacao')
    expect(r.valid).toBe(false)
    expect(r.erro).toMatch(/SVG não permitido/)
  })

  test('SVG aceito em logo', () => {
    expect(validarFotoUpload(file('a.svg', 'image/svg+xml', 100), 'logo').valid).toBe(true)
  })

  test('SVG aceito em brasão', () => {
    expect(validarFotoUpload(file('a.svg', 'image/svg+xml', 100), 'brasao').valid).toBe(true)
  })

  test('rejeita acima de 5MB', () => {
    const r = validarFotoUpload(file('a.png', 'image/png', 6000), 'publicacao')
    expect(r.valid).toBe(false)
    expect(r.erro).toMatch(/5MB/)
  })

  test('rejeita mime type não permitido', () => {
    const r = validarFotoUpload(file('a.pdf', 'application/pdf', 100), 'publicacao')
    expect(r.valid).toBe(false)
    expect(r.erro).toMatch(/tipo/i)
  })
})
