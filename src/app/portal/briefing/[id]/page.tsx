// src/app/portal/briefing/[id]/page.tsx
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { MunicipioRecomendado } from '@/types'
import { brl, UUID_RE } from '@/lib/format'

export default async function PortalBriefingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  if (!UUID_RE.test(id)) notFound()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // RLS (migration 002) scopes by parlamentar_id. Status filter prevents fetching draft data before notFound.
  const { data: briefing } = await supabase
    .from('briefings')
    .select('id,status,parlamentar_id,valor_total_emendas,valor_em_risco,municipios_recomendados,texto_ia,pdf_url,criado_em')
    .eq('id', id)
    .in('status', ['entregue', 'convertido'])
    .single()

  if (!briefing) notFound()

  const municipios: MunicipioRecomendado[] = Array.isArray(briefing.municipios_recomendados)
    ? (briefing.municipios_recomendados as unknown[]).filter(
        (m): m is MunicipioRecomendado =>
          m !== null && typeof m === 'object' &&
          typeof (m as { score_total?: unknown }).score_total === 'number'
      )
    : []

  // Signed URL via user client — storage RLS (migration 025) enforces status IN ('entregue','convertido') + parlamentar_id
  let pdfSignedUrl: string | null = null
  if (briefing.pdf_url) {
    const { data, error: storageErr } = await supabase.storage
      .from('relatorios')
      .createSignedUrl(briefing.pdf_url, 3600)
    if (storageErr) console.error('[portal/briefing] signed URL failed:', storageErr.message)
    pdfSignedUrl = data?.signedUrl ?? null
  }

  return (
    <div className="max-w-3xl space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Briefing Parlamentar</h1>
          <p className="text-slate-400 text-sm mt-1">
            Gerado em{' '}
            {new Date(briefing.criado_em).toLocaleDateString('pt-BR', {
              day: '2-digit', month: 'long', year: 'numeric',
            })}
          </p>
        </div>
        {pdfSignedUrl && (
          <a href={pdfSignedUrl} target="_blank" rel="noopener noreferrer"
            className="flex-shrink-0 rounded-md border border-nexa-700 px-4 py-2 text-sm text-nexa-400 hover:bg-nexa-900/20 transition-colors">
            ↓ Baixar PDF
          </a>
        )}
      </div>

      {/* Números */}
      {briefing.valor_em_risco > 0 && (
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-md bg-slate-800 px-5 py-4">
            <p className="text-xs text-slate-500 mb-1">Total de emendas</p>
            <p className="text-2xl font-bold text-slate-100">{brl(briefing.valor_total_emendas)}</p>
          </div>
          <div className="rounded-md bg-slate-800 px-5 py-4">
            <p className="text-xs text-slate-500 mb-1">Em risco de devolução</p>
            <p className="text-2xl font-bold text-risk-high">{brl(briefing.valor_em_risco)}</p>
          </div>
        </div>
      )}

      {/* Municípios prioritários */}
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

      {/* Análise IA */}
      {briefing.texto_ia && (
        <div className="rounded-md border border-slate-800 bg-slate-800/50 p-6">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
            Análise e Recomendações
          </h2>
          <p className="text-slate-300 text-sm whitespace-pre-wrap leading-relaxed">
            {briefing.texto_ia}
          </p>
        </div>
      )}
    </div>
  )
}
