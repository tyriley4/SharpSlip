import type { LeaderRow } from '@/data/leaders/types'
import type { StandingsData, StandingsTeam } from '@/data/standings/types'
import type { RawLeader, RawScheduleGame, RawStandingsRecordGroup, RawTeamStatLine } from './api'
import type { MlbTeamInfo } from './teams'

export interface LiveMlbGame {
  id: number
  away: { abbr: string; name: string; score?: number; wins: number; losses: number; pitcher: string }
  home: { abbr: string; name: string; score?: number; wins: number; losses: number; pitcher: string }
  status: 'Preview' | 'Live' | 'Final'
  timeDisplay: string
  venue: string
}

function formatGameTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })
}

export function mapScheduleGame(g: RawScheduleGame): LiveMlbGame {
  const state = g.status.abstractGameState as 'Preview' | 'Live' | 'Final'
  return {
    id: g.gamePk,
    away: {
      abbr: g.teams.away.team.abbreviation ?? g.teams.away.team.name.slice(0, 3).toUpperCase(),
      name: g.teams.away.team.name,
      score: g.teams.away.score,
      wins: g.teams.away.leagueRecord.wins,
      losses: g.teams.away.leagueRecord.losses,
      pitcher: g.teams.away.probablePitcher?.fullName ?? 'TBD',
    },
    home: {
      abbr: g.teams.home.team.abbreviation ?? g.teams.home.team.name.slice(0, 3).toUpperCase(),
      name: g.teams.home.team.name,
      score: g.teams.home.score,
      wins: g.teams.home.leagueRecord.wins,
      losses: g.teams.home.leagueRecord.losses,
      pitcher: g.teams.home.probablePitcher?.fullName ?? 'TBD',
    },
    status: state,
    timeDisplay: state === 'Preview' ? formatGameTime(g.gameDate) : g.status.detailedState,
    venue: g.venue?.name ?? '',
  }
}

export function mapStandings(
  groups: RawStandingsRecordGroup[],
  teams: Map<number, MlbTeamInfo>
): StandingsData {
  const out: StandingsData = {}
  for (const group of groups) {
    const rows: StandingsTeam[] = group.teamRecords
      .slice()
      .sort((a, b) => Number(a.divisionRank) - Number(b.divisionRank))
      .map((tr) => {
        const info = teams.get(tr.team.id)
        return {
          abbr: info?.abbr ?? tr.team.name.slice(0, 3).toUpperCase(),
          w: tr.leagueRecord.wins,
          l: tr.leagueRecord.losses,
          pct: tr.leagueRecord.pct,
          gb: tr.gamesBack === '-' ? '—' : tr.gamesBack.replace(/\.0$/, ''),
          hot: tr.divisionLeader,
        }
      })
    const divisionName = teams.get(group.teamRecords[0]?.team.id)?.divisionName
    if (divisionName) out[divisionName] = rows
  }
  return out
}

/** Builds a team leaderboard for one field of team-level season stats (e.g. AVG, HR, ERA, R/G). */
export function mapTeamCategoryLeaders(
  teamStats: RawTeamStatLine[],
  teams: Map<number, MlbTeamInfo>,
  field: string,
  opts: { perGame?: boolean; ascending?: boolean; limit?: number } = {}
): LeaderRow[] {
  const rows = teamStats.map((t) => {
    const info = teams.get(t.team.id)
    const gamesPlayed = Number(t.stat.gamesPlayed ?? 1)
    const raw = t.stat[field]
    const numeric = opts.perGame ? Number(raw) / (gamesPlayed || 1) : parseFloat(String(raw))
    const display = opts.perGame ? numeric.toFixed(1) : String(raw)
    return {
      name: info?.name ?? t.team.name,
      abbr: info?.abbr ?? t.team.name.slice(0, 3).toUpperCase(),
      numeric,
      display,
    }
  })

  const sorted = rows
    .sort((a, b) => (opts.ascending ? a.numeric - b.numeric : b.numeric - a.numeric))
    .slice(0, opts.limit ?? 15)

  return sorted.map((r, i) => ({
    rank: i + 1,
    name: r.name,
    team: r.abbr,
    value: r.display,
    record: '—',
    hitPct: 0,
  }))
}

export function mapLeaders(leaders: RawLeader[], teams: Map<number, MlbTeamInfo>): LeaderRow[] {
  return leaders.map((l) => ({
    rank: l.rank,
    name: l.person.fullName,
    team: teams.get(l.team.id)?.abbr ?? l.team.name.slice(0, 3).toUpperCase(),
    value: l.value,
    record: '—',
    hitPct: 0,
  }))
}
