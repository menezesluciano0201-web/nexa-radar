// src/lib/require-admin.ts
// Defense-in-depth: admin pages call this before using createAdminClient().
// The middleware and admin layout provide the primary+secondary gates;
// this provides a third layer so service-role access is always explicitly gated.
import { redirect } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function requireAdminClient(): Promise<ReturnType<typeof createAdminClient>> {
  const { admin } = await requireAdminClientWithUser()
  return admin
}

// Mesma garantia de admin que requireAdminClient, mas também devolve o user
// autenticado. Use quando o action precisa do user.id (ex: atualizado_por,
// aprovado_por) — o admin client é service-role e não carrega cookies, então
// admin.auth.getUser() retornaria null aqui.
export async function requireAdminClientWithUser(): Promise<{
  admin: ReturnType<typeof createAdminClient>
  user: User
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase
    .from('profiles').select('tipo').eq('id', user.id).single()
  if (!profile || profile.tipo !== 'admin') redirect('/portal')
  return { admin: createAdminClient(), user }
}
