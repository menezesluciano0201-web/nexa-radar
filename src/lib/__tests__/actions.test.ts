// src/lib/__tests__/actions.test.ts
// Tests for the UUID validation logic extracted from marcarDiagnosticoEntregue.
// The server action itself cannot be unit-tested without mocking Supabase+next/navigation,
// so we test the validation regex in isolation.

import { describe, test, expect } from 'vitest'
import { UUID_RE } from '@/lib/format'

describe('UUID_RE validation (mirrors marcarDiagnosticoEntregue guard)', () => {
  test('valid UUID v4 passes', () => {
    expect(UUID_RE.test('08675de3-43db-47d5-bc5a-91d132c274bc')).toBe(true)
  })

  test('empty string fails', () => {
    expect(UUID_RE.test('')).toBe(false)
  })

  test('SQL injection string fails', () => {
    expect(UUID_RE.test("'; DROP TABLE diagnosticos; --")).toBe(false)
  })

  test('non-UUID string fails', () => {
    expect(UUID_RE.test('not-a-uuid')).toBe(false)
  })

  test('UUID-like string with wrong length fails', () => {
    expect(UUID_RE.test('08675de3-43db-47d5-bc5a')).toBe(false)
  })
})
