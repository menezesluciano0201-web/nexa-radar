'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { requireAdminClient } from '@/lib/require-admin'
import { UUID_RE } from '@/lib/format'

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
  revalidatePath(`/portal/briefing/${id}`)
  redirect(`/admin/briefing/${id}`)
}

export async function resetBriefingGerando(formData: FormData) {
  const id = (formData.get('id') as string | null) ?? ''
  if (!UUID_RE.test(id)) redirect('/admin')

  const admin = await requireAdminClient()
  const { error } = await admin
    .from('briefings')
    .update({ status: 'erro' })
    .eq('id', id)
    .eq('status', 'gerando')

  if (error) {
    console.error('[resetBriefingGerando] update failed:', error.message)
    redirect(`/admin/briefing/${id}?error=update_failed`)
  }

  revalidatePath(`/admin/briefing/${id}`)
  redirect(`/admin/briefing/${id}`)
}
