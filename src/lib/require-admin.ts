// src/lib/require-admin.ts
// Defense-in-depth: admin pages call this before using createAdminClient().
// The middleware and admin layout provide the primary+secondary gates;
// this provides a third layer so service-role access is always explicitly gated.
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function requireAdminClient(): Promise<ReturnType<typeof createAdminClient>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase
    .from('profiles').select('tipo').eq('id', user.id).single()
  if (!profile || profile.tipo !== 'admin') redirect('/portal')
  return createAdminClient()
}
