// src/lib/radar.ts
import type { TransferenciaFederal } from '@/types'
import { PCT_EXECUCAO_CRITICO, DIAS_PRAZO_CRITICO } from '@/lib/risco-constants'

export interface MunicipioRiscoAgregado {
  municipio_ibge: string
  municipio_nome: string
  valor_em_risco: number
  num_programas_risco: number
  prazo_mais_proximo: string | null
}

/**
 * "Em risco" = % execução < 70 OU prazo nos próximos 90 dias (inclui vencidos).
 * Mesma definição usada em diagnostico.ts.
 */
export function isEmRisco(
  t: Pick<TransferenciaFederal, 'percentual_execucao' | 'prazo_limite'>,
  hoje?: Date
): boolean {
  const pct = t.percentual_execucao ?? 0
  if (pct < PCT_EXECUCAO_CRITICO) return true
  if (!t.prazo_limite) return false

  const ref = hoje ?? new Date(new Date().toISOString().slice(0, 10) + 'T12:00:00Z')
  const prazo = new Date(t.prazo_limite + 'T12:00:00Z')
  const dias = Math.floor((prazo.getTime() - ref.getTime()) / 86_400_000)
  return dias <= DIAS_PRAZO_CRITICO
}

/**
 * Filtra rows em risco e agrupa por município:
 * - valor_em_risco = soma de max(0, empenhado - pago) dos programas em risco
 * - num_programas_risco = contagem dos programas em risco
 * - prazo_mais_proximo = menor prazo_limite (null se nenhum tem prazo)
 */
export function agruparPorMunicipio(
  rows: Array<TransferenciaFederal & { municipio_nome: string }>,
  hoje?: Date
): MunicipioRiscoAgregado[] {
  const mapa = new Map<string, MunicipioRiscoAgregado>()

  for (const r of rows) {
    if (!isEmRisco(r, hoje)) continue

    const valor = Math.max(0, (r.valor_empenhado ?? 0) - (r.valor_pago ?? 0))
    const atual = mapa.get(r.municipio_ibge)

    if (!atual) {
      mapa.set(r.municipio_ibge, {
        municipio_ibge: r.municipio_ibge,
        municipio_nome: r.municipio_nome,
        valor_em_risco: valor,
        num_programas_risco: 1,
        prazo_mais_proximo: r.prazo_limite,
      })
    } else {
      atual.valor_em_risco += valor
      atual.num_programas_risco += 1
      if (r.prazo_limite) {
        if (!atual.prazo_mais_proximo || r.prazo_limite < atual.prazo_mais_proximo) {
          atual.prazo_mais_proximo = r.prazo_limite
        }
      }
    }
  }

  return Array.from(mapa.values())
}

/**
 * Ordena: valor_em_risco DESC; desempate por prazo_mais_proximo ASC (urgente primeiro);
 * null em prazo vai por último no desempate. Limita ao top N (default 50).
 */
export function rankearAlertas(
  agregados: MunicipioRiscoAgregado[],
  top = 50
): MunicipioRiscoAgregado[] {
  const copia = [...agregados]
  copia.sort((a, b) => {
    if (a.valor_em_risco !== b.valor_em_risco) return b.valor_em_risco - a.valor_em_risco
    // Desempate por prazo: null no fim
    if (a.prazo_mais_proximo === null && b.prazo_mais_proximo === null) return 0
    if (a.prazo_mais_proximo === null) return 1
    if (b.prazo_mais_proximo === null) return -1
    return a.prazo_mais_proximo.localeCompare(b.prazo_mais_proximo)
  })
  return copia.slice(0, top)
}
