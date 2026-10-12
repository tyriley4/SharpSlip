import { TeamLink } from '@/components/teams/TeamLink'
import type { Sport } from '@/lib/sport/SportContext'

/**
 * Renders "AWAY @ HOME" with each team abbreviation linking to its team page. Meant to sit inside a
 * card whose own link is a stretched overlay (see `CardOverlayLink`), so the team links are raised above it.
 */
export function MatchupLinks({ sport, matchup, className = '' }: { sport: Sport; matchup: string; className?: string }) {
  const parts = matchup.split(' @ ')
  if (parts.length !== 2) return <span className={className}>{matchup}</span>
  const link = 'relative z-10 pointer-events-auto hover:text-accent hover:underline'
  return (
    <span className={className}>
      <TeamLink sport={sport} abbr={parts[0]} className={link}>
        {parts[0]}
      </TeamLink>
      {' @ '}
      <TeamLink sport={sport} abbr={parts[1]} className={link}>
        {parts[1]}
      </TeamLink>
    </span>
  )
}
