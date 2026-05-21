// src/app/admin/parlamentar/page.tsx
import { requireAdminClient } from '@/lib/require-admin'
import Link from 'next/link'
import { brl } from '@/lib/format'

export default async function AdminParlamentarPage() {
  const admin = await requireAdminClient()

  const { data: resumo } = await admin
    .from('parlamentar_resumo')
    .select('parlamentar_id, parlamentar_nome, total_autorizado, exercicios')
    .order('total_autorizado', { ascending: false })
    .limit(1000)

  if (!resumo?.length) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-slate-100 mb-4">Parlamentares</h1>
        <p className="text-slate-400 text-sm">
          Nenhuma emenda coletada ainda. Execute o scraper primeiro.
        </p>
      </div>
    )
  }

  const lista = resumo.map(r => ({
    id: r.parlamentar_id,
    nome: r.parlamentar_nome ?? r.parlamentar_id,
    totalAutorizado: Number(r.total_autorizado),
    exercicios: (r.exercicios as number[] | null) ?? [],
  }))

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-100 mb-6">Parlamentares</h1>
      <div className="space-y-2">
        {lista.map((p) => (
          <Link
            key={p.id}
            href={`/admin/parlamentar/${encodeURIComponent(p.id)}`}
            className="flex items-center justify-between rounded-md border border-slate-800 bg-slate-800/40 px-5 py-4 hover:border-slate-700 hover:bg-slate-800/70 transition-colors"
          >
            <div>
              <p className="text-sm font-medium text-slate-200">{p.nome}</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {p.exercicios.join(', ')} · {p.exercicios.length} ano(s)
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-mono text-slate-300">{brl(p.totalAutorizado)}</p>
              <p className="text-xs text-slate-500">autorizado total</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
