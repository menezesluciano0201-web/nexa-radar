// src/components/portal/PortalHero.tsx
interface Props {
  ultimaAtualizacao: string | null
}

export function PortalHero({ ultimaAtualizacao }: Props) {
  return (
    <section className="px-4 py-8 bg-slate-50 border-b border-slate-200">
      <div className="max-w-5xl mx-auto text-center">
        <h2 className="text-3xl md:text-4xl font-bold text-slate-900">Portal de Transparência</h2>
        {ultimaAtualizacao && (
          <p className="mt-2 text-sm text-slate-500">
            Atualizado em {new Date(ultimaAtualizacao).toLocaleDateString('pt-BR', {
              day: '2-digit', month: 'long', year: 'numeric',
            })}
          </p>
        )}
      </div>
    </section>
  )
}
