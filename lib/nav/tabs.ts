export interface NavTab {
  href: string
  icon: string
  label: string
}

/** Desktop sidebar navigation. */
export const NAV_TABS: NavTab[] = [
  { href: '/', icon: '⌂', label: 'Home' },
  { href: '/games', icon: '📅', label: 'Games' },
  { href: '/parlay', icon: '🎰', label: 'Parlay' },
  { href: '/leaders', icon: '📊', label: 'Leaders' },
  { href: '/standings', icon: '🏆', label: 'Standings' },
  { href: '/account', icon: '👤', label: 'Account' },
]

/** Mobile/tablet bottom navigation — Leaders stays reachable from the sidebar and Home links. */
export const BOTTOM_NAV_TABS: NavTab[] = NAV_TABS.filter((t) => t.href !== '/leaders')

export function isNavTabActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname.startsWith(href)
}
