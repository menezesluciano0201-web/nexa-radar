// src/lib/diagnostico.ts
import type { TransferenciaFederal, ProgramaCritico } from '@/types'

const PCT_EXECUCAO_CRITICO = 70
const DIAS_PRAZO_CRITICO = 90
const MAX_PROGRAMAS_CRITICOS = 20  // cap sent to Claude to avoid prompt overflow

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
      // Includes overdue items (diasRestantes < 0) — past deadlines still need remediation action.
      // briefing.ts filters dias >= 0 for the "most urgent" display; this is intentionally different.
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
    // Sort by risk value descending, keep top N to avoid Claude prompt overflow
    .sort((a, b) => Math.max(0, b.valor_empenhado - b.valor_pago) - Math.max(0, a.valor_empenhado - a.valor_pago))
    .slice(0, MAX_PROGRAMAS_CRITICOS)
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
