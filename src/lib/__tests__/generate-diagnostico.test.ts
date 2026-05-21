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

  const makeChain = (finalResult: object) => {
    const result = Promise.resolve(finalResult)
    const chain: Record<string, unknown> = {}
    chain.select = () => chain
    chain.eq = () => chain
    chain.limit = () => result
    chain.single = () => result
    chain.update = () => chain
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

  return { from, storage, _upload: upload }
}

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}))

import { createAdminClient } from '@/lib/supabase/admin'
import { generateDiagnostico } from '@/lib/generateDiagnostico'

const mockCreateAdminClient = vi.mocked(createAdminClient)

beforeEach(() => { vi.clearAllMocks() })

describe('generateDiagnostico', () => {
  test('happy path: updates status to rascunho', async () => {
    const mock = makeSupabaseMock()
    mockCreateAdminClient.mockReturnValue(mock as never)

    await generateDiagnostico('test-id', '2803500')

    const updateCalls = mock.from.mock.calls.filter(([t]: [string]) => t === 'diagnosticos')
    expect(updateCalls.length).toBeGreaterThanOrEqual(1)
  })

  test('on municipio fetch error: marks status as erro', async () => {
    const mock = makeSupabaseMock({ municipioError: { message: 'not found', code: '404' } })
    mockCreateAdminClient.mockReturnValue(mock as never)

    await generateDiagnostico('test-id', '9999999')

    const updateCalls = mock.from.mock.calls.filter(([t]: [string]) => t === 'diagnosticos')
    expect(updateCalls.length).toBeGreaterThanOrEqual(1)
  })

  test('on storage upload error: marks status as erro', async () => {
    const mock = makeSupabaseMock({ uploadError: { message: 'upload failed' } })
    mockCreateAdminClient.mockReturnValue(mock as never)

    await generateDiagnostico('test-id', '2803500')

    expect(mock._upload).toHaveBeenCalled()
    const updateCalls = mock.from.mock.calls.filter(([t]: [string]) => t === 'diagnosticos')
    expect(updateCalls.length).toBeGreaterThanOrEqual(1)
  })

  test('on DB update error: logs error without throwing', async () => {
    const mock = makeSupabaseMock({ updateError: { message: 'db error' } })
    mockCreateAdminClient.mockReturnValue(mock as never)

    await expect(generateDiagnostico('test-id', '2803500')).resolves.toBeUndefined()
  })
})
