// src/app/auth/callback/page.tsx
// Consome o token do URL hash (implicit flow do Supabase para magic links / recovery).
// O server route.ts cobre PKCE (?code=...); este page.tsx cobre implicit (#access_token=...).
'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function AuthCallbackPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function handle() {
      const hash = window.location.hash.substring(1)
      const params = new URLSearchParams(hash)
      const access_token = params.get('access_token')
      const refresh_token = params.get('refresh_token')
      const errParam = params.get('error_description') ?? params.get('error')

      if (errParam) {
        setError(errParam)
        return
      }
      if (!access_token || !refresh_token) {
        setError('Link inválido ou expirado.')
        return
      }

      const supabase = createClient()
      const { error: setErr } = await supabase.auth.setSession({ access_token, refresh_token })
      if (setErr) {
        setError(setErr.message)
        return
      }

      const next = searchParams.get('next') ?? '/'
      // Same-origin guard
      let safePath = '/'
      try {
        const parsed = new URL(next, window.location.origin)
        if (parsed.origin === window.location.origin) safePath = parsed.pathname + parsed.search
      } catch { /* fallback */ }
      router.replace(safePath)
    }
    handle()
  }, [router, searchParams])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="max-w-sm space-y-4 px-4 text-center">
          <h1 className="text-2xl font-bold text-red-400">Erro de autenticação</h1>
          <p className="text-sm text-slate-300">{error}</p>
          <a href="/login" className="inline-block text-sm text-nexa-400 hover:text-nexa-300">
            ← Voltar para o login
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900">
      <div className="text-center space-y-3">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-nexa-400 border-t-transparent" />
        <p className="text-sm text-slate-400">Validando seu link...</p>
      </div>
    </div>
  )
}
