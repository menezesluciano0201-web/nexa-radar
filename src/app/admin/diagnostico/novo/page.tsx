// src/app/admin/diagnostico/novo/page.tsx
import { createClient } from '@/lib/supabase/server'
import DiagnosticoForm from '@/components/diagnostico/DiagnosticoForm'

export default async function NovoDiagnosticoPage() {
  const supabase = await createClient()

  const { data: municipios } = await supabase
    .from('municipios_habilitacao')
    .select('ibge, nome, uf')
    .order('nome')
    .limit(300)

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold text-slate-100 mb-1">Novo Diagnóstico</h1>
      <p className="text-slate-400 text-sm mb-8">
        Selecione o município e clique em gerar. O processo leva 30–60 segundos.
      </p>
      <DiagnosticoForm municipios={municipios ?? []} />
    </div>
  )
}
