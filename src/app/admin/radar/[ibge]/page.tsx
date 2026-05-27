// src/app/admin/radar/[ibge]/page.tsx
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { brl, IBGE_RE } from '@/lib/format'
import { isEmRisco } from '@/lib/radar'
import { getDetalheRadar } from '@/lib/radar-data'

export default async function RadarDetalhePage({
  params,
}: {
  params: Promise<{ ibge: string }>
}) {
  const { ibge } = await params
  if (!IBGE_RE.test(ibge)) notFound()

  const detalhe = await getDetalheRadar(ibge)
  if (!detalhe) notFound()

  // Ordena: risco primeiro, depois por valor empenhado desc
  const programasOrdenados = [...detalhe.programas].sort((a, b) => {
    const aRisco = isEmRisco(a) ? 1 : 0
    const bRisco = isEmRisco(b) ? 1 : 0
    if (aRisco !== bRisco) return bRisco - aRisco
    return (b.valor_empenhado ?? 0) - (a.valor_empenhado ?? 0)
  })

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            href={`/admin/radar?uf=${detalhe.uf}`}
            className="text-xs text-slate-500 hover:text-slate-300"
          >
            ← Voltar para {detalhe.uf}
          </Link>
          <h1 className="text-xl font-bold text-slate-100 mt-1">
            {detalhe.municipio_nome} - {detalhe.uf}
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            {brl(detalhe.valor_em_risco)} em risco · {detalhe.programas.length} programas analisados
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Empenhado total', valor: brl(detalhe.total_empenhado) },
          { label: 'Pago total', valor: brl(detalhe.total_pago) },
          { label: 'Execução média', valor: `${detalhe.pct_execucao_medio.toFixed(1)}%` },
        ].map((item) => (
          <div key={item.label} className="rounded-md bg-slate-800 p-4">
            <p className="text-xs text-slate-400">{item.label}</p>
            <p className="text-lg font-semibold text-slate-100 mt-1">{item.valor}</p>
          </div>
        ))}
      </div>

      {/* CTAs */}
      <div className="flex flex-wrap gap-3">
        <Link
          href={`/admin/diagnostico/novo?ibge=${detalhe.municipio_ibge}&from=radar`}
          className="rounded-md bg-nexa-600 px-4 py-2 text-sm font-semibold text-white hover:bg-nexa-500"
        >
          Gerar Diagnóstico →
        </Link>
        {detalhe.tem_diagnostico ? (
          <Link
            href={`/admin/projeto/novo?ibge=${detalhe.municipio_ibge}&from=radar`}
            className="rounded-md bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-600"
          >
            Gerar Projeto →
          </Link>
        ) : (
          <button
            disabled
            title="Gere um diagnóstico primeiro"
            className="rounded-md bg-slate-700 px-4 py-2 text-sm font-semibold text-slate-500 cursor-not-allowed"
          >
            Gerar Projeto (sem diagnóstico)
          </button>
        )}
      </div>

      {/* Programas */}
      {programasOrdenados.length === 0 ? (
        <div className="rounded-md bg-slate-800/50 border border-slate-700 p-8 text-center text-slate-400 text-sm">
          Nenhuma transferência registrada para este município ainda.
        </div>
      ) : (
        <div className="rounded-md border border-slate-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-800">
              <tr>
                {['Programa', 'Fundo', 'Empenhado', 'Pago', '%', 'Prazo', ''].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {programasOrdenados.map((p) => {
                const risco = isEmRisco(p)
                return (
                  <tr key={p.id} className="hover:bg-slate-800/50">
                    <td className="px-4 py-3 text-slate-300">{p.programa}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{p.fundo}</td>
                    <td className="px-4 py-3 text-slate-300 font-mono text-xs">{brl(p.valor_empenhado)}</td>
                    <td className="px-4 py-3 text-slate-300 font-mono text-xs">{brl(p.valor_pago)}</td>
                    <td className="px-4 py-3 text-slate-300 text-xs">{(p.percentual_execucao ?? 0).toFixed(0)}%</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      {p.prazo_limite ? new Date(p.prazo_limite).toLocaleDateString('pt-BR') : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {risco && (
                        <span className="rounded bg-yellow-900 text-yellow-300 px-2 py-0.5 text-xs font-semibold">
                          ⚠ risco
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
