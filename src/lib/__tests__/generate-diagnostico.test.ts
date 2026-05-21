import { vi, describe, test, expect, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@react-pdf/renderer', () => ({ renderToBuffer: vi.fn().mockResolvedValue(Buffer.from('PDF')) }))
vi.mock('@/lib/pdf/diagnostico-pdf', () => ({ DiagnosticoPDF: () => null }))
vi.mock('@/lib/claude', () => ({ gerarDiagnostico: vi.fn().mockResolvedValue('Análise IA') }))

// Build a chainable Supabase mock that resolves at terminal methods
function makeSupabaseMock(overrides: {
  transferenciasError?: object
  municipioError?: object
  municipioData?: object
  uploadError?: object
  updateError?: object
} = {}) {
  const municipioData = overrides.municipioData ?? { nome: 'Lagarto', uf: 'SE' }
  const updatePayloads: unknown[] = []

  const makeChain = (finalResult: object) => {
    const result = Promise.resolve(finalResult)
    const chain: Record<string, unknown> = {}
    chain.select = () => chain
    chain.eq = () => chain
    chain.limit = () => result
    chain.single = () => result
    chain.update = (payload: unknown) => { updatePayloads.push(payload); return chain }
    // support .then() for fire-and-forget error handler in generateDiagnostico
    chain.then = (onFulfilled: (v: object) => unknown, onRejected?: (e: unknown) => unknown) =>
      result.then(onFulfilled, onRejected)
    return chain
  }

  let callCount = 0
  const from = vi.fn((table: string) => {
    if (table === 'transferencias_federais')
      return makeChain({ data: [], error: overrides.transferenciasError ?? null })
    if (table === 'municipios_habilitacao')
      return makeChain({ data: municipioData, error: overrides.municipioError ?? null })
    if (table === 'diagnosticos') {
      callCount++
      return makeChain({ error: callCount === 1 ? (overrides.updateError ?? null) : null })
    }
    return makeChain({ data: null, error: null })
  })

  const upload = vi.fn().mockResolvedValue({ error: overrides.uploadError ?? null })
  const storage = { from: () => ({ upload }) }

  return { from, storage, _upload: upload, updatePayloads }
}

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}))

import { createAdminClient } from '@/lib/supabase/admin'
import { generateDiagnostico } from '@/lib/generateDiagnostico'

const mockCreateAdminClient = vi.mocked(createAdminClient)

beforeEach(() => { vi.clearAllMocks() })

describe('generateDiagnostico', () => {
  test('happy path: writes status=rascunho with expected fields', async () => {
    const mock = makeSupabaseMock()
    mockCreateAdminClient.mockReturnValue(mock as never)

    await generateDiagnostico('test-id', '2803500')

    const successUpdate = mock.updatePayloads.find(
      (p) => (p as Record<string, unknown>).status === 'rascunho'
    )
    expect(successUpdate).toBeDefined()
    expect(successUpdate).toMatchObject({
      status: 'rascunho',
      texto_ia: 'Análise IA',
      pdf_url: 'diagnostico-test-id.pdf',
    })
  })

  test('on municipio fetch error: writes status=erro', async () => {
    const mock = makeSupabaseMock({ municipioError: { message: 'not found', code: '404' } })
    mockCreateAdminClient.mockReturnValue(mock as never)

    await generateDiagnostico('test-id', '9999999')

    const erroUpdate = mock.updatePayloads.find(
      (p) => (p as Record<string, unknown>).status === 'erro'
    )
    expect(erroUpdate).toMatchObject({ status: 'erro' })
  })

  test('on storage upload error: writes status=erro', async () => {
    const mock = makeSupabaseMock({ uploadError: { message: 'upload failed' } })
    mockCreateAdminClient.mockReturnValue(mock as never)

    await generateDiagnostico('test-id', '2803500')

    expect(mock._upload).toHaveBeenCalled()
    const erroUpdate = mock.updatePayloads.find(
      (p) => (p as Record<string, unknown>).status === 'erro'
    )
    expect(erroUpdate).toMatchObject({ status: 'erro' })
  })

  test('on DB update error: resolves without throwing', async () => {
    const mock = makeSupabaseMock({ updateError: { message: 'db error' } })
    mockCreateAdminClient.mockReturnValue(mock as never)

    await expect(generateDiagnostico('test-id', '2803500')).resolves.toBeUndefined()
  })
})
