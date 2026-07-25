import Image from 'next/image'
import { Sidebar, MobileHeader } from '@/components/layout/sidebar'
import { Toaster } from '@/components/ui/sonner'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="relative flex-1 flex flex-col overflow-hidden">
        {/* marca d'água do monograma, sutil, fixa no canto — mesma linguagem do material de marketing */}
        <Image
          src="/logo/selo-cg.png"
          alt=""
          width={640}
          height={640}
          aria-hidden
          className="pointer-events-none select-none fixed -right-24 -bottom-24 opacity-[0.05] z-0"
        />
        <MobileHeader />
        <main className="relative z-10 flex-1 overflow-y-auto">
          <div className="p-4 md:p-8">
            {children}
          </div>
        </main>
      </div>
      <Toaster richColors position="top-right" />
    </div>
  )
}
