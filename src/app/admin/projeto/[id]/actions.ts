'use server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { requireAdminClient } from '@/lib/require-admin'
import { UUID_RE } from '@/lib/format'

export async function forcarResetProjeto(projetoId: string) {
  if (!UUID_RE.test(projetoId)) redirect('/admin')

  const admin = await requireAdminClient()

  await admin
    .from('projetos')
    .update({ status: 'erro' })
    .eq('id', projetoId)
    .eq('status', 'gerando')

  revalidatePath(`/admin/projeto/${projetoId}`)
}
