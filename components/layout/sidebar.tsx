'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, Users, Calendar, Scissors,
  DollarSign, LogOut, Sparkles, Menu, X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/clientes', label: 'Clientes', icon: Users },
  { href: '/agendamentos', label: 'Agendamentos', icon: Calendar },
  { href: '/servicos', label: 'Serviços', icon: Scissors },
  { href: '/financeiro', label: 'Financeiro', icon: DollarSign },
]

function NavContent({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <>
      <div className="flex items-center gap-3 px-6 py-6 border-b border-[#3D2310]">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#7B4F2E]">
          <Sparkles className="h-5 w-5 text-[#FAF7F2]" />
        </div>
        <div>
          <p className="font-bold text-lg leading-tight text-[#FAF7F2]">Estética</p>
          <p className="font-bold text-lg leading-tight text-[#C8A882]">Camila</p>
        </div>
        {onClose && (
          <button onClick={onClose} className="ml-auto text-[#C8A882] hover:text-white">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => {
          const Icon = item.icon
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={cn(
                'flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-all',
                active
                  ? 'bg-[#FAF7F2] text-[#7B4F2E]'
                  : 'text-[#C8A882] hover:bg-[#3D2310] hover:text-[#FAF7F2]'
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="px-3 pb-6">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-[#C8A882] hover:bg-[#3D2310] hover:text-[#FAF7F2] transition-all"
        >
          <LogOut className="h-5 w-5" />
          Sair
        </button>
      </div>
    </>
  )
}

export function Sidebar() {
  return (
    <aside className="hidden md:flex h-screen w-64 shrink-0 flex-col bg-[#2C1A0E] shadow-xl">
      <NavContent />
    </aside>
  )
}

export function MobileHeader() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <header className="md:hidden flex items-center justify-between px-4 py-3 bg-[#2C1A0E] shadow-md sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#7B4F2E]">
            <Sparkles className="h-4 w-4 text-[#FAF7F2]" />
          </div>
          <span className="font-bold text-[#FAF7F2]">Estética Camila</span>
        </div>
        <button onClick={() => setOpen(true)} className="text-[#C8A882] hover:text-white p-1">
          <Menu className="h-6 w-6" />
        </button>
      </header>

      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-50 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Drawer */}
      <div className={cn(
        'fixed top-0 left-0 h-full w-72 bg-[#2C1A0E] z-50 flex flex-col shadow-2xl transition-transform duration-300 md:hidden',
        open ? 'translate-x-0' : '-translate-x-full'
      )}>
        <NavContent onClose={() => setOpen(false)} />
      </div>
    </>
  )
}
