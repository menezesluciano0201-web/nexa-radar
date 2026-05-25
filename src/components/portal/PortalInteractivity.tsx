// src/components/portal/PortalInteractivity.tsx
'use client'

import { useEffect, useState, useCallback } from 'react'
import type { PublicacaoPortal } from '@/types'
import { PublicacaoModal } from './PublicacaoModal'

interface Props {
  publicacoes: PublicacaoPortal[]
  uf: string
  slug: string
}

export function PortalInteractivity({ publicacoes, uf, slug }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null)

  const open = useCallback((id: string) => {
    const exists = publicacoes.find(p => p.id === id)
    if (exists) setActiveId(id)
  }, [publicacoes])

  // Delegação de click nos cards renderizados pelo CardsGrid.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      const target = e.target as HTMLElement
      const card = target.closest('[data-pub-id]') as HTMLElement | null
      if (card?.dataset.pubId) open(card.dataset.pubId)
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [open])

  // Hash auto-open: #pub-{id} ao carregar.
  // Se id não estiver na lista (inativa/deletada), ignora silenciosamente.
  useEffect(() => {
    const hash = window.location.hash
    if (hash.startsWith('#pub-')) open(hash.slice(5))
  }, [open])

  if (!activeId) return null
  const pub = publicacoes.find(p => p.id === activeId)
  if (!pub) return null

  return (
    <PublicacaoModal
      publicacao={pub}
      uf={uf}
      slug={slug}
      onClose={() => setActiveId(null)}
    />
  )
}
