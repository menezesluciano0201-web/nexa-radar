// src/app/admin/portal/[ibge]/page.tsx
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { requireAdminClient } from '@/lib/require-admin'
import { IBGE_RE } from '@/lib/format'
import { portalUrl } from '@/lib/portal'
import { IdentidadeForm } from './IdentidadeForm'
import { KpisForm } from './KpisForm'
import { togglePublicacao } from './actions'
import type { MunicipioBranding, KpiPortal, PublicacaoPortal } from '@/types'

type Aba = 'identidade' | 'kpis' | 'publicacoes'

interface PageProps {
  params: Promise<{ ibge: string }>
  searchParams: Promise<{ aba?: string; ok?: string; error?: string }>
}

export default async function PortalMunicipioPage({ params, searchParams }: PageProps) {
  const { ibge } = await params
  const { aba: abaParam, ok, error } = await searchParams

  if (!IBGE_RE.test(ibge)) notFound()
  const aba: Aba = ['identidade', 'kpis', 'publicacoes'].includes(abaParam ?? '')
    ? abaParam as Aba
    : 'identidade'

  const admin = await requireAdminClient()

  const [muniRes, brandRes, kpiRes, pubRes] = await Promise.all([
    admin.from('municipios_habilitacao').select('nome, uf, slug').eq('ibge', ibge).single(),
    admin.from('municipios_branding').select('*').eq('municipio_ibge', ibge).maybeSingle(),
    admin.from('municipios_kpi_portal').select('*').eq('municipio_ibge', ibge).order('ordem'),
    admin.from('publicacoes_portal').select('*').eq('municipio_ibge', ibge).order('publicado_em', { ascending: false }),
  ])

  if (!muniRes.data) notFound()
  const municipio = muniRes.data
  const branding = (brandRes.data ?? null) as MunicipioBranding | null
  const kpis = (kpiRes.data ?? []) as KpiPortal[]
  const publicacoes = (pubRes.data ?? []) as PublicacaoPortal[]

  const urlPortal = portalUrl(municipio.uf, municipio.slug)

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/admin/portal" className="text-xs text-slate-400 hover:text-slate-300">
            ← Portais
          </Link>
          <h1 className="text-xl font-bold text-slate-100">
            {municipio.nome} — {municipio.uf}
          </h1>
        </div>
        <a
          href={urlPortal}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-nexa-400 hover:text-nexa-300"
        >
          Visualizar portal público →
        </a>
      </div>

      {ok && (
        <div className="rounded-md bg-green-900/30 border border-green-700 px-4 py-2 text-sm text-green-300">
          Alterações salvas.
        </div>
      )}
      {error && (
        <div className="rounded-md bg-red-900/30 border border-red-700 px-4 py-2 text-sm text-red-300">
          Erro: {error}
        </div>
      )}

      <div className="border-b border-slate-800 flex gap-2">
        {(['identidade', 'kpis', 'publicacoes'] as Aba[]).map(a => (
          <Link
            key={a}
            href={`/admin/portal/${ibge}?aba=${a}`}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              aba === a
                ? 'border-nexa-500 text-nexa-400'
                : 'border-transparent text-slate-400 hover:text-slate-300'
            }`}
          >
            {a === 'identidade' ? 'Identidade' : a === 'kpis' ? 'KPIs' : 'Publicações'}
          </Link>
        ))}
      </div>

      {aba === 'identidade' && <IdentidadeForm ibge={ibge} branding={branding} />}
      {aba === 'kpis' && <KpisForm ibge={ibge} kpis={kpis} />}
      {aba === 'publicacoes' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Link
              href={`/admin/portal/${ibge}/publicacao/nova`}
              className="rounded-md bg-nexa-600 px-4 py-2 text-sm font-semibold text-white hover:bg-nexa-500"
            >
              + Nova publicação
            </Link>
          </div>
          <div className="rounded-md border border-slate-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-800">
                <tr>
                  {['Título', 'Data', 'Ativo', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {publicacoes.map(p => (
                  <tr key={p.id} className="hover:bg-slate-800/50">
                    <td className="px-4 py-3 text-slate-300">{p.titulo}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      {p.data_evento ? new Date(p.data_evento).toLocaleDateString('pt-BR') : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <form action={togglePublicacao}>
                        <input type="hidden" name="id" value={p.id} />
                        <input type="hidden" name="ibge" value={ibge} />
                        <input type="hidden" name="ativo" value={String(p.ativo)} />
                        <button
                          type="submit"
                          className={`rounded px-2 py-0.5 text-xs font-semibold ${
                            p.ativo ? 'bg-green-900 text-green-300' : 'bg-slate-700 text-slate-300'
                          }`}
                        >
                          {p.ativo ? 'Ativo' : 'Inativo'}
                        </button>
                      </form>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/portal/${ibge}/publicacao/${p.id}`}
                        className="text-nexa-400 hover:text-nexa-300 text-sm"
                      >
                        Editar →
                      </Link>
                    </td>
                  </tr>
                ))}
                {publicacoes.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-slate-500 text-sm">
                      Nenhuma publicação ainda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
