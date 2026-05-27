// src/app/admin/radar/page.tsx
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { brl } from '@/lib/format'
import { getFeedRadar, isUfRadar } from '@/lib/radar-data'

const UFS = ['AL', 'SE', 'PE', 'BA'] as const

export default async function RadarPage({
  searchParams,
}: {
  searchParams: Promise<{ uf?: string }>
}) {
  const params = await searchParams
  const ufParam = params.uf?.toUpperCase()
  if (ufParam && !isUfRadar(ufParam)) redirect('/admin/radar')

  const uf = (ufParam ?? 'AL') as (typeof UFS)[number]
  const feed = await getFeedRadar(uf)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-100">Radar de Subexecução</h1>
        <p className="text-slate-400 text-sm mt-1">
          Municípios com recursos federais empenhados e não executados (cron semanal Transferegov)
        </p>
      </div>

      {/* Tabs UF */}
      <div className="flex gap-2 border-b border-slate-800">
        {UFS.map((u) => (
          <Link
            key={u}
            href={`/admin/radar?uf=${u}`}
            className={
              u === uf
                ? 'px-4 py-2 text-sm font-semibold text-nexa-400 border-b-2 border-nexa-500 -mb-px'
                : 'px-4 py-2 text-sm text-slate-400 hover:text-slate-200'
            }
          >
            {u}
          </Link>
        ))}
      </div>

      {/* Meta info */}
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>
          {feed.total_municipios_analisados} municípios em {uf} ·
          {feed.alertas.length} com subexecução crítica
        </span>
        <span>
          {feed.ultima_coleta
            ? `Última coleta: ${new Date(feed.ultima_coleta).toLocaleString('pt-BR')}`
            : 'Nenhuma coleta ainda'}
        </span>
      </div>

      {/* Stale warning */}
      {feed.stale && (
        <div className="rounded-md bg-yellow-900/40 border border-yellow-800 p-4 text-sm text-yellow-300">
          Dados podem estar desatualizados — última varredura há mais de 14 dias.
        </div>
      )}

      {/* Empty state */}
      {feed.alertas.length === 0 && (
        <div className="rounded-md bg-slate-800/50 border border-slate-700 p-8 text-center">
          <p className="text-slate-300 font-medium">
            Nenhum município com subexecução crítica em {uf}.
          </p>
          <p className="text-slate-500 text-sm mt-2">
            {feed.ultima_coleta
              ? `Última varredura: ${new Date(feed.ultima_coleta).toLocaleString('pt-BR')}.`
              : 'O scraper ainda não rodou para este estado. Acesse GitHub → Actions → "Radar — scrape Transferegov" → Run workflow.'}
          </p>
        </div>
      )}

      {/* Feed */}
      {feed.alertas.length > 0 && (
        <div className="rounded-md border border-slate-800 divide-y divide-slate-800 bg-slate-800/30">
          {feed.alertas.map((a) => (
            <Link
              key={a.municipio_ibge}
              href={`/admin/radar/${a.municipio_ibge}`}
              className="flex items-center justify-between gap-4 p-4 hover:bg-slate-800/60 transition-colors"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-yellow-400">⚠</span>
                  <span className="font-medium text-slate-100">{a.municipio_nome} - {uf}</span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  {a.num_programas_risco} programa{a.num_programas_risco === 1 ? '' : 's'} em risco
                  {a.prazo_mais_proximo &&
                    ` · prazo +próximo: ${new Date(a.prazo_mais_proximo).toLocaleDateString('pt-BR')}`}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-base font-semibold text-slate-100">{brl(a.valor_em_risco)}</p>
                <p className="text-xs text-slate-500">em risco</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
