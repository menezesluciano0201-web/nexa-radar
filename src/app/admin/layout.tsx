// src/app/admin/layout.tsx
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { signOut } from '@/app/login/actions'
import {
  LayoutDashboard,
  Users,
  MapPin,
  FileText,
  Users2,
  Activity,
  Bell,
  LogOut,
} from 'lucide-react'

const NAV_ITEMS = [
  { href: '/admin', label: 'Visão Geral', icon: LayoutDashboard },
  { href: '/admin/clientes', label: 'Clientes', icon: Users },
  { href: '/admin/municipios', label: 'Municípios', icon: MapPin },
  { href: '/admin/diagnostico/novo', label: 'Novo Diagnóstico', icon: FileText },
  { href: '/admin/parlamentar', label: 'Parlamentares', icon: Users2 },
  { href: '/admin/coleta', label: 'Coleta de Dados', icon: Activity },
  { href: '/admin/alertas', label: 'Alertas', icon: Bell },
]

export default async function AdminLayout({
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

  if (!profile || profile.tipo !== 'admin') redirect('/portal')

  return (
    <div className="flex h-screen bg-slate-900">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 border-r border-slate-800 flex flex-col">
        {/* Logo */}
        <div className="px-6 py-5 border-b border-slate-800">
          <span className="text-xl font-bold text-nexa-500">Nexa Radar</span>
          <p className="text-xs text-slate-500 mt-0.5">Painel Admin</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {label}
            </Link>
          ))}
        </nav>

        {/* User + signout */}
        <div className="px-3 py-4 border-t border-slate-800">
          <div className="px-3 py-2 text-xs text-slate-500 truncate">
            {profile.nome}
          </div>
          <form action={signOut}>
            <button
              type="submit"
              className="flex w-full items-center gap-3 px-3 py-2 rounded-md text-sm text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </button>
          </form>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-8">{children}</div>
      </main>
    </div>
  )
}
