// src/lib/briefing.ts
import type { EmendaParlamentar, MunicipioHabilitacao, MunicipioRecomendado } from '@/types'
import { brl } from '@/lib/format'

export interface RiscoBriefing {
  valorTotalEmendas: number
  valorEmRisco: number
  percentualExecutado: number
  emendaVencendoMaisUrgente: { municipio: string; prazo: string; valor: number } | null
}

export function calcularRiscoBriefing(emendas: EmendaParlamentar[]): RiscoBriefing {
  const valorTotal = emendas.reduce((s, e) => s + e.valor_autorizado, 0)
  const valorExecutado = emendas.reduce((s, e) => s + e.valor_executado, 0)
  // emendas_parlamentares tracks valor_autorizado/valor_executado (not valor_empenhado/valor_pago like
  // transferencias_federais). The two data models are intentionally different — do not unify.
  const valorEmRisco = emendas.reduce((s, e) => s + Math.max(0, e.valor_autorizado - e.valor_executado), 0)
  const percentualExecutado = valorTotal > 0 ? (valorExecutado / valorTotal) * 100 : 0

  const hoje = new Date(new Date().toISOString().slice(0, 10) + 'T12:00:00Z')
  const comPrazo = emendas
    .filter((e) => e.prazo_limite && e.municipio_ibge)
    .map((e) => ({
      municipio: e.municipio_ibge!,
      prazo: String(e.prazo_limite),
      valor: Math.max(0, e.valor_autorizado - e.valor_executado),
      dias: Math.floor(
        (new Date(String(e.prazo_limite) + 'T12:00:00Z').getTime() - hoje.getTime()) / 86_400_000
      ),
    }))
    .filter((e) => e.dias >= 0)
    .sort((a, b) => a.dias - b.dias)

  return {
    valorTotalEmendas: valorTotal,
    valorEmRisco,
    percentualExecutado,
    emendaVencendoMaisUrgente: comPrazo[0] ?? null,
  }
}

export function calcularScoresMunicipios(
  emendas: EmendaParlamentar[],
  municipios: MunicipioHabilitacao[]
): MunicipioRecomendado[] {
  const munMap = new Map(municipios.map((m) => [m.ibge, m]))

  // Aggregate emendas by municipio
  const agg = new Map<string, { autorizado: number; empenhado: number; municipio: MunicipioHabilitacao }>()
  for (const e of emendas) {
    if (!e.municipio_ibge) continue
    const municipio = munMap.get(e.municipio_ibge)
    if (!municipio) continue
    const existing = agg.get(e.municipio_ibge)
    if (existing) {
      existing.autorizado += e.valor_autorizado
      existing.empenhado += e.valor_empenhado
    } else {
      agg.set(e.municipio_ibge, {
        autorizado: e.valor_autorizado,
        empenhado: e.valor_empenhado,
        municipio,
      })
    }
  }

  const scored: MunicipioRecomendado[] = []
  for (const [ibge, { autorizado, empenhado, municipio }] of agg) {
    const disponivel = autorizado - empenhado
    const scoreAlocacao = Math.max(0, Math.min(100, autorizado > 0 ? (disponivel / autorizado) * 100 : 0))
    const scoreCapacidade = municipio.cauc_regular ? 100 : 0
    const scoreIdh = Math.max(0, Math.min(100, (1 - (municipio.idh ?? 0.5)) * 100))
    const scoreTotal = Math.round(scoreAlocacao * 0.4 + scoreCapacidade * 0.4 + scoreIdh * 0.2)

    const partes: string[] = []
    if (scoreAlocacao > 40) partes.push(`${brl(disponivel)} disponível`)
    if (municipio.cauc_regular) partes.push('CAUC regular')
    if (municipio.idh && municipio.idh < 0.65) partes.push(`IDH ${municipio.idh.toFixed(3)}`)

    scored.push({
      ibge,
      nome: municipio.nome,
      score_total: scoreTotal,
      justificativa: partes.join(' · ') || 'Município ativo',
    })
  }

  return scored.sort((a, b) => b.score_total - a.score_total).slice(0, 5)
}
