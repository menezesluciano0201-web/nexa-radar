// src/app/api/projeto/[id]/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { UUID_RE } from '@/lib/format'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('tipo').eq('id', user.id).single()
  if (!profile || profile.tipo !== 'admin')
    return NextResponse.json({ error: 'Proibido' }, { status: 403 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('projetos')
    .select('status, pdf_url, docx_url')
    .eq('id', id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  return NextResponse.json(data)
}
