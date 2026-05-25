// src/lib/upload.ts
const MAX_BYTES = 5 * 1024 * 1024  // 5MB
const RASTER_MIMES = ['image/png', 'image/jpeg', 'image/webp']
const VECTOR_MIMES = ['image/svg+xml']

export type TipoUpload = 'logo' | 'brasao' | 'publicacao'

export interface ValidationResult {
  valid: boolean
  erro?: string
}

export function validarFotoUpload(file: File, tipo: TipoUpload): ValidationResult {
  if (file.size > MAX_BYTES) {
    return { valid: false, erro: `Arquivo excede o limite de 5MB (atual: ${(file.size / 1024 / 1024).toFixed(1)}MB)` }
  }

  const aceitos = tipo === 'publicacao' ? RASTER_MIMES : [...RASTER_MIMES, ...VECTOR_MIMES]

  if (!aceitos.includes(file.type)) {
    if (file.type === 'image/svg+xml' && tipo === 'publicacao') {
      return { valid: false, erro: 'SVG não permitido em fotos de publicação (somente PNG/JPEG/WEBP)' }
    }
    return { valid: false, erro: `Tipo de arquivo não permitido: ${file.type}` }
  }

  return { valid: true }
}
