// src/lib/radar-data.ts
import 'server-only'
import { cache } from 'react'
import { requireAdminClient } from '@/lib/require-admin'
import { agruparPorMunicipio, rankearAlertas, type MunicipioRiscoAgregado } from '@/lib/radar'
import type { TransferenciaFederal } from '@/types'

const UFS_RADAR = ['AL', 'SE', 'PE', 'BA'] as const
export type UfRadar = (typeof UFS_RADAR)[number]

export function isUfRadar(uf: string): uf is UfRadar {
  return (UFS_RADAR as readonly string[]).includes(uf)
}

export interface FeedRadar {
  uf: UfRadar
  alertas: MunicipioRiscoAgregado[]
  total_municipios_analisados: number
  ultima_coleta: string | null   // ISO timestamp ou null
  stale: boolean                  // true se ultima_coleta > 14 dias atrás
}

const STALE_DAYS = 14

// React cache(): dedupe entre múltiplas calls no mesmo request.
export const getFeedRadar = cache(async (uf: UfRadar): Promise<FeedRadar> => {
  const admin = await requireAdminClient()

  // 1. Resolve municípios da UF (precisamos do nome para o feed)
  const { data: municipios } = await admin
    .from('municipios_habilitacao')
    .select('ibge, nome')
    .eq('uf', uf)
    .limit(2000)

  const mapaNomes = new Map<string, string>((municipios ?? []).map((m) => [m.ibge, m.nome]))

  if (mapaNomes.size === 0) {
    return { uf, alertas: [], total_municipios_analisados: 0, ultima_coleta: null, stale: false }
  }

  // 2. Pega todas as transferências dos municípios da UF
  const { data: rows } = await admin
    .from('transferencias_federais')
    .select('municipio_ibge, programa, fundo, valor_empenhado, valor_liquidado, valor_pago, percentual_execucao, prazo_limite, competencia, fonte, coletado_em, id')
    .in('municipio_ibge', Array.from(mapaNomes.keys()))
    .limit(10_000)

  const enriquecido = (rows ?? []).map((r) => ({
    ...(r as TransferenciaFederal),
    municipio_nome: mapaNomes.get(r.municipio_ibge) ?? r.municipio_ibge,
  }))

  const agregados = agruparPorMunicipio(enriquecido)
  const alertas = rankearAlertas(agregados, 50)

  // 3. Última coleta = max(coletado_em) entre todas as rows
  let ultima: string | null = null
  for (const r of enriquecido) {
    if (!ultima || r.coletado_em > ultima) ultima = r.coletado_em
  }

  const stale = ultima ? Date.now() - new Date(ultima).getTime() > STALE_DAYS * 86_400_000 : false

  return {
    uf,
    alertas,
    total_municipios_analisados: mapaNomes.size,
    ultima_coleta: ultima,
    stale,
  }
})

export interface DetalheRadar {
  municipio_ibge: string
  municipio_nome: string
  uf: string
  programas: TransferenciaFederal[]
  total_empenhado: number
  total_pago: number
  pct_execucao_medio: number
  valor_em_risco: number
  tem_diagnostico: boolean
}

export const getDetalheRadar = cache(async (ibge: string): Promise<DetalheRadar | null> => {
  const admin = await requireAdminClient()

  const [
    { data: municipio },
    { data: programas },
    { data: diag },
  ] = await Promise.all([
    admin.from('municipios_habilitacao').select('ibge, nome, uf').eq('ibge', ibge).single(),
    admin.from('transferencias_federais').select('*').eq('municipio_ibge', ibge),
    admin.from('diagnosticos').select('id').eq('municipio_ibge', ibge).in('status', ['rascunho', 'entregue']).limit(1),
  ])

  if (!municipio) return null

  const lista = (programas ?? []) as TransferenciaFederal[]
  const total_empenhado = lista.reduce((s, p) => s + (p.valor_empenhado ?? 0), 0)
  const total_pago = lista.reduce((s, p) => s + (p.valor_pago ?? 0), 0)
  const pct_execucao_medio =
    lista.length > 0
      ? lista.reduce((s, p) => s + (p.percentual_execucao ?? 0), 0) / lista.length
      : 0
  const valor_em_risco = lista.reduce(
    (s, p) => s + Math.max(0, (p.valor_empenhado ?? 0) - (p.valor_pago ?? 0)),
    0
  )

  return {
    municipio_ibge: municipio.ibge,
    municipio_nome: municipio.nome,
    uf: municipio.uf,
    programas: lista,
    total_empenhado,
    total_pago,
    pct_execucao_medio,
    valor_em_risco,
    tem_diagnostico: (diag ?? []).length > 0,
  }
})
