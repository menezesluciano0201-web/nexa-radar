import 'server-only'
import { renderToBuffer } from '@react-pdf/renderer'
import { createAdminClient } from '@/lib/supabase/admin'
import { ProjetoPDF } from './pdf/projeto-pdf'
import { gerarProjetoDocx } from './docx/projeto-docx'
import { gerarProjeto } from './claude'
import { gerarPromptProjeto } from './projeto'
import { getTemplate } from './templates'
import type { ProjetoInputs, TemplateName } from '@/types'

export async function generateProjeto(
  projetoId: string,
  diagnosticoId: string,
  template: TemplateName,
  inputs: ProjetoInputs
): Promise<void> {
  const supabase = createAdminClient()

  try {
    // 1. Buscar diagnóstico + município em paralelo — erros propagam para o catch
    const [{ data: diagnostico, error: diagError }, { data: municipio, error: munError }] = await Promise.all([
      supabase
        .from('diagnosticos')
        .select('municipio_ibge, programas_criticos')
        .eq('id', diagnosticoId)
        .single(),
      supabase
        .from('municipios_habilitacao')
        .select('nome')
        .eq('ibge', inputs.municipio_ibge)
        .single(),
    ])
    if (diagError) throw diagError
    if (munError) throw munError

    const municipioNome = municipio!.nome
    const programasCriticos = diagnostico!.programas_criticos ?? []

    // 2. Carregar TemplateConfig
    const config = getTemplate(template)

    // 3. Montar prompt e gerar via Claude
    const prompt = gerarPromptProjeto(config, inputs, municipioNome, programasCriticos)
    const secoes = await gerarProjeto(prompt)

    // 4. Gerar PDF e Word em paralelo
    const [pdfBuffer, docxBuffer] = await Promise.all([
      renderToBuffer(<ProjetoPDF config={config} secoes={secoes} municipioNome={municipioNome} inputs={inputs} />),
      gerarProjetoDocx(config, secoes, municipioNome, inputs),
    ])

    // 5. Upload PDF e Word em paralelo
    const pdfPath = `projeto-${projetoId}.pdf`
    const docxPath = `projeto-${projetoId}.docx`

    const [pdfUpload, docxUpload] = await Promise.all([
      supabase.storage.from('projetos').upload(pdfPath, pdfBuffer, { contentType: 'application/pdf' }),
      supabase.storage.from('projetos').upload(docxPath, docxBuffer, {
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      }),
    ])
    if (pdfUpload.error || docxUpload.error) throw pdfUpload.error ?? docxUpload.error

    // 6. Atualizar registro como rascunho
    await supabase.from('projetos').update({
      status: 'rascunho',
      secoes_ia: secoes,
      pdf_url: pdfPath,
      docx_url: docxPath,
    }).eq('id', projetoId)

  } catch (err) {
    console.error('[generateProjeto] erro:', err)
    await supabase.from('projetos').update({ status: 'erro' })
      .eq('id', projetoId)
      .eq('status', 'gerando')
  }
}
