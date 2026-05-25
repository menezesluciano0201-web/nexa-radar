import { describe, test, expect } from 'vitest'
import { validarInputsProjeto, calcularOrcamentoBase, gerarPromptProjeto } from '@/lib/projeto'
import type { TemplateConfig, ProjetoInputs, TemplateName } from '@/types'

// Mock TemplateConfig mínimo — independente dos templates reais (Task 2)
const mockConfig: TemplateConfig = {
  nome: 'Mock Template',
  orgao: 'Órgão Mock',
  fundo: 'Fundo Mock',
  camposEspecificos: [
    { nome: 'campo_obrigatorio', label: 'Campo', tipo: 'text', obrigatorio: true },
    { nome: 'campo_opcional', label: 'Opcional', tipo: 'text', obrigatorio: false },
  ],
  secoes: [
    { id: 'objeto', titulo: 'Objeto', obrigatoria: true, instrucoes: 'Instrução do objeto aqui.' },
    { id: 'justificativa', titulo: 'Justificativa', obrigatoria: true, instrucoes: 'Instrução da justificativa.' },
  ],
  indicadores: ['Indicador 1', 'Indicador 2'],
  rubricas: [
    { codigo: '3.3.90.36', descricao: 'Rubrica A', percentualMaximo: 0.60 },
    { codigo: '3.3.90.30', descricao: 'Rubrica B', percentualMaximo: 0.40 },
  ],
  declaracoesObrigatorias: ['Declaração 1'],
  promptInstrucoes: 'Contexto geral do órgão mock.',
  disclaimer: 'Disclaimer mock.',
}

function makeInputs(overrides: Partial<ProjetoInputs> = {}): ProjetoInputs {
  return {
    diagnostico_id: 'diag-uuid-123',
    municipio_ibge: '2803500',
    template: 'scfv' as TemplateName,
    objeto: 'Objeto do projeto',
    justificativa: 'Justificativa detalhada',
    num_beneficiarios: 100,
    valor_solicitado: 200_000,
    valor_contrapartida: 20_000,
    prazo_meses: 12,
    capacidade_instalada: 'Estrutura existente',
    campos_extras: { campo_obrigatorio: 'valor preenchido' },
    ...overrides,
  }
}

describe('validarInputsProjeto', () => {
  test('retorna válido com inputs corretos', () => {
    const result = validarInputsProjeto(makeInputs(), mockConfig)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  test('erro quando objeto está vazio', () => {
    const result = validarInputsProjeto(makeInputs({ objeto: '' }), mockConfig)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('objeto'))).toBe(true)
  })

  test('erro quando valor_solicitado <= 0', () => {
    const result = validarInputsProjeto(makeInputs({ valor_solicitado: 0 }), mockConfig)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('valor_solicitado'))).toBe(true)
  })

  test('erro quando prazo_meses fora de 1–60', () => {
    expect(validarInputsProjeto(makeInputs({ prazo_meses: 0 }), mockConfig).valid).toBe(false)
    expect(validarInputsProjeto(makeInputs({ prazo_meses: 61 }), mockConfig).valid).toBe(false)
    expect(validarInputsProjeto(makeInputs({ prazo_meses: 1 }), mockConfig).valid).toBe(true)
    expect(validarInputsProjeto(makeInputs({ prazo_meses: 60 }), mockConfig).valid).toBe(true)
  })

  test('erro quando campo obrigatório de campos_extras está ausente', () => {
    const result = validarInputsProjeto(makeInputs({ campos_extras: {} }), mockConfig)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('campo_obrigatorio'))).toBe(true)
  })

  test('campos_extras opcional ausente não gera erro', () => {
    const inputs = makeInputs({ campos_extras: { campo_obrigatorio: 'ok' } })
    const result = validarInputsProjeto(inputs, mockConfig)
    expect(result.valid).toBe(true)
  })
})

describe('calcularOrcamentoBase', () => {
  test('soma das rubricas igual a valor_solicitado', () => {
    const itens = calcularOrcamentoBase(mockConfig, 200_000, 12)
    const soma = itens.reduce((acc, i) => acc + i.valor, 0)
    expect(Math.abs(soma - 200_000)).toBeLessThanOrEqual(0.01)
  })

  test('nenhuma rubrica ultrapassa percentualMaximo', () => {
    const itens = calcularOrcamentoBase(mockConfig, 200_000, 12)
    for (const item of itens) {
      const rubrica = mockConfig.rubricas.find(r => r.codigo === item.rubrica)
      if (rubrica?.percentualMaximo) {
        expect(item.valor).toBeLessThanOrEqual(rubrica.percentualMaximo * 200_000 + 0.01)
      }
    }
  })

  test('retorna um item por rubrica do template', () => {
    const itens = calcularOrcamentoBase(mockConfig, 100_000, 6)
    expect(itens).toHaveLength(mockConfig.rubricas.length)
  })
})

describe('gerarPromptProjeto', () => {
  test('prompt contém nome do município', () => {
    const prompt = gerarPromptProjeto(mockConfig, makeInputs(), 'Lagarto', [])
    expect(prompt).toContain('Lagarto')
  })

  test('prompt contém nome do órgão', () => {
    const prompt = gerarPromptProjeto(mockConfig, makeInputs(), 'Lagarto', [])
    expect(prompt).toContain('Órgão Mock')
  })

  test('prompt contém ao menos um indicador do template', () => {
    const prompt = gerarPromptProjeto(mockConfig, makeInputs(), 'Lagarto', [])
    expect(prompt).toContain('Indicador 1')
  })

  test('prompt contém instrucoes da primeira seção', () => {
    const prompt = gerarPromptProjeto(mockConfig, makeInputs(), 'Lagarto', [])
    expect(prompt).toContain('Instrução do objeto aqui.')
  })

  test('prompt contém promptInstrucoes do template', () => {
    const prompt = gerarPromptProjeto(mockConfig, makeInputs(), 'Lagarto', [])
    expect(prompt).toContain('Contexto geral do órgão mock.')
  })
})
