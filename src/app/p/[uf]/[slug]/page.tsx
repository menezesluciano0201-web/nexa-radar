// src/app/p/[uf]/[slug]/page.tsx
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getPortalData } from '@/lib/portal-data'
import { DEFAULT_COR_PRIMARIA } from '@/lib/portal'
import { PortalHeader } from '@/components/portal/PortalHeader'
import { PortalHero } from '@/components/portal/PortalHero'
import { KpiBlock } from '@/components/portal/KpiBlock'
import { MapaExecucao } from '@/components/portal/MapaExecucao'
import { CardsGrid } from '@/components/portal/CardsGrid'
import { PortalFooter } from '@/components/portal/PortalFooter'
import { PortalInteractivity } from '@/components/portal/PortalInteractivity'

export const revalidate = 300

interface PageProps {
  params: Promise<{ uf: string; slug: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { uf, slug } = await params
  const data = await getPortalData(uf, slug)
  if (!data) return { title: 'Portal não encontrado' }

  const primeira = data.publicacoes[0]
  const description = primeira?.descricao?.slice(0, 160)
    ?? `Portal de transparência do município de ${data.municipio.nome}`
  const ogImage = primeira?.fotos?.[0]?.url ?? '/og-default.png'

  return {
    title: `Transparência — Prefeitura de ${data.municipio.nome} - ${data.municipio.uf}`,
    description,
    openGraph: {
      type: 'website',
      title: `Prefeitura de ${data.municipio.nome} - ${data.municipio.uf}`,
      description,
      images: [{ url: ogImage }],
    },
  }
}

export default async function PortalPage({ params }: PageProps) {
  const { uf, slug } = await params
  const data = await getPortalData(uf, slug)
  if (!data) notFound()

  const { municipio, branding, kpis, publicacoes } = data
  const corPrimaria = branding?.cor_primaria ?? DEFAULT_COR_PRIMARIA
  const ultimaAtualizacao = publicacoes[0]?.publicado_em ?? null

  const pins = publicacoes
    .filter(p => p.lat != null && p.lng != null)
    .map(p => ({ id: p.id, titulo: p.titulo, lat: p.lat!, lng: p.lng! }))

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <PortalHeader nome={municipio.nome} uf={municipio.uf} branding={branding} />
      <PortalHero ultimaAtualizacao={ultimaAtualizacao} />
      <KpiBlock kpis={kpis} corPrimaria={corPrimaria} />
      {pins.length > 0 && (
        <section className="px-4 py-6 bg-white">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
              📍 Onde está acontecendo
            </h2>
            <MapaExecucao pins={pins} />
          </div>
        </section>
      )}
      <CardsGrid publicacoes={publicacoes} />
      <PortalFooter nome={municipio.nome} uf={municipio.uf} branding={branding} />
      <PortalInteractivity publicacoes={publicacoes} uf={municipio.uf} slug={municipio.slug} />
    </div>
  )
}
