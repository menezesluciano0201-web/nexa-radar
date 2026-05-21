// src/lib/generateBriefing.tsx
import 'server-only'
// Node.js only — server-only import above enforces this at build time.
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
    // 1. Buscar emendas (fetch first to derive the relevant IBGE codes)
    const { data: emendas, error: ee } = await admin
      .from('emendas_parlamentares')
      .select(
        'id,parlamentar_id,parlamentar_nome,tipo,parlamentar_tipo,municipio_ibge,area_tematica,valor_autorizado,valor_empenhado,valor_executado,percentual_execucao,prazo_limite,status_cauc,exercicio,fonte,coletado_em'
      )
      .eq('parlamentar_id', parlamentarId)
      .limit(5000)

    if (ee) throw ee

    const emendasList = (emendas ?? []) as EmendaParlamentar[]
    if (!emendasList.length) throw new Error(`Nenhuma emenda para parlamentar_id=${parlamentarId}`)
    if (emendasList.length >= 5000)
      console.warn('[generateBriefing] id=%s: emendas hit limit 5000 — data may be incomplete', id)

    // 2. Buscar apenas os municípios relevantes (unique IBGE codes in the parlamentar's emendas)
    const ibgeCodes = [...new Set(emendasList.filter(e => e.municipio_ibge).map(e => e.municipio_ibge!))]
    const { data: municipios, error: me } = ibgeCodes.length > 0
      ? await admin
          .from('municipios_habilitacao')
          .select('ibge,nome,uf,populacao,idh,cauc_regular,ultima_verificacao,programas_habilitados,programas_bloqueados')
          .in('ibge', ibgeCodes)
          .limit(500)
      : { data: [], error: null }
    if ((municipios?.length ?? 0) >= 500)
      console.warn('[generateBriefing] id=%s: municipios hit limit 500 — some IBGE codes may be missing from scoring', id)

    if (me) throw me

    const municipiosList = (municipios ?? []) as MunicipioHabilitacao[]
    if (!municipiosList.length) console.warn('[generateBriefing] id=%s: nenhum município encontrado em municipios_habilitacao — top5 será []', id)

    const parlamentarNome = emendasList[0].parlamentar_nome ?? parlamentarId
    if (!emendasList[0].parlamentar_nome)
      console.warn('[generateBriefing] id=%s: parlamentar_nome is null, using ID as display name', id)

    // 3. Calcular risco e scores
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

    // 4. Gerar texto com Claude
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

    // 5. Gerar PDF
    // Shift to BRT (UTC-3, Brazil Standard Time — no DST since 2019) before formatting.
    const pad = (n: number) => String(n).padStart(2, '0')
    const brt = new Date(Date.now() - 3 * 60 * 60 * 1000)
    const geradoEm = `${pad(brt.getUTCDate())}/${pad(brt.getUTCMonth() + 1)}/${brt.getUTCFullYear()} ${pad(brt.getUTCHours())}:${pad(brt.getUTCMinutes())}`

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

    // 6. Upload para Storage
    const filename = `briefing-${id}.pdf`
    const { error: uploadError } = await admin.storage
      .from('relatorios')
      .upload(filename, pdfBuffer, { contentType: 'application/pdf', upsert: true })

    if (uploadError) throw uploadError

    // 7. Atualizar registro
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
