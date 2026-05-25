// src/app/update-password/actions.ts
'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function updatePassword(formData: FormData) {
  const password = (formData.get('password') as string | null) ?? ''
  const confirm = (formData.get('confirm') as string | null) ?? ''

  if (password.length < 8) redirect('/update-password?error=too_short')
  if (password !== confirm) redirect('/update-password?error=mismatch')

  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) redirect('/login?error=login_error')

  const { error } = await supabase.auth.updateUser({ password })
  if (error) redirect('/update-password?error=update_failed')

  // Determine landing route by tipo
  const { data: profile } = await supabase
    .from('profiles').select('tipo').eq('id', user.id).single()
  const dest = profile?.tipo === 'admin' ? '/admin' : '/portal'

  revalidatePath('/', 'layout')
  redirect(dest)
}
