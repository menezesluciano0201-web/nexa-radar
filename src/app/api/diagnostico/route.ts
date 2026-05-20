// src/app/api/diagnostico/route.ts
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateDiagnostico } from '@/lib/generateDiagnostico'

export async function POST(request: NextRequest) {
  // 1. Autenticar
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Verificar tipo admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('tipo')
    .eq('id', user.id)
    .single()

  if (!profile || profile.tipo !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // 3. Validar body
  let body: { municipio_ibge?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  if (!body.municipio_ibge) {
    return NextResponse.json({ error: 'municipio_ibge required' }, { status: 400 })
  }
  if (!/^\d{7}$/.test(body.municipio_ibge)) {
    return NextResponse.json({ error: 'municipio_ibge must be a 7-digit IBGE code' }, { status: 400 })
  }

  // 3b. Verificar que o município existe — evita criar row 'gerando' que nunca resolve
  const admin = createAdminClient()
  const { count } = await admin
    .from('municipios_habilitacao')
    .select('ibge', { count: 'exact', head: true })
    .eq('ibge', body.municipio_ibge)

  if (!count) {
    return NextResponse.json({ error: 'Município não encontrado' }, { status: 404 })
  }

  // 3c. Dedup: impedir spam de geração para o mesmo município
  const { count: gerando } = await admin
    .from('diagnosticos')
    .select('id', { count: 'exact', head: true })
    .eq('municipio_ibge', body.municipio_ibge)
    .eq('status', 'gerando')

  if (gerando && gerando > 0) {
    return NextResponse.json(
      { error: 'Já existe um diagnóstico em geração para este município' },
      { status: 409 }
    )
  }

  // 4. Criar registro com status='gerando'
  const { data: diagnostico, error } = await admin
    .from('diagnosticos')
    .insert({
      municipio_ibge: body.municipio_ibge,
      gerado_por: user.id,
      status: 'gerando',
    })
    .select('id')
    .single()

  if (error || !diagnostico) {
    console.error('[POST /api/diagnostico] insert error:', error)
    return NextResponse.json({ error: 'Failed to create' }, { status: 500 })
  }

  // 5. Fire-and-forget — works on EasyPanel (Node.js always-on)
  generateDiagnostico(diagnostico.id, body.municipio_ibge).catch((err) =>
    console.error('[POST /api/diagnostico] generation error:', err)
  )

  return NextResponse.json({ id: diagnostico.id }, { status: 202 })
}
