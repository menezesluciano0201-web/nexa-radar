'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAdminClient } from '@/lib/require-admin'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function marcarDiagnosticoEntregue(formData: FormData) {
  const id = (formData.get('id') as string | null) ?? ''
  if (!UUID_RE.test(id)) redirect('/admin')

  const admin = await requireAdminClient()
  const { error } = await admin
    .from('diagnosticos')
    .update({ status: 'entregue' })
    .eq('id', id)
    .eq('status', 'rascunho')

  if (error) {
    console.error('[marcarDiagnosticoEntregue] update failed:', error.message)
    redirect(`/admin/diagnostico/${id}?error=update_failed`)
  }

  revalidatePath(`/admin/diagnostico/${id}`)
  revalidatePath('/portal/diagnostico', 'page')
  revalidatePath(`/portal/diagnostico/${id}`)
  redirect(`/admin/diagnostico/${id}`)
}

export async function resetDiagnosticoGerando(formData: FormData) {
  const id = (formData.get('id') as string | null) ?? ''
  if (!UUID_RE.test(id)) redirect('/admin')

  const admin = await requireAdminClient()
  const { error } = await admin
    .from('diagnosticos')
    .update({ status: 'erro' })
    .eq('id', id)
    .eq('status', 'gerando')

  if (error) {
    console.error('[resetDiagnosticoGerando] update failed:', error.message)
    redirect(`/admin/diagnostico/${id}?error=update_failed`)
  }

  revalidatePath(`/admin/diagnostico/${id}`)
  redirect(`/admin/diagnostico/${id}`)
}
