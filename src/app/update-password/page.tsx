// src/app/update-password/page.tsx
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { updatePassword } from './actions'

interface PageProps {
  searchParams: Promise<{ error?: string }>
}

const ERRORS: Record<string, string> = {
  too_short: 'A senha deve ter no mínimo 8 caracteres',
  mismatch: 'As senhas não coincidem',
  update_failed: 'Erro ao atualizar a senha. Tente novamente ou solicite um novo link.',
}

export default async function UpdatePasswordPage({ searchParams }: PageProps) {
  const params = await searchParams
  const error = params.error ? (ERRORS[params.error] ?? 'Erro ao atualizar a senha.') : null

  // O callback PKCE já criou a sessão. Se não tiver sessão, manda para /login.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?error=login_error')

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900">
      <div className="w-full max-w-sm space-y-8 px-4">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-nexa-500">Nexa Radar</h1>
          <p className="mt-2 text-sm text-slate-400">Definir nova senha</p>
          <p className="mt-1 text-xs text-slate-500">{user.email}</p>
        </div>

        {error && (
          <div className="rounded-md bg-red-900/50 border border-red-700 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <form action={updatePassword} className="space-y-4">
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-1">
              Nova senha
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-nexa-500 focus:outline-none focus:ring-1 focus:ring-nexa-500"
            />
            <p className="mt-1 text-xs text-slate-500">Mínimo 8 caracteres.</p>
          </div>

          <div>
            <label htmlFor="confirm" className="block text-sm font-medium text-slate-300 mb-1">
              Confirmar nova senha
            </label>
            <input
              id="confirm"
              name="confirm"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-nexa-500 focus:outline-none focus:ring-1 focus:ring-nexa-500"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-md bg-nexa-600 px-4 py-2 text-sm font-semibold text-white hover:bg-nexa-700 focus:outline-none focus:ring-2 focus:ring-nexa-500 focus:ring-offset-2 focus:ring-offset-slate-900 transition-colors"
          >
            Salvar nova senha
          </button>
        </form>

        <Link
          href="/login"
          className="block text-center text-sm text-slate-400 hover:text-slate-300"
        >
          ← Voltar para o login
        </Link>
      </div>
    </div>
  )
}
