'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'

export async function marcarDiagnosticoEntregue(formData: FormData) {
  const id = formData.get('id') as string
  const admin = createAdminClient()

  await admin
    .from('diagnosticos')
    .update({ status: 'entregue' })
    .eq('id', id)

  revalidatePath(`/admin/diagnostico/${id}`)
}
