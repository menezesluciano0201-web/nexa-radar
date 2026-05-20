// src/app/api/briefing/route.ts
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateBriefing } from '@/lib/generateBriefing'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('tipo').eq('id', user.id).single()
  if (!profile || profile.tipo !== 'admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: { parlamentar_id?: string }
  try { body = await request.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }) }

  if (!body.parlamentar_id)
    return NextResponse.json({ error: 'parlamentar_id required' }, { status: 400 })
  if (body.parlamentar_id.length > 50)
    return NextResponse.json({ error: 'parlamentar_id too long' }, { status: 400 })

  const admin = createAdminClient()

  // Verificar que existem emendas para este parlamentar
  const { count: emendasCount } = await admin
    .from('emendas_parlamentares')
    .select('id', { count: 'exact', head: true })
    .eq('parlamentar_id', body.parlamentar_id)

  if (!emendasCount)
    return NextResponse.json({ error: 'Parlamentar não encontrado ou sem emendas' }, { status: 404 })

  // Dedup: impedir geração simultânea para o mesmo parlamentar
  const { count: gerando } = await admin
    .from('briefings')
    .select('id', { count: 'exact', head: true })
    .eq('parlamentar_id', body.parlamentar_id)
    .eq('status', 'gerando')

  if (gerando && gerando > 0)
    return NextResponse.json(
      { error: 'Já existe um briefing em geração para este parlamentar' },
      { status: 409 }
    )

  const { data: briefing, error } = await admin
    .from('briefings')
    .insert({
      parlamentar_id: body.parlamentar_id,
      gerado_por: user.id,
      status: 'gerando',
    })
    .select('id')
    .single()

  if (error || !briefing) {
    console.error('[POST /api/briefing] insert error:', error)
    return NextResponse.json({ error: 'Failed to create' }, { status: 500 })
  }

  generateBriefing(briefing.id, body.parlamentar_id).catch((err) =>
    console.error('[POST /api/briefing] generation error:', err)
  )

  return NextResponse.json({ id: briefing.id }, { status: 202 })
}
