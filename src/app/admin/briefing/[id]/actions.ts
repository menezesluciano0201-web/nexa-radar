'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { requireAdminClient } from '@/lib/require-admin'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function marcarBriefingEntregue(formData: FormData) {
  const id = (formData.get('id') as string | null) ?? ''
  if (!UUID_RE.test(id)) redirect('/admin')

  const admin = await requireAdminClient()
  const { error } = await admin
    .from('briefings')
    .update({ status: 'entregue' })
    .eq('id', id)
    .eq('status', 'rascunho')

  if (error) {
    console.error('[marcarBriefingEntregue] update failed:', error.message)
    redirect(`/admin/briefing/${id}?error=update_failed`)
  }

  revalidatePath(`/admin/briefing/${id}`)
  revalidatePath('/portal/briefing', 'page')
  redirect(`/admin/briefing/${id}`)
}
