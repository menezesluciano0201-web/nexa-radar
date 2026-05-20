// src/components/briefing/BriefingForm.tsx
'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { StatusBriefing } from '@/types'

interface Props {
  parlamentarId: string
}

type LocalStatus = StatusBriefing | 'idle' | 'timeout'

export default function BriefingForm({ parlamentarId }: Props) {
  const [status, setStatus] = useState<LocalStatus>('idle')
  const [briefingId, setBriefingId] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const router = useRouter()
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!briefingId) return

    const supabase = createClient()

    // Declare channel binding before cleanup so the closure captures the variable safely
    let channel: ReturnType<typeof supabase.channel>

    function cleanup() {
      channel.unsubscribe()
      if (pollRef.current) clearInterval(pollRef.current)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }

    channel = supabase
      .channel(`briefing-${briefingId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'briefings', filter: `id=eq.${briefingId}` },
        (payload) => {
          const newStatus = (payload.new as { status: StatusBriefing }).status
          setStatus(newStatus)
          if (newStatus === 'rascunho' || newStatus === 'erro') cleanup()
        }
      )
      .subscribe()

    // NOTE: GET /api/briefing/{id} is admin-only — this component is only used in the admin panel.
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/briefing/${briefingId}`)
        if (!res.ok) return
        const data = (await res.json()) as { status: StatusBriefing }
        setStatus(data.status)
        if (data.status === 'rascunho' || data.status === 'erro') cleanup()
      } catch { /* ignora */ }
    }, 5_000)

    timeoutRef.current = setTimeout(() => {
      cleanup()
      setStatus('timeout')
    }, 120_000)

    return () => cleanup()
  }, [briefingId])

  async function handleGenerate() {
    setStatus('gerando')
    setSubmitError(null)

    try {
      const res = await fetch('/api/briefing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parlamentar_id: parlamentarId }),
      })
      if (!res.ok) {
        const body = (await res.json()) as { error: string }
        throw new Error(body.error ?? 'Erro desconhecido')
      }
      const { id } = (await res.json()) as { id: string }
      setBriefingId(id)
    } catch (err) {
      setStatus('idle')
      setSubmitError(err instanceof Error ? err.message : 'Erro ao iniciar geração')
    }
  }

  if (status === 'rascunho' && briefingId) {
    return (
      <div className="space-y-3">
        <div className="rounded-md bg-green-900/30 border border-green-700 px-4 py-3">
          <p className="text-green-300 text-sm font-medium">✓ Briefing gerado com sucesso</p>
        </div>
        <button
          onClick={() => router.push(`/admin/briefing/${briefingId}`)}
          className="rounded-md bg-nexa-600 px-4 py-2 text-sm font-semibold text-white hover:bg-nexa-700 transition-colors"
        >
          Ver Briefing →
        </button>
      </div>
    )
  }

  if (status === 'erro') {
    return (
      <div className="space-y-2">
        <div className="rounded-md bg-red-900/30 border border-red-700 px-4 py-3">
          <p className="text-red-300 text-sm">Erro na geração. Verifique os logs.</p>
        </div>
        <button onClick={() => { setStatus('idle'); setBriefingId(null) }}
          className="text-sm text-red-400 underline">Tentar novamente</button>
      </div>
    )
  }

  if (status === 'timeout') {
    return (
      <div className="space-y-2">
        <div className="rounded-md bg-yellow-900/30 border border-yellow-700 px-4 py-3">
          <p className="text-yellow-300 text-sm">Geração demorando mais que o esperado. Verifique em alguns minutos.</p>
        </div>
        {briefingId && (
          <button onClick={() => router.push(`/admin/briefing/${briefingId}`)}
            className="text-sm text-yellow-400 underline">Verificar status →</button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {submitError && (
        <div className="rounded-md bg-red-900/30 border border-red-700 px-4 py-3 text-sm text-red-300">
          {submitError}
        </div>
      )}
      <button
        onClick={handleGenerate}
        disabled={status === 'gerando'}
        className="rounded-md bg-nexa-600 px-4 py-2 text-sm font-semibold text-white hover:bg-nexa-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {status === 'gerando' ? (
          <span className="flex items-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            Gerando briefing...
          </span>
        ) : (
          'Gerar Briefing'
        )}
      </button>
      {status === 'gerando' && (
        <p className="text-xs text-slate-500">Aguardando. Isso leva 30–60 segundos.</p>
      )}
    </div>
  )
}
