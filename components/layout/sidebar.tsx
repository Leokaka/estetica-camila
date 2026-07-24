'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, Users, Calendar, Scissors,
  DollarSign, LogOut, Menu, X,
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
      <div className="flex items-center gap-3 px-6 py-6 border-b border-[#463325]">
        <Image src="/logo/selo-cg.png" alt="CG" width={44} height={44} />
        <div>
          <p
            className="text-base leading-tight text-[#F5F0EA] tracking-[0.06em]"
            style={{ fontFamily: 'var(--font-playfair), serif', fontWeight: 600 }}
          >
            Camila Garcia
          </p>
          <p className="text-[10px] leading-tight tracking-[0.35em] text-[#C9A96E] font-medium">ESTÉTICA</p>
        </div>
        {onClose && (
          <button onClick={onClose} className="ml-auto text-[#C9A96E] hover:text-white">
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
                  ? 'bg-[#F5F0EA] text-[#5E4433]'
                  : 'text-[#C9A96E] hover:bg-[#463325] hover:text-[#F5F0EA]'
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
          className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-[#C9A96E] hover:bg-[#463325] hover:text-[#F5F0EA] transition-all"
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
    <aside className="hidden md:flex h-screen w-64 shrink-0 flex-col bg-[#33241A] shadow-xl">
      <NavContent />
    </aside>
  )
}

export function MobileHeader() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <header className="md:hidden flex items-center justify-between px-4 py-3 bg-[#33241A] shadow-md sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <Image src="/logo/selo-cg.png" alt="CG" width={32} height={32} />
          <span
            className="text-[#F5F0EA] tracking-wider"
            style={{ fontFamily: 'var(--font-playfair), serif', fontWeight: 600 }}
          >
            Camila Garcia
          </span>
        </div>
        <button onClick={() => setOpen(true)} className="text-[#C9A96E] hover:text-white p-1">
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
        'fixed top-0 left-0 h-full w-72 bg-[#33241A] z-50 flex flex-col shadow-2xl transition-transform duration-300 md:hidden',
        open ? 'translate-x-0' : '-translate-x-full'
      )}>
        <NavContent onClose={() => setOpen(false)} />
      </div>
    </>
  )
}
