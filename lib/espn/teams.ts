import type { Sport } from '@/lib/sport/SportContext'

/** ESPN's team abbreviations that differ from the ones used across this app (MLB StatsAPI, NHL API, stats.nba.com, nflverse). */
const ESPN_TO_APP: Record<Sport, Record<string, string>> = {
  mlb: { CHW: 'CWS', ARI: 'AZ', OAK: 'ATH' },
  nfl: { WSH: 'WAS', LA: 'LAR' },
  nba: { NY: 'NYK', GS: 'GSW', SA: 'SAS', NO: 'NOP', UTAH: 'UTA', WSH: 'WAS' },
  nhl: { SJ: 'SJS', TB: 'TBL', NJ: 'NJD', LA: 'LAK', UTAH: 'UTA' },
  cfb: {},
  cbb: {},
}

export function fromEspnAbbr(sport: Sport, abbr: string): string {
  return ESPN_TO_APP[sport]?.[abbr] ?? abbr
}

export function toEspnAbbr(sport: Sport, abbr: string): string {
  const table = ESPN_TO_APP[sport] ?? {}
  for (const [espn, app] of Object.entries(table)) if (app === abbr) return espn
  return abbr
}
