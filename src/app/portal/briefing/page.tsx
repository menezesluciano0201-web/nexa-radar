// src/app/portal/briefing/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

function statusBadge(status: string) {
  if (status === 'entregue') return 'bg-green-900/50 text-green-300 border-green-800'
  return 'bg-slate-700/50 text-slate-300 border-slate-600'
}

export default async function PortalBriefingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('parlamentar_id').eq('id', user.id).single()

  if (!profile?.parlamentar_id) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-slate-100 mb-4">Briefings</h1>
        <p className="text-slate-400 text-sm">
          Perfil sem ID parlamentar. Entre em contato com a equipe Nexa Radar.
        </p>
      </div>
    )
  }

  // RLS (migration 002) scopes by parlamentar_id; explicit filter is belt-and-suspenders
  const { data: briefings } = await supabase
    .from('briefings')
    .select('id, status, valor_total_emendas, valor_em_risco, criado_em')
    .eq('parlamentar_id', profile.parlamentar_id)
    .eq('status', 'entregue')
    .order('criado_em', { ascending: false })

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-100 mb-6">Briefings</h1>
      {!briefings?.length ? (
        <p className="text-slate-400 text-sm">
          Nenhum briefing disponível ainda. Entre em contato com a equipe Nexa Radar.
        </p>
      ) : (
        <div className="space-y-3">
          {briefings.map((b) => (
            <Link key={b.id} href={`/portal/briefing/${b.id}`}
              className="block rounded-md border border-slate-800 bg-slate-800/40 px-5 py-4 hover:border-slate-700 hover:bg-slate-800/70 transition-colors">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-200">
                    {new Date(b.criado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                  </p>
                  {b.valor_em_risco > 0 && (
                    <p className="text-xs text-slate-500 mt-0.5">
                      R$ {Number(b.valor_em_risco).toLocaleString('pt-BR')} em risco identificado
                    </p>
                  )}
                </div>
                <span className={`text-xs px-2 py-1 rounded-full border ${statusBadge(b.status)}`}>
                  {b.status}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
