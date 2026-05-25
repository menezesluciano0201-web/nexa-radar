// src/lib/portal.ts
import type { KpiPortal } from '@/types'

// Cor primária default do portal quando o município não tem branding (nexa-600).
// Single source of truth para evitar drift entre admin form, DB default e renders.
export const DEFAULT_COR_PRIMARIA = '#0284c7'

export function ordenarKpis(kpis: KpiPortal[]): (KpiPortal | null)[] {
  const slots: (KpiPortal | null)[] = [null, null, null, null]
  for (const k of kpis) {
    if (k.ordem >= 1 && k.ordem <= 4) {
      slots[k.ordem - 1] = k
    }
  }
  return slots
}

// Path do portal público (relativo). Single source of truth para o schema /p/{uf}/{slug}.
export function portalUrl(uf: string, slug: string): string {
  return `/p/${uf.toLowerCase()}/${slug}`
}

export function gerarUrlShare(uf: string, slug: string, pubId?: string): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  const path = portalUrl(uf, slug)
  return pubId ? `${base}${path}#pub-${pubId}` : `${base}${path}`
}
