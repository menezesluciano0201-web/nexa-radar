// src/app/api/projeto/route.ts
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateProjeto } from '@/lib/generateProjeto'
import { validarInputsProjeto } from '@/lib/projeto'
import { getTemplate } from '@/lib/templates'
import type { TemplateConfig, TemplateName } from '@/types'

export async function POST(req: Request) {
  // Auth check via user-scoped client
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('tipo').eq('id', user.id).single()
  if (!profile || profile.tipo !== 'admin')
    return NextResponse.json({ error: 'Proibido' }, { status: 403 })

  const body = await req.json()
  const {
    diagnostico_id, template, objeto, justificativa,
    num_beneficiarios, valor_solicitado, valor_contrapartida,
    prazo_meses, oscip_executora, capacidade_instalada, campos_extras
  } = body

  if (!diagnostico_id || typeof diagnostico_id !== 'string') {
    return NextResponse.json({ error: 'diagnostico_id obrigatório' }, { status: 400 })
  }

  const templateName = template as TemplateName
  let config: TemplateConfig
  try {
    config = getTemplate(templateName)
  } catch {
    return NextResponse.json({ error: `Template inválido: ${template}` }, { status: 400 })
  }

  // Todas as operações de dados via service role
  const admin = createAdminClient()

  const { data: diagnostico, error: diagError } = await admin
    .from('diagnosticos')
    .select('municipio_ibge')
    .eq('id', diagnostico_id)
    .single()

  if (diagError || !diagnostico) {
    return NextResponse.json({ error: 'Diagnóstico não encontrado' }, { status: 404 })
  }

  const municipio_ibge = diagnostico.municipio_ibge

  const inputs = {
    diagnostico_id, municipio_ibge, template: templateName,
    objeto, justificativa, num_beneficiarios, valor_solicitado,
    valor_contrapartida, prazo_meses, oscip_executora,
    capacidade_instalada, campos_extras: campos_extras ?? {},
  }

  const validation = validarInputsProjeto(inputs, config)
  if (!validation.valid) {
    return NextResponse.json({ error: validation.errors.join('; ') }, { status: 400 })
  }

  const { data: projeto, error: insertError } = await admin
    .from('projetos')
    .insert({
      diagnostico_id,
      municipio_ibge,
      gerado_por: user.id,
      template: templateName,
      objeto, justificativa, num_beneficiarios, valor_solicitado,
      valor_contrapartida, prazo_meses, oscip_executora,
      capacidade_instalada, campos_extras,
      status: 'gerando',
    })
    .select('id')
    .single()

  if (insertError) {
    if (insertError.code === '23505') {
      return NextResponse.json(
        { error: `Já existe uma geração em andamento para ${municipio_ibge}/${template}` },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  generateProjeto(projeto.id, diagnostico_id, templateName, inputs).catch(console.error)

  return NextResponse.json({ id: projeto.id }, { status: 202 })
}
