// src/lib/portal-data.ts
import 'server-only'
import { cache } from 'react'
import { createAdminClient } from '@/lib/supabase/admin'
import type { MunicipioBranding, KpiPortal, PublicacaoPortal } from '@/types'

export interface MunicipioInfo {
  ibge: string
  nome: string
  uf: string
  slug: string
}

export interface PortalData {
  municipio: MunicipioInfo
  branding: MunicipioBranding | null
  kpis: KpiPortal[]
  publicacoes: PublicacaoPortal[]
}

// React cache() deduplica entre generateMetadata e a page render
// dentro do mesmo request. Combinado com revalidate=300 (ISR), o fetch
// real do banco roda 1x a cada 5min por (uf, slug).
export const getPortalData = cache(async (uf: string, slug: string): Promise<PortalData | null> => {
  const supabase = createAdminClient()

  const { data: municipio, error: muniErr } = await supabase
    .from('municipios_habilitacao')
    .select('ibge, nome, uf, slug')
    .eq('uf', uf.toUpperCase())
    .eq('slug', slug)
    .single()

  if (muniErr || !municipio) return null

  const [brandingRes, kpisRes, pubsRes] = await Promise.all([
    supabase
      .from('municipios_branding')
      .select('*')
      .eq('municipio_ibge', municipio.ibge)
      .maybeSingle(),
    supabase
      .from('municipios_kpi_portal')
      .select('*')
      .eq('municipio_ibge', municipio.ibge)
      .order('ordem'),
    supabase
      .from('publicacoes_portal')
      .select('*')
      .eq('municipio_ibge', municipio.ibge)
      .eq('ativo', true)
      .order('publicado_em', { ascending: false })
      .limit(60),
  ])

  return {
    municipio: municipio as MunicipioInfo,
    branding: brandingRes.data as MunicipioBranding | null,
    kpis: (kpisRes.data ?? []) as KpiPortal[],
    publicacoes: (pubsRes.data ?? []) as PublicacaoPortal[],
  }
})
