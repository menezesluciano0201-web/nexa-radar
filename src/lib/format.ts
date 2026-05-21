// src/lib/format.ts
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function brl(v: number, fractionDigits = 0) {
  return `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: fractionDigits })}`
}
