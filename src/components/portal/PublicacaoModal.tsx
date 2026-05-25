// src/components/portal/PublicacaoModal.tsx
'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import type { PublicacaoPortal } from '@/types'
import { gerarUrlShare } from '@/lib/portal'

interface Props {
  publicacao: PublicacaoPortal
  uf: string
  slug: string
  onClose: () => void
}

export function PublicacaoModal({ publicacao, uf, slug, onClose }: Props) {
  const [fotoIdx, setFotoIdx] = useState(0)
  const [toast, setToast] = useState<string | null>(null)
  const fotos = publicacao.fotos ?? []
  const url = gerarUrlShare(uf, slug, publicacao.id)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') setFotoIdx(i => Math.max(0, i - 1))
      if (e.key === 'ArrowRight') setFotoIdx(i => Math.min(fotos.length - 1, i + 1))
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [fotos.length, onClose])

  async function copiarLink() {
    await navigator.clipboard.writeText(url)
    setToast('Link copiado!')
    setTimeout(() => setToast(null), 2000)
  }

  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`Veja: ${publicacao.titulo} — ${url}`)}`

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative max-w-2xl w-full bg-white rounded-lg overflow-hidden max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 rounded-full bg-black/40 text-white w-9 h-9 flex items-center justify-center text-xl hover:bg-black/60"
          aria-label="Fechar"
        >
          ×
        </button>

        {fotos.length > 0 && (
          <div className="relative aspect-video bg-slate-900 flex-shrink-0">
            <Image
              src={fotos[fotoIdx].url}
              alt={fotos[fotoIdx].alt}
              fill
              className="object-contain"
              sizes="(max-width: 768px) 100vw, 800px"
            />
            {fotos.length > 1 && (
              <>
                <button
                  onClick={() => setFotoIdx(i => Math.max(0, i - 1))}
                  disabled={fotoIdx === 0}
                  className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 text-white w-9 h-9 flex items-center justify-center disabled:opacity-30"
                  aria-label="Foto anterior"
                >
                  ‹
                </button>
                <button
                  onClick={() => setFotoIdx(i => Math.min(fotos.length - 1, i + 1))}
                  disabled={fotoIdx === fotos.length - 1}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 text-white w-9 h-9 flex items-center justify-center disabled:opacity-30"
                  aria-label="Próxima foto"
                >
                  ›
                </button>
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-white text-xs bg-black/50 px-2 py-0.5 rounded">
                  {fotoIdx + 1} / {fotos.length}
                </div>
              </>
            )}
          </div>
        )}

        <div className="overflow-y-auto p-6">
          {publicacao.valor_destaque && (
            <p className="text-2xl font-bold text-nexa-700">{publicacao.valor_destaque}</p>
          )}
          <h2 className="mt-1 text-xl font-bold text-slate-900">{publicacao.titulo}</h2>
          {publicacao.data_evento && (
            <p className="mt-1 text-sm text-slate-500">
              {new Date(publicacao.data_evento).toLocaleDateString('pt-BR', {
                day: '2-digit', month: 'long', year: 'numeric',
              })}
            </p>
          )}
          {publicacao.descricao && (
            <p className="mt-4 text-slate-700 whitespace-pre-wrap leading-relaxed">{publicacao.descricao}</p>
          )}

          <div className="mt-6 flex gap-2">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md bg-green-600 text-white px-4 py-2 text-sm font-semibold hover:bg-green-700"
            >
              📱 WhatsApp
            </a>
            <button
              onClick={copiarLink}
              className="rounded-md bg-slate-200 text-slate-900 px-4 py-2 text-sm font-semibold hover:bg-slate-300"
            >
              🔗 Copiar link
            </button>
          </div>

          {toast && (
            <div className="mt-3 text-sm text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">
              {toast}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
