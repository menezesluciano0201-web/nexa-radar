import type { TemplateConfig, ProjetoInputs, ValidationResult, ItemOrcamento } from '@/types'

export function validarInputsProjeto(
  inputs: ProjetoInputs,
  config: TemplateConfig
): ValidationResult {
  const errors: string[] = []

  if (!inputs.objeto?.trim()) errors.push('objeto é obrigatório')
  if (!inputs.justificativa?.trim()) errors.push('justificativa é obrigatória')
  if (!inputs.capacidade_instalada?.trim()) errors.push('capacidade_instalada é obrigatória')
  if (!inputs.num_beneficiarios || inputs.num_beneficiarios <= 0)
    errors.push('num_beneficiarios deve ser maior que 0')
  if (!inputs.valor_solicitado || inputs.valor_solicitado <= 0)
    errors.push('valor_solicitado deve ser maior que 0')
  if (!inputs.prazo_meses || inputs.prazo_meses < 1 || inputs.prazo_meses > 60)
    errors.push('prazo_meses deve estar entre 1 e 60')

  for (const campo of config.camposEspecificos) {
    if (campo.obrigatorio) {
      const val = inputs.campos_extras?.[campo.nome]
      if (val === undefined || val === null || val === '' ||
          (Array.isArray(val) && val.length === 0)) {
        errors.push(`campo obrigatório ausente: ${campo.nome}`)
      }
    }
  }

  return { valid: errors.length === 0, errors }
}

export function calcularOrcamentoBase(
  config: TemplateConfig,
  valor: number,
  _prazo: number
): ItemOrcamento[] {
  const rubricas = config.rubricas
  if (rubricas.length === 0) return []

  const maximos = rubricas.map(r => r.percentualMaximo ?? 1)
  const totalMax = maximos.reduce((a, b) => a + b, 0)

  const itens: ItemOrcamento[] = rubricas.map((r, i) => ({
    rubrica: r.codigo,
    descricao: r.descricao,
    valor: Math.floor((maximos[i] / totalMax) * valor * 100) / 100,
  }))

  // Ajuste de arredondamento: soma dos centavos deve fechar exatamente
  const soma = itens.reduce((acc, i) => acc + i.valor, 0)
  const diff = Math.round((valor - soma) * 100) / 100
  if (diff !== 0 && itens.length > 0) {
    itens[0] = { ...itens[0], valor: Math.round((itens[0].valor + diff) * 100) / 100 }
  }

  return itens
}

export function gerarPromptProjeto(
  config: TemplateConfig,
  inputs: ProjetoInputs,
  municipioNome: string,
  programasCriticos: Array<{ nome: string; valor_em_risco: number }>
): string {
  const secoesPrompt = config.secoes.map(s =>
    `### Seção: ${s.titulo}\n${s.instrucoes}\nGere o conteúdo desta seção agora.`
  ).join('\n\n')

  const programasStr = programasCriticos.length > 0
    ? `Programas críticos do município: ${programasCriticos.map(p => `${p.nome} (R$ ${p.valor_em_risco.toLocaleString('pt-BR')} em risco)`).join(', ')}`
    : 'Sem programas críticos identificados no diagnóstico.'

  return `${config.promptInstrucoes}

## Dados do Projeto

Município: ${municipioNome} (IBGE: ${inputs.municipio_ibge})
Órgão: ${config.orgao}
Fundo: ${config.fundo}
Template: ${config.nome}
Objeto declarado: ${inputs.objeto}
Justificativa declarada: ${inputs.justificativa}
Número de beneficiários: ${inputs.num_beneficiarios}
Valor solicitado: R$ ${inputs.valor_solicitado.toLocaleString('pt-BR')}
Contrapartida: R$ ${inputs.valor_contrapartida.toLocaleString('pt-BR')}
Prazo: ${inputs.prazo_meses} meses
OSCIP executora: ${inputs.oscip_executora ?? 'não informada'}
Capacidade instalada: ${inputs.capacidade_instalada}
Campos específicos: ${JSON.stringify(inputs.campos_extras, null, 2)}

${programasStr}

## Indicadores aceitos pelo órgão
${config.indicadores.map(i => `- ${i}`).join('\n')}

## Rubricas orçamentárias permitidas
${config.rubricas.map(r => `- ${r.codigo}: ${r.descricao}${r.percentualMaximo ? ` (máx. ${r.percentualMaximo * 100}%)` : ''}`).join('\n')}

## Declarações obrigatórias a incluir
${config.declaracoesObrigatorias.map(d => `- ${d}`).join('\n')}

## Disclaimer obrigatório
${config.disclaimer}

---

Gere o projeto completo em JSON com a seguinte estrutura:
\`\`\`json
{
  "metas_fisicas": [{ "trimestre": 1, "meta": "...", "quantidade": 0 }],
  "indicadores": [{ "nome": "...", "formula": "...", "meta": "..." }],
  "cronograma": [{ "etapa": "...", "mes_inicio": 1, "mes_fim": 3 }],
  "orcamento": [{ "rubrica": "3.3.90.36", "descricao": "...", "valor": 0 }],
  "declaracoes": ["..."],
  "secoes_texto": {
    ${config.secoes.map(s => `"${s.id}": "..."`).join(',\n    ')}
  }
}
\`\`\`

${secoesPrompt}

Retorne APENAS o JSON, sem texto adicional antes ou depois.`
}
