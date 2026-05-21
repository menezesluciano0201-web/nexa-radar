// src/lib/generateDiagnostico.tsx
import 'server-only'
// Node.js only — never import in browser or Edge runtime.
// Used by /api/diagnostico route.ts via fire-and-forget.
import { renderToBuffer } from '@react-pdf/renderer'
import type { DocumentProps } from '@react-pdf/renderer'
import React from 'react'
import { createAdminClient } from '@/lib/supabase/admin'
import { identificarProgramasCriticos, calcularRisco } from '@/lib/diagnostico'
import { gerarDiagnostico } from '@/lib/claude'
import { DiagnosticoPDF } from '@/lib/pdf/diagnostico-pdf'
import type { TransferenciaFederal } from '@/types'
import { brl } from '@/lib/format'

export async function generateDiagnostico(
  id: string,
  municipioIbge: string
): Promise<void> {
  const admin = createAdminClient()

  try {
    // 1. Buscar transferências e dados do município em paralelo
    const [{ data: transferencias, error: te }, { data: municipio, error: me }] =
      await Promise.all([
        admin
          .from('transferencias_federais')
          .select('id,municipio_ibge,programa,fundo,valor_empenhado,valor_liquidado,valor_pago,percentual_execucao,competencia,prazo_limite,fonte,coletado_em')
          .eq('municipio_ibge', municipioIbge)
          .limit(5000),
        admin
          .from('municipios_habilitacao')
          .select('nome, uf')
          .eq('ibge', municipioIbge)
          .single(),
      ])

    if (te) throw te
    if (me) throw me
    if (!municipio) throw new Error(`Município ${municipioIbge} não encontrado`)

    if ((transferencias?.length ?? 0) >= 5000)
      console.warn('[generateDiagnostico] id=%s: transferencias hit limit 5000 — data may be incomplete', id)

    // 2. Computar programas críticos e risco
    const allCriticos = identificarProgramasCriticos(
      (transferencias ?? []) as TransferenciaFederal[]
    )
    if ((transferencias?.length ?? 0) > 0 && allCriticos.length === 0)
      console.warn('[generateDiagnostico] id=%s: nenhum programa crítico identificado', id)
    const programasCriticos = allCriticos
    const { valorTotalIdentificado, valorEmRisco } = calcularRisco(programasCriticos)

    // 3. Gerar texto com Claude (15-30s)
    const textoIA = await gerarDiagnostico({
      municipio: municipio.nome,
      uf: municipio.uf,
      programasCriticos,
      valorTotalEmRisco: valorEmRisco,
    })

    // 4. Gerar PDF buffer
    // Manual format avoids ICU dependency (minimal Node.js builds may lack full pt-BR locale).
    // Shift to BRT (UTC-3, Brazil Standard Time — no DST since 2019) before formatting.
    const pad = (n: number) => String(n).padStart(2, '0')
    const brt = new Date(Date.now() - 3 * 60 * 60 * 1000)
    const geradoEm = `${pad(brt.getUTCDate())}/${pad(brt.getUTCMonth() + 1)}/${brt.getUTCFullYear()} ${pad(brt.getUTCHours())}:${pad(brt.getUTCMinutes())}`

    const pdfBuffer = await renderToBuffer(
      React.createElement(DiagnosticoPDF, {
        municipioNome: municipio.nome,
        uf: municipio.uf,
        valorTotalIdentificado,
        valorEmRisco,
        programasCriticos,
        textoIA,
        geradoEm,
      }) as React.ReactElement<DocumentProps>
    )

    // 5. Upload para Supabase Storage
    const filename = `diagnostico-${id}.pdf`
    const { error: uploadError } = await admin.storage
      .from('relatorios')
      .upload(filename, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true,
      })

    if (uploadError) throw uploadError

    // 6. Ações recomendadas (top 5 programas)
    const acoes = programasCriticos.slice(0, 5).map(
      (p) =>
        `Regularizar execução de ${p.programa}: ${brl(Math.max(0, p.valor_empenhado - p.valor_pago), 2)} parado`
    )

    // 7. Atualizar registro diagnosticos — armazena path (não URL pública, bucket é privado)
    const { error: updateError } = await admin
      .from('diagnosticos')
      .update({
        status: 'rascunho',
        texto_ia: textoIA,
        pdf_url: filename,
        valor_total_identificado: valorTotalIdentificado,
        valor_em_risco: valorEmRisco,
        programas_criticos: programasCriticos,
        acoes_recomendadas: acoes,
      })
      .eq('id', id)

    if (updateError) throw updateError
  } catch (err) {
    const msg = err instanceof Error ? err.message : JSON.stringify(err)
    console.error(`[generateDiagnostico] id=${id}: ${msg}`)
    // Só marca erro se ainda estiver 'gerando' — evita sobrescrever uma conclusão bem-sucedida
    await admin
      .from('diagnosticos')
      .update({ status: 'erro' })
      .eq('id', id)
      .eq('status', 'gerando')
      .then(() => {}, (e) => console.error('[generateDiagnostico] falha ao marcar erro id=%s: %s', id, e instanceof Error ? e.message : JSON.stringify(e)))
  }
}
