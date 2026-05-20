// src/lib/generateBriefing.tsx
// Node.js only — never import in browser or Edge runtime.
import { renderToBuffer } from '@react-pdf/renderer'
import React from 'react'
import type { DocumentProps } from '@react-pdf/renderer'
import { createAdminClient } from '@/lib/supabase/admin'
import { calcularRiscoBriefing, calcularScoresMunicipios } from '@/lib/briefing'
import { gerarBriefingParlamentar } from '@/lib/claude'
import { BriefingPDF } from '@/lib/pdf/briefing-pdf'
import type { EmendaParlamentar, MunicipioHabilitacao } from '@/types'

export async function generateBriefing(
  id: string,
  parlamentarId: string
): Promise<void> {
  const admin = createAdminClient()

  try {
    // 1. Buscar emendas e municípios em paralelo
    const [{ data: emendas, error: ee }, { data: municipios, error: me }] =
      await Promise.all([
        admin
          .from('emendas_parlamentares')
          .select(
            'id,parlamentar_id,parlamentar_nome,tipo,parlamentar_tipo,municipio_ibge,area_tematica,valor_autorizado,valor_empenhado,valor_executado,percentual_execucao,prazo_limite,status_cauc,exercicio,fonte,coletado_em'
          )
          .eq('parlamentar_id', parlamentarId),
        admin
          .from('municipios_habilitacao')
          .select('ibge,nome,uf,populacao,idh,cauc_regular,ultima_verificacao,programas_habilitados,programas_bloqueados'),
      ])

    if (ee) throw ee
    if (me) throw me

    const emendasList = (emendas ?? []) as EmendaParlamentar[]
    const municipiosList = (municipios ?? []) as MunicipioHabilitacao[]

    if (!emendasList.length) throw new Error(`Nenhuma emenda para parlamentar_id=${parlamentarId}`)
    if (!municipiosList.length) console.warn(`[generateBriefing] id=${id}: municipios_habilitacao vazio — top5 será []`)

    const parlamentarNome = emendasList[0].parlamentar_nome ?? parlamentarId

    // 2. Calcular risco e scores
    const risco = calcularRiscoBriefing(emendasList)
    const top5 = calcularScoresMunicipios(emendasList, municipiosList)

    // Resolve IBGE code to name so Claude receives "Lagarto" not "2803500"
    const munNomeMap = new Map(municipiosList.map((m) => [m.ibge, `${m.nome} - ${m.uf}`]))
    const urgente = risco.emendaVencendoMaisUrgente
      ? {
          ...risco.emendaVencendoMaisUrgente,
          municipio: munNomeMap.get(risco.emendaVencendoMaisUrgente.municipio) ?? risco.emendaVencendoMaisUrgente.municipio,
        }
      : null

    // 3. Gerar texto com Claude
    const textoIA = await gerarBriefingParlamentar({
      parlamentarNome,
      totalEmendas: risco.valorTotalEmendas,
      valorEmRisco: risco.valorEmRisco,
      percentualExecutado: risco.percentualExecutado,
      emendaVencendoMaisUrgente: urgente,
      top5Municipios: top5.map((m) => ({
        nome: m.nome,
        score: m.score_total,
        justificativa: m.justificativa,
      })),
    })

    // 4. Gerar PDF
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const geradoEm = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`

    const pdfBuffer = await renderToBuffer(
      React.createElement(BriefingPDF, {
        parlamentarNome,
        valorTotalEmendas: risco.valorTotalEmendas,
        valorEmRisco: risco.valorEmRisco,
        percentualExecutado: risco.percentualExecutado,
        top5Municipios: top5,
        textoIA,
        geradoEm,
      }) as React.ReactElement<DocumentProps>
    )

    // 5. Upload para Storage
    const filename = `briefing-${id}.pdf`
    const { error: uploadError } = await admin.storage
      .from('relatorios')
      .upload(filename, pdfBuffer, { contentType: 'application/pdf', upsert: true })

    if (uploadError) throw uploadError

    // 6. Atualizar registro
    const { error: updateError } = await admin
      .from('briefings')
      .update({
        status: 'rascunho',
        texto_ia: textoIA,
        pdf_url: filename,
        valor_total_emendas: risco.valorTotalEmendas,
        valor_em_risco: risco.valorEmRisco,
        municipios_recomendados: top5,
      })
      .eq('id', id)

    if (updateError) throw updateError
  } catch (err) {
    const msg = err instanceof Error ? err.message : JSON.stringify(err)
    console.error(`[generateBriefing] id=${id}: ${msg}`)
    await admin
      .from('briefings')
      .update({ status: 'erro' })
      .eq('id', id)
      .eq('status', 'gerando')
      .then(() => {}, (e) => console.error('[generateBriefing] falha ao marcar erro id=%s: %s', id, e instanceof Error ? e.message : JSON.stringify(e)))
  }
}
