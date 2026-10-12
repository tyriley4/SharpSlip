import type { Sport } from '@/lib/sport/SportContext'

/** Team pages live at /teams/[sport]/[abbr]; the page itself is a "coming soon" state for now. */
export function teamHref(sport: Sport, abbr: string): string {
  return `/teams/${sport}/${encodeURIComponent(abbr.toUpperCase())}`
}
