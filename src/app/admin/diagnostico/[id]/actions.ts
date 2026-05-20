'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function marcarDiagnosticoEntregue(formData: FormData) {
  const id = formData.get('id') as string

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('tipo')
    .eq('id', user.id)
    .single()

  if (!profile || profile.tipo !== 'admin') redirect('/portal')

  const admin = createAdminClient()
  await admin
    .from('diagnosticos')
    .update({ status: 'entregue' })
    .eq('id', id)

  revalidatePath(`/admin/diagnostico/${id}`)
  revalidatePath('/portal/diagnostico', 'page')
}
