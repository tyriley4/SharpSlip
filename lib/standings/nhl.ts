import type { NHLStandingsTeam } from '@/lib/nhl/api'
import { NHL_EAST_DIVISIONS, NHL_TEAM_NAMES, NHL_WEST_DIVISIONS } from '@/lib/nhl/divisions'
import { cityFromName, finalizeRows, formatPct, normalizeStreak } from './common'
import type { SportStandings, StandingsRow } from './types'

const signed = (n: number) => (n > 0 ? `+${n}` : String(n))

export function buildNhlStandings(teams: NHLStandingsTeam[]): SportStandings {
  const rows: StandingsRow[] = teams.map((t) => {
    const name = NHL_TEAM_NAMES[t.abbr] ?? t.teamName
    return {
      abbr: t.abbr,
      name,
      city: cityFromName(name),
      conference: t.conference === 'Eastern' ? 'East' : 'West',
      division: t.division,
      divRank: 0,
      gp: t.gamesPlayed,
      w: t.wins,
      l: t.losses,
      t: t.otLosses,
      pts: t.points,
      pct: formatPct(t.pointPct),
      pctNum: t.pointPct,
      gb: '',
      home: t.homeRecord,
      away: t.awayRecord,
      last10: t.last10,
      streak: normalizeStreak(t.streak),
      extras: [
        { key: 'pctp', label: 'P%', value: formatPct(t.pointPct) },
        { key: 'row', label: 'ROW', value: String(t.row) },
        { key: 'diff', label: 'DIFF', value: signed(t.diff) },
      ],
      subline: [
        { key: 'gf', label: 'GF', value: String(t.goalsFor) },
        { key: 'ga', label: 'GA', value: String(t.goalsAgainst) },
      ],
      ats: null,
      ou: null,
    }
  })

  return {
    sport: 'nhl',
    conferences: [
      { id: 'East', label: 'Eastern Conference', divisions: NHL_EAST_DIVISIONS },
      { id: 'West', label: 'Western Conference', divisions: NHL_WEST_DIVISIONS },
    ],
    rows: finalizeRows(rows, {
      byPoints: true,
      tiebreak: (r) => Number(r.extras.find((e) => e.key === 'row')?.value ?? 0) || 0,
    }),
    totalGames: 82,
    unit: 2,
    tColumn: 'OTL',
    playoff: { kind: 'nhl', wildCards: 2 },
  }
}
