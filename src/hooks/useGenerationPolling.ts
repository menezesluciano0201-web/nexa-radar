'use client'
import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

type Entity = 'briefing' | 'diagnostico' | 'projeto'

interface Options<S extends string> {
  id: string | null            // null = hook inativo (sem subscription/poll)
  entity: Entity               // deriva: table=`${entity}s`, channel=`${entity}-{id}`, url=`/api/${entity}/{id}`
  isTerminal: (status: S) => boolean
  onUpdate: (status: S) => void
  onTimeout: () => void
  timeoutMs?: number           // default 120_000
  pollMs?: number              // default 5_000
}

/**
 * Realtime + polling + safety timeout para monitorar `status` enquanto geração
 * async roda. Cleanup automático ao desmontar, atingir terminal, ou expirar
 * timeout. Callbacks via refs — caller não precisa memoizar.
 */
export function useGenerationPolling<S extends string>(opts: Options<S>) {
  const { id, entity, timeoutMs = 120_000, pollMs = 5_000 } = opts

  const isTerminalRef = useRef(opts.isTerminal)
  const onUpdateRef = useRef(opts.onUpdate)
  const onTimeoutRef = useRef(opts.onTimeout)
  isTerminalRef.current = opts.isTerminal
  onUpdateRef.current = opts.onUpdate
  onTimeoutRef.current = opts.onTimeout

  useEffect(() => {
    if (!id) return

    const supabase = createClient()
    let channel: ReturnType<typeof supabase.channel> | null = null
    let pollId: ReturnType<typeof setInterval> | null = null
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    let done = false   // guard contra race: poll in-flight resolvendo após cleanup

    function cleanup() {
      done = true
      channel?.unsubscribe()
      if (pollId) clearInterval(pollId)
      if (timeoutId) clearTimeout(timeoutId)
    }

    function handleStatus(status: S) {
      if (done) return
      if (typeof status !== 'string') return
      onUpdateRef.current(status)
      if (isTerminalRef.current(status)) cleanup()
    }

    channel = supabase
      .channel(`${entity}-${id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: `${entity}s`,
        filter: `id=eq.${id}`,
      }, payload => {
        handleStatus((payload.new as { status: S }).status)
      })
      .subscribe()

    pollId = setInterval(async () => {
      try {
        const res = await fetch(`/api/${entity}/${id}`)
        if (!res.ok) return
        const data = await res.json() as { status: S }
        handleStatus(data.status)
      } catch { /* ignora */ }
    }, pollMs)

    timeoutId = setTimeout(() => {
      cleanup()
      onTimeoutRef.current()
    }, timeoutMs)

    return cleanup
  }, [id, entity, timeoutMs, pollMs])
}
