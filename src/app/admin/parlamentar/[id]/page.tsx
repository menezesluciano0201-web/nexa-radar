// src/app/admin/parlamentar/[id]/page.tsx
import { notFound } from 'next/navigation'
import { requireAdminClient } from '@/lib/require-admin'
import Link from 'next/link'
import BriefingForm from '@/components/briefing/BriefingForm'
import type { EmendaParlamentar } from '@/types'

function brl(v: number) {
  return `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`
}

function statusBadge(status: string) {
  switch (status) {
    case 'gerando':   return 'bg-yellow-900/50 text-yellow-300 border-yellow-800'
    case 'rascunho':  return 'bg-blue-900/50 text-blue-300 border-blue-800'
    case 'entregue':  return 'bg-green-900/50 text-green-300 border-green-800'
    case 'erro':      return 'bg-red-900/50 text-red-300 border-red-800'
    default:          return 'bg-slate-700 text-slate-300 border-slate-600'
  }
}

export default async function AdminParlamentarDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  let parlamentarId: string
  try {
    parlamentarId = decodeURIComponent(id)
  } catch {
    notFound()
    return // unreachable but satisfies TS control flow
  }
  const admin = await requireAdminClient()

  const [{ data: emendas }, { data: briefings }] = await Promise.all([
    admin
      .from('emendas_parlamentares')
      .select('parlamentar_nome, valor_autorizado, valor_empenhado, valor_executado, area_tematica, exercicio, municipio_ibge')
      .eq('parlamentar_id', parlamentarId)
      .order('exercicio', { ascending: false })
      .limit(5000),
    admin
      .from('briefings')
      .select('id, status, valor_total_emendas, valor_em_risco, criado_em')
      .eq('parlamentar_id', parlamentarId)
      .order('criado_em', { ascending: false })
      .limit(100),
  ])

  if (!emendas?.length) notFound()

  const parlamentarNome = (emendas as EmendaParlamentar[])[0].parlamentar_nome ?? parlamentarId
  const totalAutorizado = emendas.reduce((s, e) => s + e.valor_autorizado, 0)
  const totalExecutado = emendas.reduce((s, e) => s + e.valor_executado, 0)
  const percentual = totalAutorizado > 0 ? (totalExecutado / totalAutorizado) * 100 : 0

  return (
    <div className="max-w-3xl space-y-8">
      {/* Cabeçalho */}
      <div>
        <h1 className="text-2xl font-bold text-slate-100">{parlamentarNome}</h1>
        <p className="text-slate-400 text-xs mt-1 font-mono">{parlamentarId}</p>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-md bg-slate-800 px-4 py-3">
          <p className="text-xs text-slate-500 mb-1">Total autorizado</p>
          <p className="text-lg font-bold text-slate-100">{brl(totalAutorizado)}</p>
        </div>
        <div className="rounded-md bg-slate-800 px-4 py-3">
          <p className="text-xs text-slate-500 mb-1">Executado</p>
          <p className="text-lg font-bold text-slate-100">{percentual.toFixed(1)}%</p>
        </div>
        <div className="rounded-md bg-slate-800 px-4 py-3">
          <p className="text-xs text-slate-500 mb-1">Em risco</p>
          <p className="text-lg font-bold text-risk-high">{brl(Math.max(0, totalAutorizado - totalExecutado))}</p>
        </div>
      </div>

      {/* Gerar novo briefing */}
      <div>
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">
          Novo Briefing
        </h2>
        <BriefingForm parlamentarId={parlamentarId} />
      </div>

      {/* Histórico de briefings */}
      {briefings && briefings.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">
            Histórico de Briefings
          </h2>
          <div className="space-y-2">
            {briefings.map((b) => (
              <Link
                key={b.id}
                href={`/admin/briefing/${b.id}`}
                className="flex items-center justify-between rounded-md bg-slate-800/50 border border-slate-800 px-4 py-3 hover:border-slate-700 transition-colors"
              >
                <div>
                  <p className="text-sm text-slate-300">
                    {new Date(b.criado_em).toLocaleDateString('pt-BR')}
                  </p>
                  {b.valor_em_risco > 0 && (
                    <p className="text-xs text-slate-500 mt-0.5">
                      {brl(b.valor_em_risco)} em risco
                    </p>
                  )}
                </div>
                <span className={`text-xs px-2 py-1 rounded-full border ${statusBadge(b.status)}`}>
                  {b.status}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
