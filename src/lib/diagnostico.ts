// src/lib/diagnostico.ts
import type { TransferenciaFederal, ProgramaCritico } from '@/types'

const PCT_EXECUCAO_CRITICO = 70
const DIAS_PRAZO_CRITICO = 90

export function identificarProgramasCriticos(
  transferencias: TransferenciaFederal[]
): ProgramaCritico[] {
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)

  return transferencias
    .filter((t) => {
      if (t.percentual_execucao < PCT_EXECUCAO_CRITICO) return true
      if (!t.prazo_limite) return false
      const prazo = new Date(t.prazo_limite)
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
    valorEmRisco: criticos.reduce((s, p) => s + (p.valor_empenhado - p.valor_pago), 0),
  }
}
