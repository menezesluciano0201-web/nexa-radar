// src/components/diagnostico/DiagnosticoForm.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useGenerationPolling } from '@/hooks/useGenerationPolling'
import type { StatusDiagnostico } from '@/types'

interface Municipio {
  ibge: string
  nome: string
  uf: string
}

interface Props {
  municipios: Municipio[]
  ibgeInicial?: string
}

type LocalStatus = StatusDiagnostico | 'idle' | 'timeout'

export default function DiagnosticoForm({ municipios, ibgeInicial = '' }: Props) {
  const [ibge, setIbge] = useState(ibgeInicial)
  const [status, setStatus] = useState<LocalStatus>('idle')
  const [diagnosticoId, setDiagnosticoId] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const router = useRouter()

  useGenerationPolling<StatusDiagnostico>({
    id: diagnosticoId,
    entity: 'diagnostico',
    isTerminal: (s) => s === 'rascunho' || s === 'erro',
    onUpdate: setStatus,
    onTimeout: () => setStatus('timeout'),
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!ibge) return

    setStatus('gerando')
    setSubmitError(null)

    try {
      const res = await fetch('/api/diagnostico', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ municipio_ibge: ibge }),
      })

      if (!res.ok) {
        const body = (await res.json()) as { error: string }
        throw new Error(body.error ?? 'Erro desconhecido')
      }

      const { id } = (await res.json()) as { id: string }
      setDiagnosticoId(id)
    } catch (err) {
      setStatus('idle')
      setSubmitError(err instanceof Error ? err.message : 'Erro ao iniciar geração')
    }
  }

  // Estado: sucesso
  if (status === 'rascunho' && diagnosticoId) {
    return (
      <div className="space-y-4">
        <div className="rounded-md bg-green-900/30 border border-green-700 px-4 py-3">
          <p className="text-green-300 text-sm font-medium">✓ Diagnóstico gerado com sucesso</p>
        </div>
        <button
          onClick={() => router.push(`/admin/diagnostico/${diagnosticoId}`)}
          className="rounded-md bg-nexa-600 px-4 py-2 text-sm font-semibold text-white hover:bg-nexa-700 transition-colors"
        >
          Ver Diagnóstico →
        </button>
      </div>
    )
  }

  // Estado: erro
  if (status === 'erro') {
    return (
      <div className="space-y-3">
        <div className="rounded-md bg-red-900/30 border border-red-700 px-4 py-3">
          <p className="text-red-300 text-sm">Erro na geração do diagnóstico. Verifique os logs.</p>
        </div>
        <button
          onClick={() => {
            setStatus('idle')
            setDiagnosticoId(null)
          }}
          className="text-sm text-red-400 underline hover:text-red-300"
        >
          Tentar novamente
        </button>
      </div>
    )
  }

  // Estado: timeout
  if (status === 'timeout') {
    return (
      <div className="space-y-3">
        <div className="rounded-md bg-yellow-900/30 border border-yellow-700 px-4 py-3">
          <p className="text-yellow-300 text-sm">
            A geração está demorando mais que o esperado. Verifique o status em alguns minutos.
          </p>
        </div>
        {diagnosticoId && (
          <button
            onClick={() => router.push(`/admin/diagnostico/${diagnosticoId}`)}
            className="text-sm text-yellow-400 underline hover:text-yellow-300"
          >
            Verificar status do diagnóstico →
          </button>
        )}
      </div>
    )
  }

  // Formulário principal
  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {submitError && (
        <div className="rounded-md bg-red-900/30 border border-red-700 px-4 py-3 text-sm text-red-300">
          {submitError}
        </div>
      )}

      <div>
        <label
          htmlFor="municipio"
          className="block text-sm font-medium text-slate-300 mb-1"
        >
          Município
        </label>
        <select
          id="municipio"
          value={ibge}
          onChange={(e) => setIbge(e.target.value)}
          required
          disabled={status === 'gerando'}
          className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-nexa-500 focus:outline-none focus:ring-1 focus:ring-nexa-500 disabled:opacity-50"
        >
          <option value="">Selecione um município...</option>
          {municipios.map((m) => (
            <option key={m.ibge} value={m.ibge}>
              {m.nome} — {m.uf}
            </option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        disabled={status === 'gerando' || !ibge}
        className="w-full rounded-md bg-nexa-600 px-4 py-2 text-sm font-semibold text-white hover:bg-nexa-700 focus:outline-none focus:ring-2 focus:ring-nexa-500 focus:ring-offset-2 focus:ring-offset-slate-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {status === 'gerando' ? (
          <span className="flex items-center justify-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            Gerando diagnóstico...
          </span>
        ) : (
          'Gerar Diagnóstico'
        )}
      </button>

      {status === 'gerando' && (
        <p className="text-center text-xs text-slate-500">
          Aguardando conclusão. Isso leva 30–60 segundos.
        </p>
      )}
    </form>
  )
}
