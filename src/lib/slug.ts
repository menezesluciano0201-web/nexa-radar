// src/lib/slug.ts
// Espelha a lógica do backfill SQL em 027_portal_transparencia.sql.
// Usado no admin ao habilitar novo município. Mantém slug pré-existente
// no banco — só recalcula se o admin pedir explicitamente.

const ACCENT_MAP: Record<string, string> = {
  á: 'a', à: 'a', â: 'a', ã: 'a', ä: 'a',
  é: 'e', è: 'e', ê: 'e', ë: 'e',
  í: 'i', ì: 'i', î: 'i', ï: 'i',
  ó: 'o', ò: 'o', ô: 'o', õ: 'o', ö: 'o',
  ú: 'u', ù: 'u', û: 'u', ü: 'u',
  ç: 'c', ñ: 'n',
}

export function slugifyMunicipio(nome: string, ibgeFallback: string): string {
  const lower = nome.toLowerCase()
  const noAccents = lower.replace(/[áàâãäéèêëíìîïóòôõöúùûüçñ]/g, (c) => ACCENT_MAP[c] ?? c)
  const slug = noAccents.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return slug || ibgeFallback
}
