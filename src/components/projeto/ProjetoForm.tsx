'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useGenerationPolling } from '@/hooks/useGenerationPolling'
import type { StatusProjeto, TemplateName } from '@/types'

interface Props {
  diagnosticoId: string
  template: TemplateName
  formData: Record<string, unknown>
}

type LocalStatus = StatusProjeto | 'idle' | 'timeout'

export function ProjetoForm({ diagnosticoId, template, formData }: Props) {
  const [estado, setEstado] = useState<LocalStatus>('idle')
  const [projetoId, setProjetoId] = useState<string | null>(null)
  const [erroMsg, setErroMsg] = useState<string | null>(null)
  const router = useRouter()

  useGenerationPolling<StatusProjeto>({
    id: projetoId,
    entity: 'projeto',
    isTerminal: (s) => s === 'rascunho' || s === 'erro',
    onUpdate: setEstado,
    onTimeout: () => setEstado('timeout'),
  })

  function resetar() {
    setEstado('idle')
    setErroMsg(null)
    setProjetoId(null)
  }

  async function handleSubmit() {
    setEstado('gerando')
    setErroMsg(null)

    const res = await fetch('/api/projeto', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ diagnostico_id: diagnosticoId, template, ...formData }),
    })

    if (!res.ok) {
      const json = await res.json()
      setErroMsg(json.error ?? 'Erro desconhecido')
      setEstado('erro')
      return
    }

    const { id } = await res.json()
    setProjetoId(id)
  }

  if (estado === 'idle') {
    return (
      <button
        onClick={handleSubmit}
        className="rounded-md bg-nexa-600 px-4 py-2 text-sm font-semibold text-white hover:bg-nexa-500"
      >
        Gerar Projeto
      </button>
    )
  }

  if (estado === 'gerando') {
    return (
      <div className="flex items-center gap-3 text-slate-400 text-sm">
        <svg className="animate-spin h-4 w-4 text-nexa-400" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
        Gerando projeto... (pode levar até 90s)
      </div>
    )
  }

  if (estado === 'rascunho' && projetoId) {
    return (
      <button
        onClick={() => router.push(`/admin/projeto/${projetoId}`)}
        className="inline-flex items-center gap-2 rounded-md bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-600"
      >
        Ver Projeto →
      </button>
    )
  }

  const mensagem = estado === 'timeout'
    ? 'A geração demorou mais que 120s. Verifique a página de detalhe ou tente novamente.'
    : (erroMsg ?? 'Erro na geração do projeto. Tente novamente.')

  return (
    <div className="space-y-3">
      <div className="rounded-md bg-red-900/40 border border-red-800 p-4 text-sm text-red-300">
        {mensagem}
      </div>
      <button
        onClick={resetar}
        className="rounded-md bg-slate-700 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-600"
      >
        Tentar novamente
      </button>
    </div>
  )
}
