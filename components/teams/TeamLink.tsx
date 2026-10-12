import Link from 'next/link'
import { teamHref } from '@/lib/teams/links'
import type { Sport } from '@/lib/sport/SportContext'

/** Tappable team name / badge that opens the team page. Works in server and client components. */
export function TeamLink({
  sport,
  abbr,
  className,
  stopPropagation,
  children,
}: {
  sport: Sport
  abbr: string
  className?: string
  stopPropagation?: boolean
  children: React.ReactNode
}) {
  return (
    <Link href={teamHref(sport, abbr)} className={className} onClick={stopPropagation ? (e) => e.stopPropagation() : undefined}>
      {children}
    </Link>
  )
}
