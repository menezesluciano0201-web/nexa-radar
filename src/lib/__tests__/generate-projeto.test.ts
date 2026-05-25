import { describe, test, expect, vi, beforeEach } from 'vitest'

// Mocks devem ser declarados ANTES dos imports do módulo testado
vi.mock('server-only', () => ({}))
vi.mock('@/lib/claude', () => ({
  gerarProjeto: vi.fn(),
}))
vi.mock('@react-pdf/renderer', () => ({
  renderToBuffer: vi.fn(),
}))
vi.mock('@/lib/pdf/projeto-pdf', () => ({ ProjetoPDF: () => null }))
vi.mock('@/lib/docx/projeto-docx', () => ({
  gerarProjetoDocx: vi.fn(),
}))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}))

import { gerarProjeto } from '@/lib/claude'
import { renderToBuffer } from '@react-pdf/renderer'
import { gerarProjetoDocx } from '@/lib/docx/projeto-docx'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateProjeto } from '@/lib/generateProjeto'
import type { SecoesProjeto, TemplateName } from '@/types'

const mockSecoes: SecoesProjeto = {
  metas_fisicas: [{ trimestre: 1, meta: 'Meta teste', quantidade: 50 }],
  indicadores: [{ nome: 'Ind. 1', formula: 'n/total', meta: '100%' }],
  cronograma: [{ etapa: 'Etapa 1', mes_inicio: 1, mes_fim: 3 }],
  orcamento: [{ rubrica: '3.3.90.36', descricao: 'Facilitadores', valor: 120000 }],
  declaracoes: ['Declaração 1'],
  secoes_texto: { objeto: 'Texto objeto', justificativa: 'Texto justificativa' },
}

const mockInputs = {
  diagnostico_id: 'diag-uuid',
  municipio_ibge: '2803500',
  template: 'scfv' as TemplateName,
  objeto: 'Objeto do projeto',
  justificativa: 'Justificativa',
  num_beneficiarios: 100,
  valor_solicitado: 200_000,
  valor_contrapartida: 20_000,
  prazo_meses: 12,
  capacidade_instalada: 'Boa estrutura',
  campos_extras: { faixas_etarias: ['criança (0-12)'] },
}

function makeSupabaseMock(updatePayloads: object[]) {
  const updateFn = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    }),
  })

  return {
    from: vi.fn((table: string) => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue(
            table === 'diagnosticos'
              ? { data: { municipio_ibge: '2803500', programas_criticos: [] }, error: null }
              : { data: { nome: 'Lagarto' }, error: null }
          ),
        }),
      }),
      update: vi.fn((payload: object) => {
        updatePayloads.push(payload)
        return updateFn()
      }),
    })),
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn().mockResolvedValue({ error: null }),
      })),
    },
  }
}

describe('generateProjeto', () => {
  beforeEach(() => vi.clearAllMocks())

  test('happy path: updatePayloads contém status rascunho com pdf_url e docx_url', async () => {
    const updatePayloads: object[] = []
    ;(createAdminClient as ReturnType<typeof vi.fn>).mockReturnValue(makeSupabaseMock(updatePayloads))
    ;(gerarProjeto as ReturnType<typeof vi.fn>).mockResolvedValue(mockSecoes)
    ;(renderToBuffer as ReturnType<typeof vi.fn>).mockResolvedValue(Buffer.from('pdf'))
    ;(gerarProjetoDocx as ReturnType<typeof vi.fn>).mockResolvedValue(Buffer.from('docx'))

    await generateProjeto('test-id', 'diag-uuid', 'scfv', mockInputs)

    const rascunhoPayload = updatePayloads.find((p: any) => p.status === 'rascunho') as any
    expect(rascunhoPayload).toBeDefined()
    expect(rascunhoPayload.pdf_url).toBe('projeto-test-id.pdf')
    expect(rascunhoPayload.docx_url).toBe('projeto-test-id.docx')
  })

  test('erro Claude: updatePayloads contém status erro', async () => {
    const updatePayloads: object[] = []
    ;(createAdminClient as ReturnType<typeof vi.fn>).mockReturnValue(makeSupabaseMock(updatePayloads))
    ;(gerarProjeto as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Claude falhou'))

    await generateProjeto('test-id', 'diag-uuid', 'scfv', mockInputs)

    const erroPayload = updatePayloads.find((p: any) => p.status === 'erro')
    expect(erroPayload).toBeDefined()
  })

  test('erro upload PDF: updatePayloads contém status erro', async () => {
    const updatePayloads: object[] = []
    const mock = makeSupabaseMock(updatePayloads)
    mock.storage.from = vi.fn(() => ({
      upload: vi.fn().mockResolvedValue({ error: new Error('Upload falhou') }),
    }))
    ;(createAdminClient as ReturnType<typeof vi.fn>).mockReturnValue(mock)
    ;(gerarProjeto as ReturnType<typeof vi.fn>).mockResolvedValue(mockSecoes)
    ;(renderToBuffer as ReturnType<typeof vi.fn>).mockResolvedValue(Buffer.from('pdf'))
    ;(gerarProjetoDocx as ReturnType<typeof vi.fn>).mockResolvedValue(Buffer.from('docx'))

    await generateProjeto('test-id', 'diag-uuid', 'scfv', mockInputs)

    const erroPayload = updatePayloads.find((p: any) => p.status === 'erro')
    expect(erroPayload).toBeDefined()
  })

  test('resolve sem throw em qualquer cenário de erro', async () => {
    const updatePayloads: object[] = []
    ;(createAdminClient as ReturnType<typeof vi.fn>).mockReturnValue(makeSupabaseMock(updatePayloads))
    ;(gerarProjeto as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Falha grave'))

    await expect(
      generateProjeto('test-id', 'diag-uuid', 'scfv', mockInputs)
    ).resolves.toBeUndefined()
  })
})
