// src/app/admin/briefing/[id]/page.tsx
import { notFound } from 'next/navigation'
import { requireAdminClient } from '@/lib/require-admin'
import { marcarBriefingEntregue } from './actions'
import type { MunicipioRecomendado } from '@/types'

function statusColor(status: string) {
  switch (status) {
    case 'gerando':  return 'text-yellow-400'
    case 'rascunho': return 'text-blue-400'
    case 'entregue': return 'text-green-400'
    case 'erro':     return 'text-red-400'
    default:         return 'text-slate-400'
  }
}

function brl(v: number) {
  return `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`
}

export default async function AdminBriefingPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const admin = await requireAdminClient()

  const { data: briefing } = await admin
    .from('briefings')
    .select('id,status,parlamentar_id,valor_total_emendas,valor_em_risco,municipios_recomendados,texto_ia,pdf_url,criado_em')
    .eq('id', id)
    .single()

  if (!briefing) notFound()

  // Signed URL para PDF
  let pdfSignedUrl: string | null = null
  if (briefing.pdf_url) {
    const { data, error: storageErr } = await admin.storage
      .from('relatorios')
      .createSignedUrl(briefing.pdf_url, 3600)
    if (storageErr) console.error('[admin/briefing/%s] signed URL failed: %s', id, storageErr.message)
    pdfSignedUrl = data?.signedUrl ?? null
  }

  const municipios = (briefing.municipios_recomendados ?? []) as MunicipioRecomendado[]

  return (
    <div className="max-w-3xl space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Briefing Parlamentar</h1>
          <p className="text-slate-400 text-sm mt-1">
            <span className="font-mono text-xs">{briefing.parlamentar_id}</span>
            {' · '}
            Status: <span className={statusColor(briefing.status)}>{briefing.status}</span>
            {' · '}
            {new Date(briefing.criado_em).toLocaleDateString('pt-BR')}
          </p>
        </div>
        {briefing.status === 'rascunho' && (
          <form action={marcarBriefingEntregue}>
            <input type="hidden" name="id" value={id} />
            <button type="submit"
              className="rounded-md bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-600 transition-colors">
              Marcar como Entregue
            </button>
          </form>
        )}
      </div>

      {/* Números */}
      {briefing.valor_em_risco > 0 && (
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-md bg-slate-800 px-5 py-4">
            <p className="text-xs text-slate-500 mb-1">Total de emendas</p>
            <p className="text-xl font-bold text-slate-100">{brl(briefing.valor_total_emendas)}</p>
          </div>
          <div className="rounded-md bg-slate-800 px-5 py-4">
            <p className="text-xs text-slate-500 mb-1">Em risco de devolução</p>
            <p className="text-xl font-bold text-risk-high">{brl(briefing.valor_em_risco)}</p>
          </div>
        </div>
      )}

      {/* PDF */}
      {pdfSignedUrl && (
        <a href={pdfSignedUrl} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:border-slate-500 hover:text-slate-100 transition-colors">
          ↓ Baixar PDF
        </a>
      )}

      {/* Municípios recomendados */}
      {municipios.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
            Municípios Prioritários
          </h2>
          <div className="space-y-2">
            {municipios.map((m, i) => (
              <div key={m.ibge}
                className="flex items-center justify-between rounded-md bg-slate-800 px-4 py-3 text-sm">
                <div>
                  <span className="text-slate-500 mr-2 text-xs">#{i + 1}</span>
                  <span className="text-slate-300">{m.nome}</span>
                  <span className="text-slate-500 ml-2 text-xs">{m.justificativa}</span>
                </div>
                <span className="text-nexa-400 font-mono text-xs font-semibold">
                  {m.score_total}/100
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Texto IA */}
      {briefing.texto_ia && (
        <div className="rounded-md border border-slate-800 bg-slate-800/50 p-6">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
            Análise IA
          </h2>
          <p className="text-slate-300 text-sm whitespace-pre-wrap leading-relaxed">
            {briefing.texto_ia}
          </p>
        </div>
      )}

      {briefing.status === 'gerando' && (
        <div className="rounded-md bg-yellow-900/30 border border-yellow-700 px-4 py-3 text-sm text-yellow-300">
          Briefing em geração. Recarregue a página em alguns instantes.
        </div>
      )}
      {briefing.status === 'erro' && (
        <div className="rounded-md bg-red-900/30 border border-red-700 px-4 py-3 text-sm text-red-300">
          Erro na geração. Tente novamente na página do parlamentar.
        </div>
      )}
    </div>
  )
}
