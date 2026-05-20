// src/app/portal/layout.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { signOut } from '@/app/login/actions'
import { LogOut, Home, FileText, Bell, TrendingDown } from 'lucide-react'
import Link from 'next/link'
import type { UserTipo } from '@/types'

const VALID_TIPOS: UserTipo[] = ['prefeito', 'deputado', 'senador', 'oscip']

function getNavItems(tipo: UserTipo) {
  const base = [
    { href: '/portal', label: 'Início', icon: Home },
    { href: '/portal/alertas', label: 'Alertas', icon: Bell },
  ]
  if (tipo === 'prefeito' || tipo === 'senador') {
    base.push({ href: '/portal/diagnostico', label: 'Diagnóstico', icon: FileText })
  }
  if (tipo === 'deputado' || tipo === 'senador') {
    base.push({ href: '/portal/emendas', label: 'Emendas', icon: TrendingDown })
  }
  return base
}

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('nome, tipo')
    .eq('id', user.id)
    .single()

  if (!profile) {
    // Conta existe em auth mas sem profile — evitar redirect loop fazendo signOut
    await supabase.auth.signOut()
    redirect('/login?error=Conta%20n%C3%A3o%20configurada.%20Contate%20a%20equipe%20Nexa%20Radar.')
  }
  if (profile.tipo === 'admin') redirect('/admin')

  const tipo = VALID_TIPOS.includes(profile.tipo as UserTipo)
    ? (profile.tipo as UserTipo)
    : ('oscip' as UserTipo)
  const navItems = getNavItems(tipo)

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Top bar */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <span className="font-bold text-nexa-500">Nexa Radar</span>
            <nav className="flex items-center gap-1">
              {navItems.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500 truncate max-w-[140px]">
              {profile.nome}
            </span>
            <form action={signOut}>
              <button
                type="submit"
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-100 transition-colors"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sair
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
    </div>
  )
}
