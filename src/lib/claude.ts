// src/lib/claude.ts
import 'server-only'
import Anthropic from '@anthropic-ai/sdk'
import type { SecoesProjeto } from '@/types'

// Timeout set to 65s — generation takes 30–60s; 30s was too short and caused false errors.
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
  timeout: 65_000,
})

const MODEL = process.env.CLAUDE_MODEL ?? 'claude-sonnet-4-20250514'
const MAX_TOKENS = 4096

export async function gerarTexto(prompt: string): Promise<string> {
  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    messages: [{ role: 'user', content: prompt }],
  })

  if (!message.content.length) {
    throw new Error('Claude returned empty content')
  }
  if (message.stop_reason === 'max_tokens') {
    console.warn('[claude] resposta truncada em max_tokens=%d — considere aumentar MAX_TOKENS', MAX_TOKENS)
  }
  const block = message.content[0]
  if (block.type !== 'text') {
    throw new Error(`Unexpected Claude response type: ${block.type}`)
  }
  return block.text
}

export async function gerarDiagnostico(dados: {
  municipio: string
  uf: string
  programasCriticos: Array<{
    programa: string
    fundo: string
    valor_empenhado: number
    valor_pago: number
    percentual_execucao: number
    prazo_limite: string | null
  }>
  valorTotalEmRisco: number
}): Promise<string> {
  const programasFormatados = dados.programasCriticos
    .map(
      (p) =>
        `- ${p.programa} (${p.fundo}): ${p.percentual_execucao.toFixed(1)}% executado` +
        `, R$ ${(p.valor_empenhado - p.valor_pago).toLocaleString('pt-BR')} parado` +
        (p.prazo_limite ? `, prazo: ${p.prazo_limite}` : '')
    )
    .join('\n')

  const prompt = `Você é um especialista em gestão de recursos públicos municipais no Brasil.
Analise os dados de subexecução abaixo e gere um diagnóstico executivo para o gestor municipal.

MUNICÍPIO: ${dados.municipio} - ${dados.uf}
VALOR TOTAL EM RISCO: R$ ${dados.valorTotalEmRisco.toLocaleString('pt-BR')}

PROGRAMAS COM SUBEXECUÇÃO:
${programasFormatados}

Gere um diagnóstico em 4 blocos com linguagem direta, objetiva e politicamente inteligente:

1. SITUAÇÃO ATUAL (2-3 frases resumindo o cenário com os números reais)
2. O QUE ESTÁ EM RISCO (prazo, valor, impacto político — seja específico)
3. OPORTUNIDADE IDENTIFICADA (o que pode ser feito nos próximos 30-60 dias)
4. PRÓXIMO PASSO (ação específica e urgente — uma frase)

IMPORTANTE:
- Use os valores reais em reais
- Seja direto — fale como consultor experiente, não como burocracia
- O gestor tem pouco tempo — cada bloco máximo 3 frases
- Não use jargão técnico desnecessário
- DISCLAIMER ao final: "Este diagnóstico foi gerado por inteligência artificial e deve ser revisado por especialista antes de qualquer decisão."
`

  return gerarTexto(prompt)
}

export async function gerarProjeto(prompt: string): Promise<SecoesProjeto> {
  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 8192,
    messages: [{ role: 'user', content: prompt }],
  })
  if (message.stop_reason === 'max_tokens') {
    throw new Error('Claude response truncated — considerar max_tokens: 16384 para templates longos como CAPS')
  }
  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) ?? text.match(/(\{[\s\S]*\})/)
  if (!jsonMatch) throw new Error('Claude não retornou JSON válido para projeto')
  return JSON.parse(jsonMatch[1]) as SecoesProjeto
}

export async function gerarBriefingParlamentar(dados: {
  parlamentarNome: string
  totalEmendas: number
  valorEmRisco: number
  percentualExecutado: number
  emendaVencendoMaisUrgente: { municipio: string; prazo: string; valor: number } | null
  top5Municipios: Array<{ nome: string; score: number; justificativa: string }>
}): Promise<string> {
  const urgente = dados.emendaVencendoMaisUrgente
    ? `\nEMENDA MAIS URGENTE: ${dados.emendaVencendoMaisUrgente.municipio} — R$ ${dados.emendaVencendoMaisUrgente.valor.toLocaleString('pt-BR')}, prazo ${dados.emendaVencendoMaisUrgente.prazo}`
    : ''

  const top5 = dados.top5Municipios
    .map((m, i) => `${i + 1}. ${m.nome} (score ${m.score}/100) — ${m.justificativa}`)
    .join('\n')

  const prompt = `Você é um especialista em emendas parlamentares e política municipal no Brasil.
Gere um briefing político para o(a) parlamentar abaixo.

PARLAMENTAR: ${dados.parlamentarNome}
TOTAL DE EMENDAS INDIVIDUAIS: R$ ${dados.totalEmendas.toLocaleString('pt-BR')}
PERCENTUAL EXECUTADO: ${dados.percentualExecutado.toFixed(1)}%
VALOR EM RISCO DE DEVOLUÇÃO: R$ ${dados.valorEmRisco.toLocaleString('pt-BR')}${urgente}

TOP 5 MUNICÍPIOS RECOMENDADOS PARA DIRECIONAMENTO:
${top5}

Gere um briefing com 3 seções:

1. SITUAÇÃO DAS EMENDAS (estado atual, risco eleitoral, comparativo com pares)
2. MUNICÍPIOS PRIORITÁRIOS (argumento político para cada um do top 5)
3. AÇÕES PRÓXIMAS 30/60/90 DIAS (cronograma de ações específicas)

Tom: direto, orientado a resultado político, linguagem de assessoria parlamentar experiente.
Máximo 400 palavras no total.
DISCLAIMER ao final: "Gerado por inteligência artificial — revisar com equipe antes de usar."
`

  return gerarTexto(prompt)
}
