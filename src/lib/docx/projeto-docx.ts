import 'server-only'
import {
  Document, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, Packer, WidthType,
} from 'docx'
import type { TemplateConfig, SecoesProjeto, ProjetoInputs } from '@/types'

function heading(text: string, level: (typeof HeadingLevel)[keyof typeof HeadingLevel] = HeadingLevel.HEADING_2) {
  return new Paragraph({ text, heading: level, spacing: { before: 300, after: 100 } })
}

function body(text: string) {
  return new Paragraph({
    children: [new TextRun({ text, size: 22 })],
    alignment: AlignmentType.JUSTIFIED,
    spacing: { before: 80, after: 80 },
  })
}

function tableRow(cells: string[], isHeader = false) {
  return new TableRow({
    children: cells.map(c => new TableCell({
      children: [new Paragraph({
        children: [new TextRun({ text: c, bold: isHeader, size: 18 })],
      })],
      width: { size: 100 / cells.length, type: WidthType.PERCENTAGE },
    })),
  })
}

export async function gerarProjetoDocx(
  config: TemplateConfig,
  secoes: SecoesProjeto,
  municipioNome: string,
  inputs: ProjetoInputs
): Promise<Buffer> {
  const children: (Paragraph | Table)[] = []

  // Capa
  children.push(
    new Paragraph({ text: config.nome, heading: HeadingLevel.HEADING_1, spacing: { after: 200 } }),
    body(`Município: ${municipioNome} | Órgão: ${config.orgao} | Fundo: ${config.fundo}`),
    body(`Valor solicitado: R$ ${inputs.valor_solicitado.toLocaleString('pt-BR')} | Prazo: ${inputs.prazo_meses} meses | Beneficiários: ${inputs.num_beneficiarios}`),
    new Paragraph({ text: '', spacing: { after: 200 } }),
  )

  // Seções narrativas
  for (const s of config.secoes) {
    const texto = secoes.secoes_texto?.[s.id]
    if (!texto) continue
    children.push(heading(s.titulo))
    children.push(body(texto))
  }

  // Metas físicas
  if (secoes.metas_fisicas?.length > 0) {
    children.push(heading('Metas Físicas'))
    children.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        tableRow(['Trimestre', 'Meta', 'Quantidade'], true),
        ...secoes.metas_fisicas.map(m => tableRow([`${m.trimestre}º`, m.meta, String(m.quantidade)])),
      ],
    }))
  }

  // Indicadores
  if (secoes.indicadores?.length > 0) {
    children.push(heading('Indicadores de Monitoramento'))
    children.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        tableRow(['Indicador', 'Fórmula', 'Meta'], true),
        ...secoes.indicadores.map(i => tableRow([i.nome, i.formula, i.meta])),
      ],
    }))
  }

  // Cronograma
  if (secoes.cronograma?.length > 0) {
    children.push(heading('Cronograma de Execução'))
    children.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        tableRow(['Etapa', 'Mês Início', 'Mês Fim'], true),
        ...secoes.cronograma.map(c => tableRow([c.etapa, `Mês ${c.mes_inicio}`, `Mês ${c.mes_fim}`])),
      ],
    }))
  }

  // Orçamento
  if (secoes.orcamento?.length > 0) {
    children.push(heading('Plano de Aplicação / Orçamento'))
    const total = secoes.orcamento.reduce((a, o) => a + o.valor, 0)
    children.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        tableRow(['Rubrica', 'Descrição', 'Valor (R$)'], true),
        ...secoes.orcamento.map(o => tableRow([o.rubrica, o.descricao, o.valor.toLocaleString('pt-BR')])),
        tableRow(['', 'TOTAL', total.toLocaleString('pt-BR')], true),
      ],
    }))
  }

  // Declarações
  if (secoes.declaracoes?.length > 0) {
    children.push(heading('Declarações'))
    for (const d of secoes.declaracoes) children.push(body(`• ${d}`))
  }

  // Disclaimer
  children.push(new Paragraph({ text: '', spacing: { before: 400 } }))
  children.push(new Paragraph({
    children: [new TextRun({ text: config.disclaimer, size: 16, italics: true, color: '92400e' })],
    spacing: { before: 100, after: 100 },
  }))

  const doc = new Document({
    sections: [{ children }],
  })

  return Packer.toBuffer(doc)
}
