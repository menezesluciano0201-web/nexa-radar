// src/lib/generateDiagnostico.tsx
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

function brl(value: number) {
  return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
}

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
          .select('*')
          .eq('municipio_ibge', municipioIbge),
        admin
          .from('municipios_habilitacao')
          .select('nome, uf')
          .eq('ibge', municipioIbge)
          .single(),
      ])

    if (te) throw te
    if (me || !municipio) throw me ?? new Error(`Município ${municipioIbge} não encontrado`)

    // 2. Computar programas críticos e risco
    const programasCriticos = identificarProgramasCriticos(
      (transferencias ?? []) as TransferenciaFederal[]
    )
    const { valorTotalIdentificado, valorEmRisco } = calcularRisco(programasCriticos)

    // 3. Gerar texto com Claude (15-30s)
    const textoIA = await gerarDiagnostico({
      municipio: municipio.nome,
      uf: municipio.uf,
      programasCriticos,
      valorTotalEmRisco: valorEmRisco,
    })

    // 4. Gerar PDF buffer
    const geradoEm = new Date().toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })

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

    const {
      data: { publicUrl },
    } = admin.storage.from('relatorios').getPublicUrl(filename)

    // 6. Ações recomendadas (top 5 programas)
    const acoes = programasCriticos.slice(0, 5).map(
      (p) =>
        `Regularizar execução de ${p.programa}: ${brl(p.valor_empenhado - p.valor_pago)} parado`
    )

    // 7. Atualizar registro diagnosticos
    const { error: updateError } = await admin
      .from('diagnosticos')
      .update({
        status: 'rascunho',
        texto_ia: textoIA,
        pdf_url: publicUrl,
        valor_total_identificado: valorTotalIdentificado,
        valor_em_risco: valorEmRisco,
        programas_criticos: programasCriticos,
        acoes_recomendadas: acoes,
      })
      .eq('id', id)

    if (updateError) throw updateError
  } catch (err) {
    console.error(`[generateDiagnostico] id=${id}:`, err)
    await admin
      .from('diagnosticos')
      .update({ status: 'erro' })
      .eq('id', id)
      .then(() => {}, () => {})
  }
}
