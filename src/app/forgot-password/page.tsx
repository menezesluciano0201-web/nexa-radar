// src/app/forgot-password/page.tsx
import Link from 'next/link'
import { requestPasswordReset } from './actions'

interface PageProps {
  searchParams: Promise<{ sent?: string; error?: string }>
}

const ERRORS: Record<string, string> = {
  invalid_email: 'Informe um e-mail válido',
}

export default async function ForgotPasswordPage({ searchParams }: PageProps) {
  const params = await searchParams
  const sent = params.sent === 'true'
  const error = params.error ? (ERRORS[params.error] ?? 'Erro ao enviar e-mail. Tente novamente.') : null

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900">
      <div className="w-full max-w-sm space-y-8 px-4">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-nexa-500">Nexa Radar</h1>
          <p className="mt-2 text-sm text-slate-400">Recuperação de senha</p>
        </div>

        {sent ? (
          <div className="space-y-4">
            <div className="rounded-md bg-green-900/30 border border-green-700 px-4 py-3 text-sm text-green-300">
              Se o e-mail informado estiver cadastrado, enviamos um link para redefinir sua senha. Verifique sua caixa de entrada (e a pasta de spam).
            </div>
            <Link
              href="/login"
              className="block text-center text-sm text-nexa-400 hover:text-nexa-300"
            >
              ← Voltar para o login
            </Link>
          </div>
        ) : (
          <>
            {error && (
              <div className="rounded-md bg-red-900/50 border border-red-700 px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            )}

            <form action={requestPasswordReset} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-1">
                  E-mail cadastrado
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

              <button
                type="submit"
                className="w-full rounded-md bg-nexa-600 px-4 py-2 text-sm font-semibold text-white hover:bg-nexa-700 focus:outline-none focus:ring-2 focus:ring-nexa-500 focus:ring-offset-2 focus:ring-offset-slate-900 transition-colors"
              >
                Enviar link de recuperação
              </button>
            </form>

            <Link
              href="/login"
              className="block text-center text-sm text-slate-400 hover:text-slate-300"
            >
              ← Voltar para o login
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
