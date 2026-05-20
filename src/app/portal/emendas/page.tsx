// src/app/portal/emendas/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

function brl(v: number) {
  return `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`
}

export default async function PortalEmendasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('parlamentar_id, tipo').eq('id', user.id).single()

  if (!profile?.parlamentar_id) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-slate-100 mb-4">Emendas</h1>
        <p className="text-slate-400 text-sm">
          Seu perfil não tem um ID parlamentar associado. Entre em contato com a equipe Nexa Radar.
        </p>
      </div>
    )
  }

  // RLS (migration 013) filtra pelo parlamentar_id do profile logado
  const { data: emendas } = await supabase
    .from('emendas_parlamentares')
    .select('id, area_tematica, municipio_ibge, valor_autorizado, valor_empenhado, valor_executado, percentual_execucao, exercicio, tipo')
    .order('exercicio', { ascending: false })
    .order('valor_autorizado', { ascending: false })

  const totalAutorizado = (emendas ?? []).reduce((s, e) => s + e.valor_autorizado, 0)
  const totalEmRisco = (emendas ?? []).reduce((s, e) => s + (e.valor_autorizado - e.valor_executado), 0)

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-100 mb-2">Minhas Emendas</h1>
      <p className="text-slate-400 text-sm mb-6">
        {brl(totalAutorizado)} autorizado · {brl(totalEmRisco)} em risco de devolução
      </p>

      {!emendas?.length ? (
        <p className="text-slate-400 text-sm">Nenhuma emenda coletada ainda.</p>
      ) : (
        <div className="space-y-2">
          {emendas.map((e) => (
            <div key={e.id}
              className="flex items-center justify-between rounded-md border border-slate-800 bg-slate-800/40 px-5 py-3">
              <div>
                <p className="text-sm text-slate-300">
                  {e.area_tematica ?? 'Sem área'} · {e.municipio_ibge ?? 'Nacional'}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {e.tipo} · {e.exercicio}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-mono text-slate-300">{brl(e.valor_autorizado)}</p>
                <p className="text-xs text-slate-500">{e.percentual_execucao}% executado</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
