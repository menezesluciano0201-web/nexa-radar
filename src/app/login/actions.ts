// src/app/login/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function signIn(formData: FormData) {
  const supabase = await createClient()

  const email = (formData.get('email') as string | null) ?? ''
  const password = (formData.get('password') as string | null) ?? ''
  const next = (formData.get('next') as string | null) ?? ''

  if (!email || !password) {
    redirect('/login?error=required')
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    const code = error.code === 'invalid_credentials' ? 'invalid_credentials' : 'login_error'
    redirect(`/login?error=${code}`)
  }

  revalidatePath('/', 'layout')
  // Use URL parsing to safely extract pathname+search — blocks //evil.com, /\evil.com, %2F%2F, etc.
  let safePath = '/'
  if (next) {
    try {
      const parsed = new URL(next, 'http://localhost')
      if (parsed.origin === 'http://localhost') safePath = parsed.pathname + parsed.search
    } catch { /* malformed URL — default to / */ }
  }
  redirect(safePath)
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}
