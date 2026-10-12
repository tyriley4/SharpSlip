import type { RawStandingsRecordGroup, RawTeamStatLine } from '@/lib/mlb/api'
import type { MlbTeamInfo } from '@/lib/mlb/teams'
import { cityFromName, finalizeRows, normalizeStreak } from './common'
import type { SportStandings, StandingsRow } from './types'

const signed = (n: number) => (n > 0 ? `+${n}` : String(n))

export function buildMlbStandings(
  groups: RawStandingsRecordGroup[],
  teams: Map<number, MlbTeamInfo>,
  pitching: RawTeamStatLine[] | null
): SportStandings {
  const eraByTeam = new Map<number, string>()
  for (const t of pitching ?? []) {
    const era = t.stat.era
    if (era !== undefined && era !== '') eraByTeam.set(t.team.id, String(era))
  }

  const rows: StandingsRow[] = []
  for (const group of groups) {
    for (const tr of group.teamRecords) {
      const info = teams.get(tr.team.id)
      if (!info?.divisionName) continue
      const split = (type: string) => {
        const s = tr.records?.splitRecords?.find((x) => x.type === type)
        return s ? `${s.wins}-${s.losses}` : '—'
      }
      const rd = tr.runDifferential ?? tr.runsScored - tr.runsAllowed
      rows.push({
        abbr: info.abbr,
        name: info.name,
        city: cityFromName(info.name),
        conference: info.divisionName.slice(0, 2),
        division: info.divisionName,
        divRank: 0,
        gp: tr.gamesPlayed,
        w: tr.leagueRecord.wins,
        l: tr.leagueRecord.losses,
        t: 0,
        pts: null,
        pct: tr.leagueRecord.pct,
        pctNum: parseFloat(tr.leagueRecord.pct) || 0,
        gb: '',
        home: split('home'),
        away: split('away'),
        last10: split('lastTen'),
        streak: normalizeStreak(tr.streak?.streakCode),
        extras: [
          { key: 'rd', label: 'RD', value: signed(rd) },
          { key: 'era', label: 'ERA', value: eraByTeam.get(tr.team.id) ?? '—' },
        ],
        subline: [
          { key: 'rs', label: 'RS', value: String(tr.runsScored) },
          { key: 'ra', label: 'RA', value: String(tr.runsAllowed) },
        ],
        ats: null,
        ou: null,
      })
    }
  }

  return {
    sport: 'mlb',
    conferences: [
      { id: 'AL', label: 'American League', divisions: ['AL East', 'AL Central', 'AL West'] },
      { id: 'NL', label: 'National League', divisions: ['NL East', 'NL Central', 'NL West'] },
    ],
    rows: finalizeRows(rows),
    totalGames: 162,
    unit: 1,
    tColumn: null,
    playoff: { kind: 'divWc', wildCards: 3 },
  }
}
