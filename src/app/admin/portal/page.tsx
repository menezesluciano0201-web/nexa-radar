// src/app/admin/portal/page.tsx
import Link from 'next/link'
import { requireAdminClient } from '@/lib/require-admin'
import { habilitarMunicipio } from './actions'

type Row = {
  municipio_ibge: string
  atualizado_em: string
  municipios_habilitacao: { nome: string; uf: string; slug: string } | null
}

export default async function PortalListPage() {
  const admin = await requireAdminClient()

  const { data: portais } = await admin
    .from('municipios_branding')
    .select('municipio_ibge, atualizado_em, municipios_habilitacao!inner(nome, uf, slug)')
    .order('atualizado_em', { ascending: false })

  const rows = ((portais ?? []) as unknown as Row[])

  // Contagem de publicações ativas por município
  const ibges = rows.map(r => r.municipio_ibge)
  const counts: Record<string, number> = {}
  if (ibges.length > 0) {
    const { data: pubs } = await admin
      .from('publicacoes_portal')
      .select('municipio_ibge')
      .in('municipio_ibge', ibges)
      .eq('ativo', true)
    for (const p of pubs ?? []) {
      counts[p.municipio_ibge] = (counts[p.municipio_ibge] ?? 0) + 1
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-100">Portais Municipais</h1>
        <details className="relative">
          <summary className="rounded-md bg-nexa-600 px-4 py-2 text-sm font-semibold text-white hover:bg-nexa-500 cursor-pointer list-none">
            + Habilitar novo município
          </summary>
          <form
            action={habilitarMunicipio}
            className="absolute right-0 mt-2 w-72 rounded-md bg-slate-800 border border-slate-700 p-4 space-y-3 z-10"
          >
            <label className="block text-xs text-slate-400">Código IBGE (7 dígitos)</label>
            <input
              name="ibge"
              type="text"
              inputMode="numeric"
              pattern="\d{7}"
              required
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
              placeholder="2803500"
            />
            <button
              type="submit"
              className="w-full rounded-md bg-nexa-600 px-3 py-2 text-sm font-semibold text-white hover:bg-nexa-500"
            >
              Habilitar
            </button>
          </form>
        </details>
      </div>

      <div className="rounded-md border border-slate-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-800">
            <tr>
              {['Município', 'Publicações ativas', 'Última atualização', ''].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {rows.map(r => {
              const m = r.municipios_habilitacao
              const isSlugFallback = m && /^\d+$/.test(m.slug)
              return (
                <tr key={r.municipio_ibge} className="hover:bg-slate-800/50">
                  <td className="px-4 py-3 text-slate-300">
                    {m?.nome ?? r.municipio_ibge} — {m?.uf}
                    {isSlugFallback && (
                      <span
                        className="ml-2 inline-block rounded bg-yellow-900/40 text-yellow-300 text-xs px-2 py-0.5"
                        title="URL pública é numérica — corrigir `nome` em municipios_habilitacao para gerar slug legível"
                      >
                        slug fallback
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-300">{counts[r.municipio_ibge] ?? 0}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">
                    {new Date(r.atualizado_em).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/admin/portal/${r.municipio_ibge}`} className="text-nexa-400 hover:text-nexa-300 text-sm">
                      Configurar →
                    </Link>
                  </td>
                </tr>
              )
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-500 text-sm">
                  Nenhum município habilitado. Use o botão acima para começar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
