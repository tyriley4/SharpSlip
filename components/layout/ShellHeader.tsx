'use client'

import { usePathname } from 'next/navigation'
import { ProfileButton } from '@/components/layout/ProfileButton'
import { SportSwitcher } from '@/components/layout/SportSwitcher'

export function ShellHeader() {
  const pathname = usePathname()
  // Home, Parlay and Edges are cross-sport pages with their own filters, so they don't need the
  // header's single-sport switcher.
  const isHome = pathname === '/' || pathname.startsWith('/parlay') || pathname.startsWith('/edges') || pathname.startsWith('/leaders')

  return (
    <div className="sticky top-0 z-20 bg-background/95 px-3.5 pt-3.5 backdrop-blur lg:hidden">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-[22px] font-black tracking-tight">
          <span className="text-text">Sharp</span>
          <span className="text-accent">Slip</span>
        </div>
        <ProfileButton />
      </div>
      {!isHome && <SportSwitcher />}
    </div>
  )
}
