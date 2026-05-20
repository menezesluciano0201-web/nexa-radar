// src/app/login/page.tsx
import { signIn } from './actions'

interface LoginPageProps {
  searchParams: Promise<{ error?: string; next?: string }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams
  const errorMsg = params.error

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900">
      <div className="w-full max-w-sm space-y-8 px-4">
        {/* Logo */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-nexa-500">Nexa Radar</h1>
          <p className="mt-2 text-sm text-slate-400">
            Inteligência de recursos públicos
          </p>
        </div>

        {/* Error message */}
        {errorMsg && (
          <div className="rounded-md bg-red-900/50 border border-red-700 px-4 py-3 text-sm text-red-300">
            {decodeURIComponent(errorMsg)}
          </div>
        )}

        {/* Login form */}
        <form action={signIn} className="space-y-4">
          <input type="hidden" name="next" value={params.next ?? ''} />
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-slate-300 mb-1"
            >
              E-mail
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-nexa-500 focus:outline-none focus:ring-1 focus:ring-nexa-500"
              placeholder="seu@email.com"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-slate-300 mb-1"
            >
              Senha
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-nexa-500 focus:outline-none focus:ring-1 focus:ring-nexa-500"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-md bg-nexa-600 px-4 py-2 text-sm font-semibold text-white hover:bg-nexa-700 focus:outline-none focus:ring-2 focus:ring-nexa-500 focus:ring-offset-2 focus:ring-offset-slate-900 transition-colors"
          >
            Entrar
          </button>
        </form>

        <p className="text-center text-xs text-slate-500">
          Acesso restrito à equipe Nexa Radar e clientes autorizados
        </p>
      </div>
    </div>
  )
}
