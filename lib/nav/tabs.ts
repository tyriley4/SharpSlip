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

/** Mobile/tablet bottom navigation: exactly these five, in this order. Account moved to the profile button in the header. */
export const BOTTOM_NAV_TABS: NavTab[] = ['/', '/games', '/parlay', '/leaders', '/standings']
  .map((href) => NAV_TABS.find((t) => t.href === href))
  .filter((t): t is NavTab => !!t)

export function isNavTabActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname.startsWith(href)
}
