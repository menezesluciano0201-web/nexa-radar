// src/components/portal/KpiBlock.tsx
import type { KpiPortal } from '@/types'
import { ordenarKpis } from '@/lib/portal'

interface Props {
  kpis: KpiPortal[]
  corPrimaria: string
}

export function KpiBlock({ kpis, corPrimaria }: Props) {
  const slots = ordenarKpis(kpis)
  const filled = slots.filter(s => s !== null)
  if (filled.length === 0) return null

  return (
    <section className="px-4 py-8 bg-white">
      <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4">
        {slots.map((k, i) =>
          k ? (
            <div key={k.id} className="rounded-lg border border-slate-200 p-5 text-center bg-slate-50">
              <p className="text-2xl md:text-3xl font-bold" style={{ color: corPrimaria }}>
                {k.sufixo === 'R$' ? 'R$ ' : ''}{k.valor}{k.sufixo && k.sufixo !== 'R$' ? ` ${k.sufixo}` : ''}
              </p>
              <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">{k.label}</p>
            </div>
          ) : (
            <div key={`empty-${i}`} className="hidden md:block" />
          )
        )}
      </div>
    </section>
  )
}
