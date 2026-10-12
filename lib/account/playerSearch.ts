import { fetchJson } from '@/lib/mlb/fetchJson'
import { getMlbTeamsIndex } from '@/lib/mlb/teams'
import { getAllNBAPlayerSeasonStats } from '@/lib/nba/api'
import { NBA_CURRENT_SEASON } from '@/lib/nba/divisions'
import { getActiveNFLSeason } from '@/lib/nfl/api'
import { loadNflPlayerGames } from '@/lib/nfl/bettingLeaders'
import { getAllNHLGoalieStats, getAllNHLSkaterStats } from '@/lib/nhl/api'
import type { BetSport } from './types'

export interface BetPlayer {
  name: string
  team: string
  position: string
  /** MLB/NHL props are on a role (hitter/pitcher, skater/goalie); other sports use 'player'. */
  role: 'hitter' | 'pitcher' | 'skater' | 'goalie' | 'player'
}

interface MlbRoster {
  roster: { person: { fullName: string }; position: { abbreviation: string; type: string } }[]
}

interface MlbSearch {
  people?: { fullName: string; primaryPosition?: { abbreviation: string; type: string }; currentTeam?: { id: number } }[]
}

async function mlbPlayers(teams: string[], q: string): Promise<BetPlayer[]> {
  const index = await getMlbTeamsIndex()
  if (!index) return []
  const byAbbr = new Map(Array.from(index.values()).map((t) => [t.abbr, t]))
  const byId = new Map(Array.from(index.values()).map((t) => [t.id, t]))

  if (teams.length > 0) {
    const lists = await Promise.all(
      teams.map(async (abbr) => {
        const t = byAbbr.get(abbr)
        if (!t) return []
        const data = await fetchJson<MlbRoster>(`https://statsapi.mlb.com/api/v1/teams/${t.id}/roster?rosterType=active`, 21600, `mlb-roster-${t.id}`)
        return (data?.roster ?? []).map(
          (r): BetPlayer => ({
            name: r.person.fullName,
            team: abbr,
            position: r.position.abbreviation,
            role: r.position.type === 'Pitcher' ? 'pitcher' : 'hitter',
          })
        )
      })
    )
    return lists.flat()
  }

  if (q.length < 2) return []
  const data = await fetchJson<MlbSearch>(`https://statsapi.mlb.com/api/v1/people/search?names=${encodeURIComponent(q)}&sportIds=1&active=true`, 3600, `mlb-search-${q.toLowerCase()}`)
  return (data?.people ?? []).slice(0, 20).map(
    (p): BetPlayer => ({
      name: p.fullName,
      team: p.currentTeam ? (byId.get(p.currentTeam.id)?.abbr ?? '') : '',
      position: p.primaryPosition?.abbreviation ?? '',
      role: p.primaryPosition?.type === 'Pitcher' ? 'pitcher' : 'hitter',
    })
  )
}

async function nflPlayers(): Promise<BetPlayer[]> {
  const season = await getActiveNFLSeason()
  const groups = await Promise.all((['QB', 'RB', 'WR', 'TE'] as const).map(async (pos) => (await loadNflPlayerGames(pos, season)).map((p): BetPlayer => ({ name: p.name, team: p.team, position: pos, role: 'player' }))))
  return groups.flat()
}

async function nhlPlayers(): Promise<BetPlayer[]> {
  const [skaters, goalies] = await Promise.all([getAllNHLSkaterStats(), getAllNHLGoalieStats()])
  return [
    ...(skaters ?? []).map((p): BetPlayer => ({ name: p.name, team: p.teamAbbr, position: p.position, role: 'skater' })),
    ...(goalies ?? []).map((p): BetPlayer => ({ name: p.name, team: p.teamAbbr, position: 'G', role: 'goalie' })),
  ]
}

async function nbaPlayers(): Promise<BetPlayer[]> {
  const all = await getAllNBAPlayerSeasonStats(NBA_CURRENT_SEASON)
  return (all ?? []).map((p): BetPlayer => ({ name: p.name, team: p.teamAbbr, position: p.position, role: 'player' }))
}

/** Players a bettor can pick for a prop: a game's two rosters when teams are given, otherwise a name search. */
export async function searchBetPlayers(sport: BetSport, teams: string[], q: string): Promise<BetPlayer[]> {
  const needle = q.trim().toLowerCase()
  let pool: BetPlayer[]
  if (sport === 'mlb') pool = await mlbPlayers(teams, needle)
  else if (sport === 'nfl') pool = await nflPlayers()
  else if (sport === 'nhl') pool = await nhlPlayers()
  else pool = await nbaPlayers()

  let out = pool
  if (teams.length > 0 && sport !== 'mlb') out = out.filter((p) => teams.includes(p.team))
  if (needle) out = out.filter((p) => p.name.toLowerCase().includes(needle))
  else if (teams.length === 0) out = []
  return out.sort((a, b) => a.name.localeCompare(b.name)).slice(0, 60)
}
