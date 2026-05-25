// src/lib/portal.ts
import type { KpiPortal } from '@/types'

export function ordenarKpis(kpis: KpiPortal[]): (KpiPortal | null)[] {
  const slots: (KpiPortal | null)[] = [null, null, null, null]
  for (const k of kpis) {
    if (k.ordem >= 1 && k.ordem <= 4) {
      slots[k.ordem - 1] = k
    }
  }
  return slots
}

export function gerarUrlShare(uf: string, slug: string, pubId?: string): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  const path = `/p/${uf.toLowerCase()}/${slug}`
  return pubId ? `${base}${path}#pub-${pubId}` : `${base}${path}`
}
