import { Sidebar, MobileHeader } from '@/components/layout/sidebar'
import { Toaster } from '@/components/ui/sonner'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#F5F0EA' }}>
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <MobileHeader />
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 md:p-8">
            {children}
          </div>
        </main>
      </div>
      <Toaster richColors position="top-right" />
    </div>
  )
}
