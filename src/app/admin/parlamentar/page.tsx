// src/app/admin/parlamentar/page.tsx
import { requireAdminClient } from '@/lib/require-admin'
import Link from 'next/link'

function brl(v: number) {
  return `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`
}

export default async function AdminParlamentarPage() {
  const admin = await requireAdminClient()

  // Agrupar emendas por parlamentar (todos os anos)
  const { data: emendas } = await admin
    .from('emendas_parlamentares')
    .select('parlamentar_id, parlamentar_nome, valor_autorizado, exercicio')
    .order('parlamentar_nome')

  if (!emendas?.length) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-slate-100 mb-4">Parlamentares</h1>
        <p className="text-slate-400 text-sm">
          Nenhuma emenda coletada ainda. Execute o scraper primeiro.
        </p>
      </div>
    )
  }

  // Agregar por parlamentar_id
  const parlamentares = new Map<
    string,
    { nome: string; totalAutorizado: number; exercicios: Set<number> }
  >()
  for (const e of emendas) {
    const existing = parlamentares.get(e.parlamentar_id)
    if (existing) {
      existing.totalAutorizado += e.valor_autorizado
      existing.exercicios.add(e.exercicio)
    } else {
      parlamentares.set(e.parlamentar_id, {
        nome: e.parlamentar_nome ?? e.parlamentar_id,
        totalAutorizado: e.valor_autorizado,
        exercicios: new Set([e.exercicio]),
      })
    }
  }

  const lista = Array.from(parlamentares.entries())
    .map(([id, data]) => ({ id, ...data }))
    .sort((a, b) => b.totalAutorizado - a.totalAutorizado)

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
                {[...p.exercicios].sort().join(', ')} · {p.exercicios.size} ano(s)
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
