import type { NBAStandingsTeam } from '@/lib/nba/api'
import { NBA_EAST_DIVISIONS, NBA_TEAM_NAMES, NBA_WEST_DIVISIONS } from '@/lib/nba/divisions'
import { cityFromName, finalizeRows, formatPct, normalizeStreak } from './common'
import type { SportStandings, StandingsRow } from './types'

export function buildNbaStandings(teams: NBAStandingsTeam[]): SportStandings {
  const rows: StandingsRow[] = teams.map((t) => {
    const name = NBA_TEAM_NAMES[t.abbr] ?? t.abbr
    const gp = t.wins + t.losses
    return {
      abbr: t.abbr,
      name,
      city: cityFromName(name),
      conference: t.conference,
      division: t.division,
      divRank: 0,
      gp,
      w: t.wins,
      l: t.losses,
      t: 0,
      pts: null,
      pct: formatPct(t.winPct),
      pctNum: t.winPct,
      gb: '',
      home: t.home,
      away: t.away,
      last10: t.last10,
      streak: normalizeStreak(t.streak),
      extras: [{ key: 'conf', label: 'CONF', value: t.confRecord }],
      subline: [],
      ats: null,
      ou: null,
    }
  })

  return {
    sport: 'nba',
    conferences: [
      { id: 'East', label: 'Eastern Conference', divisions: NBA_EAST_DIVISIONS },
      { id: 'West', label: 'Western Conference', divisions: NBA_WEST_DIVISIONS },
    ],
    rows: finalizeRows(rows),
    totalGames: 82,
    unit: 1,
    tColumn: null,
    playoff: { kind: 'seeds', direct: 6, playIn: 4 },
  }
}
