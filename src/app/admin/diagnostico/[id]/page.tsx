import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { marcarDiagnosticoEntregue } from './actions'
import type { ProgramaCritico } from '@/types'

function statusColor(status: string) {
  switch (status) {
    case 'gerando':
      return 'text-yellow-400'
    case 'rascunho':
      return 'text-blue-400'
    case 'entregue':
      return 'text-green-400'
    case 'convertido':
      return 'text-nexa-400'
    case 'erro':
      return 'text-red-400'
    default:
      return 'text-slate-400'
  }
}

export default async function AdminDiagnosticoPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const admin = createAdminClient()

  const { data: diagnostico } = await admin
    .from('diagnosticos')
    .select('*')
    .eq('id', id)
    .single()

  if (!diagnostico) notFound()

  const { data: municipio } = await admin
    .from('municipios_habilitacao')
    .select('nome, uf')
    .eq('ibge', diagnostico.municipio_ibge)
    .single()

  const programasCriticos = (diagnostico.programas_criticos ?? []) as ProgramaCritico[]

  return (
    <div className="max-w-3xl space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">
            {municipio?.nome ?? diagnostico.municipio_ibge} — {municipio?.uf}
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Status:{' '}
            <span className={statusColor(diagnostico.status)}>
              {diagnostico.status}
            </span>
            {' · '}
            {new Date(diagnostico.criado_em).toLocaleDateString('pt-BR')}
          </p>
        </div>

        {diagnostico.status === 'rascunho' && (
          <form action={marcarDiagnosticoEntregue}>
            <input type="hidden" name="id" value={id} />
            <button
              type="submit"
              className="rounded-md bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-600 transition-colors"
            >
              Marcar como Entregue
            </button>
          </form>
        )}
      </div>

      {/* Números */}
      {diagnostico.valor_em_risco > 0 && (
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-md bg-slate-800 px-5 py-4">
            <p className="text-xs text-slate-500 mb-1">Total identificado</p>
            <p className="text-xl font-bold text-slate-100">
              R${' '}
              {Number(diagnostico.valor_total_identificado).toLocaleString('pt-BR')}
            </p>
          </div>
          <div className="rounded-md bg-slate-800 px-5 py-4">
            <p className="text-xs text-slate-500 mb-1">Em risco de devolução</p>
            <p className="text-xl font-bold text-red-400">
              R$ {Number(diagnostico.valor_em_risco).toLocaleString('pt-BR')}
            </p>
          </div>
        </div>
      )}

      {/* PDF */}
      {diagnostico.pdf_url && (
        <a
          href={diagnostico.pdf_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:border-slate-500 hover:text-slate-100 transition-colors"
        >
          ↓ Baixar PDF
        </a>
      )}

      {/* Texto IA */}
      {diagnostico.texto_ia && (
        <div className="rounded-md border border-slate-800 bg-slate-800/50 p-6">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
            Análise IA
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
            Programas Críticos
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
                <div className="flex items-center gap-4">
                  <span className="text-slate-500 text-xs font-mono">
                    R${' '}
                    {(p.valor_empenhado - p.valor_pago).toLocaleString('pt-BR')} parado
                  </span>
                  <span className="text-red-400 font-mono font-semibold">
                    {p.percentual_execucao.toFixed(1)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Estado gerando */}
      {diagnostico.status === 'gerando' && (
        <div className="rounded-md bg-yellow-900/30 border border-yellow-700 px-4 py-3 text-sm text-yellow-300">
          Diagnóstico em geração. Recarregue a página em alguns instantes.
        </div>
      )}

      {/* Estado erro */}
      {diagnostico.status === 'erro' && (
        <div className="rounded-md bg-red-900/30 border border-red-700 px-4 py-3 text-sm text-red-300">
          Houve um erro durante a geração. Tente novamente criando um novo diagnóstico.
        </div>
      )}
    </div>
  )
}
