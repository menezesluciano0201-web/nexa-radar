// src/app/admin/portal/[ibge]/publicacao/[id]/page.tsx
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { requireAdminClient } from '@/lib/require-admin'
import { IBGE_RE, UUID_RE } from '@/lib/format'
import { salvarPublicacao, uploadFoto, removeFoto, deletePublicacao } from './actions'
import { PublicacaoFotoUpload } from './PublicacaoEditor'
import type { PublicacaoPortal, PublicacaoFoto } from '@/types'

interface PageProps {
  params: Promise<{ ibge: string; id: string }>
  searchParams: Promise<{ ok?: string; error?: string }>
}

export default async function PublicacaoEditPage({ params, searchParams }: PageProps) {
  const { ibge, id } = await params
  const { ok, error } = await searchParams

  if (!IBGE_RE.test(ibge)) notFound()
  const isNova = id === 'nova'
  if (!isNova && !UUID_RE.test(id)) notFound()

  const admin = await requireAdminClient()

  let publicacao: PublicacaoPortal | null = null
  if (!isNova) {
    const { data } = await admin
      .from('publicacoes_portal')
      .select('*')
      .eq('id', id)
      .eq('municipio_ibge', ibge)
      .single()
    if (!data) notFound()
    publicacao = data as PublicacaoPortal
  }

  const fotos = (publicacao?.fotos ?? []) as PublicacaoFoto[]
  const mapsLink = `https://www.google.com/maps/search/?api=1&query=${ibge}`

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link href={`/admin/portal/${ibge}?aba=publicacoes`} className="text-xs text-slate-400 hover:text-slate-300">
          ← Publicações
        </Link>
        <h1 className="text-xl font-bold text-slate-100">
          {isNova ? 'Nova publicação' : 'Editar publicação'}
        </h1>
      </div>

      {ok && (
        <div className="rounded-md bg-green-900/30 border border-green-700 px-4 py-2 text-sm text-green-300">Salvo.</div>
      )}
      {error && (
        <div className="rounded-md bg-red-900/30 border border-red-700 px-4 py-2 text-sm text-red-300">Erro: {error}</div>
      )}

      <form action={salvarPublicacao} className="rounded-md border border-slate-800 p-4 space-y-4">
        <input type="hidden" name="ibge" value={ibge} />
        <input type="hidden" name="id" value={id} />

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Título *</label>
          <input
            type="text"
            name="titulo"
            required
            defaultValue={publicacao?.titulo ?? ''}
            className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Descrição</label>
          <textarea
            name="descricao"
            rows={5}
            defaultValue={publicacao?.descricao ?? ''}
            className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Valor destaque (ex: R$ 2,3M)</label>
            <input
              type="text"
              name="valor_destaque"
              defaultValue={publicacao?.valor_destaque ?? ''}
              className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Data do evento</label>
            <input
              type="date"
              name="data_evento"
              defaultValue={publicacao?.data_evento ?? ''}
              className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Latitude</label>
            <input
              type="number"
              step="0.000001"
              name="lat"
              defaultValue={publicacao?.lat ?? ''}
              className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Longitude</label>
            <input
              type="number"
              step="0.000001"
              name="lng"
              defaultValue={publicacao?.lng ?? ''}
              className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
            />
          </div>
        </div>
        <p className="text-xs text-slate-500">
          <a href={mapsLink} target="_blank" rel="noopener noreferrer" className="text-nexa-400 hover:text-nexa-300">
            Buscar coordenadas no Google Maps
          </a>{' '}
          — clique com botão direito no ponto desejado, copie as coordenadas, cole acima.
        </p>

        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input type="checkbox" name="ativo" defaultChecked={publicacao?.ativo ?? false} />
          Ativo no portal (visível ao público)
        </label>

        <div className="flex justify-between items-center">
          <button
            type="submit"
            className="rounded-md bg-nexa-600 px-4 py-2 text-sm font-semibold text-white hover:bg-nexa-500"
          >
            {isNova ? 'Criar publicação' : 'Salvar alterações'}
          </button>

          {!isNova && (
            <form action={deletePublicacao}>
              <input type="hidden" name="ibge" value={ibge} />
              <input type="hidden" name="id" value={id} />
              <button
                type="submit"
                className="rounded-md bg-red-900/40 border border-red-800 px-3 py-1.5 text-xs text-red-300 hover:bg-red-900/60"
              >
                Excluir
              </button>
            </form>
          )}
        </div>
      </form>

      {!isNova && (
        <div className="rounded-md border border-slate-800 p-4 space-y-4">
          <h2 className="text-sm font-semibold text-slate-300">Fotos</h2>

          {fotos.length === 0 && (
            <p className="text-xs text-slate-500">Nenhuma foto ainda. Suba a primeira abaixo.</p>
          )}

          {fotos.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {fotos.sort((a, b) => a.ordem - b.ordem).map(f => (
                <div key={f.ordem} className="relative aspect-video rounded overflow-hidden bg-slate-900">
                  <Image src={f.url} alt={f.alt} fill className="object-cover" sizes="200px" />
                  <form action={removeFoto} className="absolute top-1 right-1">
                    <input type="hidden" name="ibge" value={ibge} />
                    <input type="hidden" name="id" value={id} />
                    <input type="hidden" name="ordem" value={f.ordem} />
                    <button
                      type="submit"
                      className="rounded bg-black/60 text-white text-xs px-2 py-0.5 hover:bg-black/80"
                      aria-label="Remover foto"
                    >
                      ×
                    </button>
                  </form>
                </div>
              ))}
            </div>
          )}

          <form action={uploadFoto} className="border-t border-slate-800 pt-4 space-y-3">
            <input type="hidden" name="ibge" value={ibge} />
            <input type="hidden" name="id" value={id} />
            <div>
              <label className="block text-xs text-slate-400 mb-1">Nova foto (PNG/JPG/WEBP, max 5MB)</label>
              <PublicacaoFotoUpload />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Texto alt (acessibilidade)</label>
              <input
                type="text"
                name="alt"
                placeholder="Ex: Crianças no CRAS Centro participando da atividade"
                className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
              />
            </div>
            <button
              type="submit"
              className="rounded-md bg-slate-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-600"
            >
              Enviar foto
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
