// src/lib/diagnostico.ts
import type { TransferenciaFederal, ProgramaCritico } from '@/types'

const PCT_EXECUCAO_CRITICO = 70
const DIAS_PRAZO_CRITICO = 90

export function identificarProgramasCriticos(
  transferencias: TransferenciaFederal[]
): ProgramaCritico[] {
  // Use noon UTC for both dates to avoid TZ/DST off-by-one on boundary days.
  // prazo_limite is date-only ('2025-12-31') which JS parses as UTC midnight;
  // adding T12:00:00Z makes both sides UTC noon for stable day-level comparison.
  const hoje = new Date(new Date().toISOString().slice(0, 10) + 'T12:00:00Z')

  return transferencias
    .filter((t) => {
      if (t.percentual_execucao < PCT_EXECUCAO_CRITICO) return true
      if (!t.prazo_limite) return false
      const prazo = new Date(t.prazo_limite + 'T12:00:00Z')
      const diasRestantes = Math.floor(
        (prazo.getTime() - hoje.getTime()) / 86_400_000
      )
      return diasRestantes <= DIAS_PRAZO_CRITICO
    })
    .map((t) => ({
      programa: t.programa,
      fundo: t.fundo,
      valor_empenhado: t.valor_empenhado,
      valor_pago: t.valor_pago,
      percentual_execucao: t.percentual_execucao,
      prazo_limite: t.prazo_limite,
    }))
}

export function calcularRisco(criticos: ProgramaCritico[]): {
  valorTotalIdentificado: number
  valorEmRisco: number
} {
  return {
    valorTotalIdentificado: criticos.reduce((s, p) => s + p.valor_empenhado, 0),
    valorEmRisco: criticos.reduce((s, p) => s + Math.max(0, p.valor_empenhado - p.valor_pago), 0),
  }
}
