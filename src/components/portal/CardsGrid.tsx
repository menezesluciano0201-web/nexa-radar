// src/components/portal/CardsGrid.tsx
import Image from 'next/image'
import type { PublicacaoPortal } from '@/types'

interface Props {
  publicacoes: PublicacaoPortal[]
}

export function CardsGrid({ publicacoes }: Props) {
  if (publicacoes.length === 0) {
    return (
      <section className="px-4 py-12 text-center text-slate-500">
        <p>Em breve, resultados da gestão serão publicados aqui.</p>
      </section>
    )
  }

  return (
    <section className="px-4 py-8 bg-slate-50">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-4">
          Resultados Recentes
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {publicacoes.map(p => {
            const capa = p.fotos?.[0]
            return (
              <button
                key={p.id}
                id={`card-${p.id}`}
                data-pub-id={p.id}
                className="text-left rounded-lg overflow-hidden border border-slate-200 bg-white hover:shadow-md transition-shadow"
                aria-label={`Ver detalhes de ${p.titulo}`}
              >
                {capa && (
                  <div className="relative aspect-video bg-slate-100">
                    <Image
                      src={capa.url}
                      alt={capa.alt}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, 33vw"
                    />
                  </div>
                )}
                <div className="p-4">
                  {p.valor_destaque && (
                    <p className="text-lg font-bold text-nexa-700">{p.valor_destaque}</p>
                  )}
                  <h3 className="mt-1 font-semibold text-slate-900">{p.titulo}</h3>
                  {p.descricao && (
                    <p className="mt-2 text-sm text-slate-600 line-clamp-3">{p.descricao}</p>
                  )}
                  {p.data_evento && (
                    <p className="mt-3 text-xs text-slate-400">
                      {new Date(p.data_evento).toLocaleDateString('pt-BR')}
                    </p>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}
