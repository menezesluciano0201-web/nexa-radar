// src/app/portal/diagnostico/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

function statusBadge(status: string) {
  switch (status) {
    case 'rascunho':
      return 'bg-blue-900/50 text-blue-300 border-blue-800'
    case 'entregue':
      return 'bg-green-900/50 text-green-300 border-green-800'
    case 'convertido':
      return 'bg-sky-900/50 text-sky-300 border-sky-800'
    default:
      return 'bg-slate-700/50 text-slate-300 border-slate-600'
  }
}

export default async function PortalDiagnosticoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('municipio_ibge')
    .eq('id', user.id)
    .single()

  if (!profile?.municipio_ibge) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-slate-100 mb-6">Diagnósticos</h1>
        <p className="text-slate-400 text-sm">
          Diagnósticos municipais não estão disponíveis para este tipo de perfil.
          Para acesso, entre em contato com a equipe Nexa Radar.
        </p>
      </div>
    )
  }

  // Only show formally delivered diagnostics — hide drafts (rascunho), in-progress, and errors.
  // RLS already scopes by municipio_ibge; explicit filter is belt-and-suspenders.
  const { data: diagnosticos } = await supabase
    .from('diagnosticos')
    .select('id, status, valor_total_identificado, valor_em_risco, criado_em')
    .eq('municipio_ibge', profile.municipio_ibge)
    .in('status', ['entregue', 'convertido'])
    .order('criado_em', { ascending: false })

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-100 mb-6">Diagnósticos</h1>

      {!diagnosticos?.length ? (
        <p className="text-slate-400 text-sm">
          Nenhum diagnóstico disponível ainda. Entre em contato com a equipe Nexa Radar.
        </p>
      ) : (
        <div className="space-y-3">
          {diagnosticos.map((d) => (
            <Link
              key={d.id}
              href={`/portal/diagnostico/${d.id}`}
              className="block rounded-md border border-slate-800 bg-slate-800/40 px-5 py-4 hover:border-slate-700 hover:bg-slate-800/70 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-200">
                    {new Date(d.criado_em).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </p>
                  {d.valor_em_risco > 0 && (
                    <p className="text-xs text-slate-500 mt-0.5">
                      R$ {Number(d.valor_em_risco).toLocaleString('pt-BR')} em risco identificado
                    </p>
                  )}
                </div>
                <span
                  className={`text-xs px-2 py-1 rounded-full border ${statusBadge(d.status)}`}
                >
                  {d.status}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
