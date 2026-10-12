import Link from 'next/link'
import { slugify } from '@/lib/players/slug'

export function PlayerLink({
  name,
  team,
  sport,
  className,
  stopPropagation,
  children,
}: {
  name: string
  team?: string
  /** Disambiguates college players from pros who share a name. */
  sport?: 'cfb' | 'cbb'
  className?: string
  stopPropagation?: boolean
  children: React.ReactNode
}) {
  const query = [team ? `team=${encodeURIComponent(team)}` : '', sport ? `sport=${sport}` : ''].filter(Boolean).join('&')
  const href = `/players/${slugify(name)}${query ? `?${query}` : ''}`
  return (
    <Link href={href} className={className} onClick={stopPropagation ? (e) => e.stopPropagation() : undefined}>
      {children}
    </Link>
  )
}
