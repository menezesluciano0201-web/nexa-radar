// src/app/admin/briefing/[id]/actions.ts
'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function marcarBriefingEntregue(formData: FormData) {
  const id = (formData.get('id') as string | null) ?? ''
  if (!UUID_RE.test(id)) redirect('/admin')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('tipo').eq('id', user.id).single()
  if (!profile || profile.tipo !== 'admin') redirect('/portal')

  const admin = createAdminClient()
  const { error } = await admin
    .from('briefings')
    .update({ status: 'entregue' })
    .eq('id', id)

  if (error) {
    console.error('[marcarBriefingEntregue] update failed:', error.message)
    redirect(`/admin/briefing/${id}?error=Falha+ao+atualizar+status`)
  }

  revalidatePath(`/admin/briefing/${id}`)
  revalidatePath('/portal/briefing', 'page')
  redirect(`/admin/briefing/${id}`)
}
