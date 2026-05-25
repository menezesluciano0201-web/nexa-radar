import Link from 'next/link'
import { requireAdminClient } from '@/lib/require-admin'
import { brl } from '@/lib/format'
import type { TemplateName, StatusProjeto } from '@/types'
import { getTemplate } from '@/lib/templates'

type ProjetoRow = {
  id: string
  template: TemplateName
  municipio_ibge: string
  valor_solicitado: number | null
  status: StatusProjeto
  criado_em: string
  municipios_habilitacao: { nome: string } | null
}

function statusColor(status: StatusProjeto) {
  switch (status) {
    case 'rascunho': return 'bg-green-900 text-green-300'
    case 'erro':     return 'bg-red-900 text-red-300'
    default:         return 'bg-yellow-900 text-yellow-300'
  }
}

export default async function ProjetosPage() {
  const admin = await requireAdminClient()

  const { data: projetos } = await admin
    .from('projetos')
    .select(`
      id, template, municipio_ibge, valor_solicitado, status, criado_em,
      municipios_habilitacao!inner(nome)
    `)
    .order('criado_em', { ascending: false })
    .limit(50)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-100">Projetos Gerados</h1>
        <Link
          href="/admin/projeto/novo"
          className="rounded-md bg-nexa-600 px-4 py-2 text-sm font-semibold text-white hover:bg-nexa-500"
        >
          + Novo Projeto
        </Link>
      </div>

      <div className="rounded-md border border-slate-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-800">
            <tr>
              {['Município', 'Template', 'Valor', 'Status', 'Data'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {((projetos ?? []) as unknown as ProjetoRow[]).map(p => {
              const config = getTemplate(p.template)
              return (
                <tr key={p.id} className="hover:bg-slate-800/50">
                  <td className="px-4 py-3 text-slate-300">
                    <Link href={`/admin/projeto/${p.id}`} className="hover:text-nexa-400">
                      {p.municipios_habilitacao?.nome ?? p.municipio_ibge}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{config.nome}</td>
                  <td className="px-4 py-3 text-slate-300 font-mono text-xs">
                    {p.valor_solicitado ? brl(p.valor_solicitado) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded px-2 py-0.5 text-xs font-semibold ${statusColor(p.status)}`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">
                    {new Date(p.criado_em).toLocaleDateString('pt-BR')}
                  </td>
                </tr>
              )
            })}
            {(!projetos || projetos.length === 0) && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500 text-sm">
                  Nenhum projeto gerado ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
