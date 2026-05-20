// src/app/portal/diagnostico/[id]/page.tsx
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { ProgramaCritico } from '@/types'

export default async function PortalDiagnosticoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // RLS scopes by municipio_ibge. Status filter here prevents fetching draft data before the notFound check.
  const { data: diagnostico } = await supabase
    .from('diagnosticos')
    .select('id,status,municipio_ibge,valor_total_identificado,valor_em_risco,programas_criticos,acoes_recomendadas,texto_ia,pdf_url,criado_em')
    .eq('id', id)
    .in('status', ['entregue', 'convertido'])
    .single()

  if (!diagnostico) notFound()

  const programasCriticos: ProgramaCritico[] = Array.isArray(diagnostico.programas_criticos)
    ? (diagnostico.programas_criticos as unknown[]).filter(
        (p): p is ProgramaCritico =>
          p !== null && typeof p === 'object' &&
          typeof (p as { percentual_execucao?: unknown }).percentual_execucao === 'number'
      )
    : []

  // Signed URL via user client — storage RLS (migration 011) validates municipio access
  let pdfSignedUrl: string | null = null
  if (diagnostico.pdf_url) {
    const { data, error: storageErr } = await supabase.storage
      .from('relatorios')
      .createSignedUrl(diagnostico.pdf_url, 3600)
    if (storageErr) {
      console.error('[portal/diagnostico] signed URL failed:', storageErr.message)
    }
    pdfSignedUrl = data?.signedUrl ?? null
  }

  return (
    <div className="max-w-3xl space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Diagnóstico Municipal</h1>
          <p className="text-slate-400 text-sm mt-1">
            Gerado em{' '}
            {new Date(diagnostico.criado_em).toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        </div>

        {pdfSignedUrl && (
          <a
            href={pdfSignedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0 rounded-md border border-nexa-700 px-4 py-2 text-sm text-nexa-400 hover:bg-nexa-900/20 transition-colors"
          >
            ↓ Baixar PDF
          </a>
        )}
      </div>

      {/* Números */}
      {(diagnostico.valor_em_risco > 0 || diagnostico.valor_total_identificado > 0) && (
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-md bg-slate-800 px-5 py-4">
            <p className="text-xs text-slate-500 mb-1">Total identificado</p>
            <p className="text-2xl font-bold text-slate-100">
              R$ {Number(diagnostico.valor_total_identificado).toLocaleString('pt-BR')}
            </p>
          </div>
          <div className="rounded-md bg-slate-800 px-5 py-4">
            <p className="text-xs text-slate-500 mb-1">Em risco de devolução</p>
            <p className="text-2xl font-bold text-risk-high">
              R$ {Number(diagnostico.valor_em_risco).toLocaleString('pt-BR')}
            </p>
          </div>
        </div>
      )}

      {/* Análise IA */}
      {diagnostico.texto_ia && (
        <div className="rounded-md border border-slate-800 bg-slate-800/50 p-6">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
            Análise e Recomendações
          </h2>
          <p className="text-slate-300 text-sm whitespace-pre-wrap leading-relaxed">
            {diagnostico.texto_ia}
          </p>
        </div>
      )}

      {/* Programas críticos */}
      {programasCriticos.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
            Programas Identificados
          </h2>
          <div className="space-y-2">
            {programasCriticos.map((p, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-md bg-slate-800 px-4 py-3 text-sm"
              >
                <div>
                  <span className="text-slate-300">{p.programa}</span>
                  <span className="text-slate-500 ml-2 text-xs">{p.fundo}</span>
                </div>
                <span className="text-risk-high font-mono text-xs font-semibold">
                  {p.percentual_execucao.toFixed(1)}% executado
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
