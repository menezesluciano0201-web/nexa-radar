// src/app/admin/diagnostico/novo/page.tsx
import { requireAdminClient } from '@/lib/require-admin'
import DiagnosticoForm from '@/components/diagnostico/DiagnosticoForm'
import { IBGE_RE } from '@/lib/format'

export default async function NovoDiagnosticoPage({
  searchParams,
}: {
  searchParams: Promise<{ ibge?: string; from?: string }>
}) {
  const admin = await requireAdminClient()
  const { ibge: ibgeParam } = await searchParams
  const ibgeInicial = ibgeParam && IBGE_RE.test(ibgeParam) ? ibgeParam : ''

  // Limit covers full IBGE seed (5571 municipalities) with growth room
  const { data: municipios } = await admin
    .from('municipios_habilitacao')
    .select('ibge, nome, uf')
    .order('nome')
    .limit(6000)

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold text-slate-100 mb-1">Novo Diagnóstico</h1>
      <p className="text-slate-400 text-sm mb-8">
        Selecione o município e clique em gerar. O processo leva 30–60 segundos.
      </p>
      <DiagnosticoForm municipios={municipios ?? []} ibgeInicial={ibgeInicial} />
    </div>
  )
}
