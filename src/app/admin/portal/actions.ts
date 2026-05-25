// src/app/admin/portal/actions.ts
'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { requireAdminClient } from '@/lib/require-admin'

export async function habilitarMunicipio(formData: FormData) {
  const ibge = (formData.get('ibge') as string | null)?.trim()
  if (!ibge || !/^\d{7}$/.test(ibge)) redirect('/admin/portal?error=ibge_invalido')

  const admin = await requireAdminClient()

  const { error } = await admin
    .from('municipios_branding')
    .insert({ municipio_ibge: ibge })

  if (error && error.code !== '23505') {  // 23505 = já existe, OK
    redirect(`/admin/portal?error=db&detail=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/admin/portal')
  redirect(`/admin/portal/${ibge}`)
}
