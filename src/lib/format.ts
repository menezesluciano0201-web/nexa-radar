// src/lib/format.ts
export function brl(v: number, fractionDigits = 0) {
  return `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: fractionDigits })}`
}
