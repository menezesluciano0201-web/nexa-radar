// src/app/portal/page.tsx
import { createClient } from '@/lib/supabase/server'

export default async function PortalHomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('nome, tipo, municipio_ibge, parlamentar_id')
    .eq('id', user!.id)
    .single()

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-100 mb-2">
        Olá, {profile?.nome}
      </h1>
      <p className="text-slate-400 text-sm">
        Seu portal está sendo configurado. As funcionalidades serão adicionadas em breve.
      </p>
    </div>
  )
}
