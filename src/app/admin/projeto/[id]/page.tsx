import { notFound } from 'next/navigation'
import { requireAdminClient } from '@/lib/require-admin'
import { brl, UUID_RE } from '@/lib/format'
import { getTemplate } from '@/lib/templates'
import { forcarResetProjeto } from './actions'
import type { Projeto, TemplateName } from '@/types'

function statusColor(status: string) {
  switch (status) {
    case 'gerando':  return 'bg-yellow-900 text-yellow-300'
    case 'rascunho': return 'bg-green-900 text-green-300'
    case 'erro':     return 'bg-red-900 text-red-300'
    default:         return 'bg-slate-700 text-slate-400'
  }
}

export default async function ProjetoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  if (!UUID_RE.test(id)) notFound()

  const admin = await requireAdminClient()

  const { data: projeto } = await admin
    .from('projetos')
    .select('id,status,template,municipio_ibge,valor_solicitado,num_beneficiarios,prazo_meses,pdf_url,docx_url,criado_em,secoes_ia')
    .eq('id', id)
    .single()

  if (!projeto) notFound()

  const p = projeto as Projeto
  const config = getTemplate(p.template as TemplateName)

  // Gerar signed URLs em paralelo
  const [pdfUrlResult, docxUrlResult] = await Promise.all([
    p.pdf_url
      ? admin.storage.from('projetos').createSignedUrl(p.pdf_url, 3600)
      : Promise.resolve({ data: null }),
    p.docx_url
      ? admin.storage.from('projetos').createSignedUrl(p.docx_url, 3600)
      : Promise.resolve({ data: null }),
  ])

  const gerandoHaMuito = p.status === 'gerando' &&
    new Date(p.criado_em).getTime() < Date.now() - 10 * 60 * 1000

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100">{config.nome}</h1>
          <p className="text-slate-400 text-sm mt-1">
            {p.municipio_ibge} · {config.orgao} · {config.fundo}
          </p>
        </div>
        <span className={`rounded px-3 py-1 text-xs font-semibold ${statusColor(p.status)}`}>
          {p.status}
        </span>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Valor solicitado', valor: p.valor_solicitado ? brl(p.valor_solicitado) : '—' },
          { label: 'Beneficiários', valor: String(p.num_beneficiarios ?? '—') },
          { label: 'Prazo', valor: p.prazo_meses ? `${p.prazo_meses} meses` : '—' },
        ].map(item => (
          <div key={item.label} className="rounded-md bg-slate-800 p-4">
            <p className="text-xs text-slate-400">{item.label}</p>
            <p className="text-lg font-semibold text-slate-100 mt-1">{item.valor}</p>
          </div>
        ))}
      </div>

      {/* Downloads */}
      {p.status === 'rascunho' && (
        <div className="flex gap-3">
          {pdfUrlResult.data?.signedUrl && (
            <a
              href={pdfUrlResult.data.signedUrl}
              target="_blank"
              className="inline-flex items-center gap-2 rounded-md bg-blue-800 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              ↓ Baixar PDF
            </a>
          )}
          {docxUrlResult.data?.signedUrl && (
            <a
              href={docxUrlResult.data.signedUrl}
              target="_blank"
              className="inline-flex items-center gap-2 rounded-md bg-slate-700 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-600"
            >
              ↓ Baixar Word
            </a>
          )}
        </div>
      )}

      {/* Seções geradas */}
      {p.status === 'rascunho' && p.secoes_ia && (
        <div className="space-y-4">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
            Seções Geradas
          </h2>
          {config.secoes.map(s => {
            const texto = p.secoes_ia?.secoes_texto?.[s.id]
            if (!texto) return null
            return (
              <details key={s.id} className="rounded-md border border-slate-800 bg-slate-800/50">
                <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-slate-300 hover:text-slate-100">
                  {s.titulo}
                </summary>
                <div className="px-4 pb-4 pt-2 text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                  {texto}
                </div>
              </details>
            )
          })}
        </div>
      )}

      {/* Forçar reset */}
      {gerandoHaMuito && (
        <form action={forcarResetProjeto.bind(null, p.id)}>
          <button
            type="submit"
            className="rounded-md bg-red-900/40 border border-red-800 px-4 py-2 text-sm text-red-300 hover:bg-red-900/60"
          >
            Forçar reset (geração travada há +10 min)
          </button>
        </form>
      )}
    </div>
  )
}
