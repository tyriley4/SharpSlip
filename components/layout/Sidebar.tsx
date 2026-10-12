'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ParlayTeaser } from '@/components/home/ParlayTeaser'
import { SidebarAuthStatus } from '@/components/layout/SidebarAuthStatus'
import { SportSwitcher } from '@/components/layout/SportSwitcher'
import { NAV_TABS, isNavTabActive } from '@/lib/nav/tabs'

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="sticky top-0 hidden h-screen w-[240px] shrink-0 flex-col border-r border-border bg-sidebar lg:flex">
      <div className="flex h-full flex-col gap-6 overflow-y-auto p-5">
        <div>
          <Link href="/" className="text-xl font-black tracking-tight transition-opacity hover:opacity-90">
            <span className="text-text">Sharp</span>
            <span className="text-accent">Slip</span>
          </Link>
          <div className="mt-0.5 text-[10px] font-medium tracking-wide text-muted">Bet Smarter</div>
        </div>

        <SportSwitcher layout="grid" />

        <nav className="flex flex-col gap-1">
          {NAV_TABS.map(({ href, icon, label }) => {
            const active = isNavTabActive(pathname, href)
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 rounded-r-lg border-l-2 px-3 py-2.5 text-sm transition-colors ${
                  active
                    ? 'border-accent bg-accent/10 font-semibold text-text shadow-[0_0_12px_rgba(59,158,255,0.15)]'
                    : 'border-transparent text-text2 hover:border-border2 hover:bg-card hover:text-text'
                }`}
              >
                <span className="text-base leading-none">{icon}</span>
                {label}
              </Link>
            )
          })}
        </nav>

        <div className="mt-auto flex flex-col gap-4">
          <ParlayTeaser />
          <SidebarAuthStatus />
        </div>
      </div>
    </aside>
  )
}
