'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Users,
  Calendar,
  Scissors,
  DollarSign,
  LogOut,
  Sparkles,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/clientes', label: 'Clientes', icon: Users },
  { href: '/agendamentos', label: 'Agendamentos', icon: Calendar },
  { href: '/servicos', label: 'Serviços', icon: Scissors },
  { href: '/financeiro', label: 'Financeiro', icon: DollarSign },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className="flex h-screen w-64 flex-col bg-rose-700 text-white shadow-xl">
      <div className="flex items-center gap-3 px-6 py-6 border-b border-rose-600">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white">
          <Sparkles className="h-5 w-5 text-rose-600" />
        </div>
        <div>
          <p className="font-bold text-lg leading-tight">Estética</p>
          <p className="font-bold text-lg leading-tight text-rose-200">Camila</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => {
          const Icon = item.icon
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-all',
                active
                  ? 'bg-white text-rose-700 shadow-sm'
                  : 'text-rose-100 hover:bg-rose-600'
              )}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="px-3 pb-6">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-rose-100 hover:bg-rose-600 transition-all"
        >
          <LogOut className="h-5 w-5" />
          Sair
        </button>
      </div>
    </aside>
  )
}
