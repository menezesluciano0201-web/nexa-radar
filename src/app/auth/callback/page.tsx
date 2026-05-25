// src/app/auth/callback/page.tsx
// Server component wrapper — useSearchParams precisa estar em Suspense para
// passar no static prerender do Next.js build.
import { Suspense } from 'react'
import { CallbackHandler } from './CallbackHandler'

function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900">
      <div className="text-center space-y-3">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-nexa-400 border-t-transparent" />
        <p className="text-sm text-slate-400">Carregando...</p>
      </div>
    </div>
  )
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<Loading />}>
      <CallbackHandler />
    </Suspense>
  )
}
