import type { LeaderGroup, LeaderRow } from '@/data/leaders/types'
import { getAllNHLTeamStats, getNHLLeagueLeaders } from './api'
import { NHL_GOALIE_GAME_STAT_CATEGORIES, NHL_SKATER_GAME_STAT_CATEGORIES, NHL_TEAM_GAME_STAT_CATEGORIES } from './leaderCategories'

function formatToi(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

function displayForSkaterCategory(category: string, value: number): string {
  if (category === 'TOI') return formatToi(value)
  if (category === '+/-') return value >= 0 ? `+${value}` : `${value}`
  return String(Math.round(value))
}

function displayForGoalieCategory(category: string, value: number): string {
  if (category === 'SV%') return `${(value * 100).toFixed(1)}%`
  if (category === 'GAA') return value.toFixed(2)
  if (category === 'MIN') return String(Math.round(value / 60))
  return String(Math.round(value))
}

function toRows(entries: { name: string; team: string; value: number; display: string }[], ascending: boolean, limit: number): LeaderRow[] {
  const sorted = [...entries].sort((a, b) => (ascending ? a.value - b.value : b.value - a.value)).slice(0, limit)
  return sorted.map((e, i) => ({ rank: i + 1, name: e.name, team: e.team, value: e.display, record: '—', hitPct: 0 }))
}

async function buildTeamCategories(limit: number): Promise<Record<string, LeaderRow[]>> {
  const teamStats = await getAllNHLTeamStats()
  if (!teamStats) return {}

  const gfg = teamStats.map((t) => ({ name: t.abbr, team: t.abbr, value: t.goalsForPerGame, display: t.goalsForPerGame.toFixed(1) }))
  const gag = teamStats.map((t) => ({ name: t.abbr, team: t.abbr, value: t.goalsAgainstPerGame, display: t.goalsAgainstPerGame.toFixed(1) }))
  const ppPct = teamStats.map((t) => ({ name: t.abbr, team: t.abbr, value: t.powerPlayPct, display: `${(t.powerPlayPct * 100).toFixed(1)}%` }))
  const pkPct = teamStats.map((t) => ({ name: t.abbr, team: t.abbr, value: t.penaltyKillPct, display: `${(t.penaltyKillPct * 100).toFixed(1)}%` }))
  const sogg = teamStats.map((t) => ({ name: t.abbr, team: t.abbr, value: t.shotsForPerGame, display: t.shotsForPerGame.toFixed(1) }))
  const sag = teamStats.map((t) => ({ name: t.abbr, team: t.abbr, value: t.shotsAgainstPerGame, display: t.shotsAgainstPerGame.toFixed(1) }))

  return {
    'GF/G': toRows(gfg, false, limit),
    'GA/G': toRows(gag, true, limit),
    'PP%': toRows(ppPct, false, limit),
    'PK%': toRows(pkPct, false, limit),
    'SOG/G': toRows(sogg, false, limit),
    'SA/G': toRows(sag, true, limit),
  }
}

export async function buildNhlLeaders(limit = 15): Promise<LeaderGroup | null> {
  const [teamCats, skaterResults, goalieResults] = await Promise.all([
    buildTeamCategories(limit),
    Promise.all(NHL_SKATER_GAME_STAT_CATEGORIES.map((cat) => getNHLLeagueLeaders(cat, 'skater', limit))),
    Promise.all(NHL_GOALIE_GAME_STAT_CATEGORIES.map((cat) => getNHLLeagueLeaders(cat, 'goalie', limit))),
  ])

  const anySkaterData = skaterResults.some((r) => r !== null)
  const anyGoalieData = goalieResults.some((r) => r !== null)
  if (Object.keys(teamCats).length === 0 && !anySkaterData && !anyGoalieData) return null

  const skaterRows: Record<string, LeaderRow[]> = {}
  NHL_SKATER_GAME_STAT_CATEGORIES.forEach((cat, i) => {
    const rows = skaterResults[i]
    skaterRows[cat] = rows ? rows.map((r, idx) => ({ rank: idx + 1, name: r.name, team: r.teamAbbr, value: displayForSkaterCategory(cat, r.value), record: '—', hitPct: 0 })) : []
  })

  const goalieRows: Record<string, LeaderRow[]> = {}
  NHL_GOALIE_GAME_STAT_CATEGORIES.forEach((cat, i) => {
    const rows = goalieResults[i]
    goalieRows[cat] = rows ? rows.map((r, idx) => ({ rank: idx + 1, name: r.name, team: r.teamAbbr, value: displayForGoalieCategory(cat, r.value), record: '—', hitPct: 0 })) : []
  })

  return {
    subs: ['Skaters', 'Goalies', 'Teams'],
    cats: {
      Skaters: [...NHL_SKATER_GAME_STAT_CATEGORIES],
      Goalies: [...NHL_GOALIE_GAME_STAT_CATEGORIES],
      Teams: [...NHL_TEAM_GAME_STAT_CATEGORIES],
    },
    rows: { Skaters: skaterRows, Goalies: goalieRows, Teams: teamCats },
  }
}
