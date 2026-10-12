'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BOTTOM_NAV_TABS, isNavTabActive } from '@/lib/nav/tabs'

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-[540px] border-t border-border bg-background/95 backdrop-blur lg:hidden">
      <div className="flex justify-around px-0 pb-5 pt-2">
        {BOTTOM_NAV_TABS.map(({ href, icon, label }) => {
          const active = isNavTabActive(pathname, href)
          return (
            <Link
              key={href}
              href={href}
              className={`flex min-w-[60px] flex-col items-center gap-0.5 rounded-xl px-4 py-1 transition-colors ${
                active ? 'bg-accent/10 shadow-[0_0_12px_rgba(59,158,255,0.2)]' : ''
              }`}
            >
              <span className="text-xl leading-none">{icon}</span>
              <span
                className={`text-[9px] tracking-wide ${
                  active ? 'font-bold text-accent' : 'font-medium text-muted'
                }`}
              >
                {label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
