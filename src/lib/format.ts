// src/lib/format.ts
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const IBGE_RE = /^\d{7}$/

export function brl(v: number, fractionDigits = 0) {
  return `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: fractionDigits })}`
}
