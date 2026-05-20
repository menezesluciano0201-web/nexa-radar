// src/app/login/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function signIn(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const next = formData.get('next') as string

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    const msg = error.code === 'invalid_credentials'
      ? 'Credenciais inválidas'
      : 'Erro ao fazer login. Tente novamente.'
    redirect(`/login?error=${encodeURIComponent(msg)}`)
  }

  revalidatePath('/', 'layout')
  // Prevent open redirect — require relative path that cannot be protocol-relative (//evil.com)
  const safeNext = next && next.startsWith('/') && !next.startsWith('//')
  redirect(safeNext ? next : '/')
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}
