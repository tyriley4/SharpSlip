import { BottomNav } from '@/components/layout/BottomNav'
import { ShellHeader } from '@/components/layout/ShellHeader'
import { Sidebar } from '@/components/layout/Sidebar'
import { StockTicker } from '@/components/home/StockTicker'

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[1400px] flex-col bg-background">
      <StockTicker />
      <div className="flex flex-1">
        <Sidebar />
        <div className="min-w-0 flex-1">
          <div className="mx-auto w-full max-w-[540px] md:max-w-none">
            <ShellHeader />
            <main className="pb-24 md:px-8 md:pb-10 md:pt-7">{children}</main>
          </div>
        </div>
        <BottomNav />
      </div>
    </div>
  )
}
