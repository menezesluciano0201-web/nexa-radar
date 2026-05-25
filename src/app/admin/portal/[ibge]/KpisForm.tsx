// src/app/admin/portal/[ibge]/KpisForm.tsx
'use client'

import type { KpiPortal } from '@/types'
import { ordenarKpis } from '@/lib/portal'
import { salvarKpis } from './actions'

interface Props {
  ibge: string
  kpis: KpiPortal[]
}

export function KpisForm({ ibge, kpis }: Props) {
  const slots = ordenarKpis(kpis)

  return (
    <form action={salvarKpis} className="rounded-md border border-slate-800 p-4 space-y-4">
      <input type="hidden" name="ibge" value={ibge} />

      <p className="text-xs text-slate-500">
        4 KPIs aparecem no topo do portal público. Deixe vazio para esconder. Sufixo opcional (ex: &quot;R$&quot;, &quot;famílias&quot;).
      </p>

      {[1, 2, 3, 4].map(i => {
        const k = slots[i - 1]
        return (
          <div key={i} className="grid grid-cols-1 md:grid-cols-3 gap-3 border-t border-slate-800 pt-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">KPI {i} — Label</label>
              <input
                type="text"
                name={`label_${i}`}
                defaultValue={k?.label ?? ''}
                placeholder="Captados"
                className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Valor</label>
              <input
                type="text"
                name={`valor_${i}`}
                defaultValue={k?.valor ?? ''}
                placeholder="5.200.000"
                className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Sufixo (opcional)</label>
              <input
                type="text"
                name={`sufixo_${i}`}
                defaultValue={k?.sufixo ?? ''}
                placeholder="R$ ou famílias"
                className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
              />
            </div>
          </div>
        )
      })}

      <button
        type="submit"
        className="rounded-md bg-nexa-600 px-4 py-2 text-sm font-semibold text-white hover:bg-nexa-500"
      >
        Salvar KPIs
      </button>
    </form>
  )
}
