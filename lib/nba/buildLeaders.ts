import type { LeaderGroup, LeaderRow } from '@/data/leaders/types'
import { getAllNBATeamStats, getNBALeagueLeaders } from './api'
import { NBA_GAME_STAT_CATEGORIES } from './leaderCategories'

function toRows(entries: { name: string; team: string; value: number; display: string }[], ascending: boolean, limit: number): LeaderRow[] {
  const sorted = [...entries].sort((a, b) => (ascending ? a.value - b.value : b.value - a.value)).slice(0, limit)
  return sorted.map((e, i) => ({ rank: i + 1, name: e.name, team: e.team, value: e.display, record: '—', hitPct: 0 }))
}

async function buildTeamCategories(season: string, limit: number): Promise<Record<string, LeaderRow[]>> {
  const teamStats = await getAllNBATeamStats(season)
  if (!teamStats) return {}

  const ppg = teamStats.map((t) => ({ name: t.abbr, team: t.abbr, value: t.pts, display: t.pts.toFixed(1) }))
  const oppPpg = teamStats.map((t) => ({ name: t.abbr, team: t.abbr, value: t.oppPts, display: t.oppPts.toFixed(1) }))
  const fg3Pct = teamStats.map((t) => ({ name: t.abbr, team: t.abbr, value: t.fg3Pct, display: `${(t.fg3Pct * 100).toFixed(1)}%` }))
  const reb = teamStats.map((t) => ({ name: t.abbr, team: t.abbr, value: t.reb, display: t.reb.toFixed(1) }))

  return {
    'Points/G': toRows(ppg, false, limit),
    'Opp Points/G': toRows(oppPpg, true, limit),
    '3P%': toRows(fg3Pct, false, limit),
    'Rebounds/G': toRows(reb, false, limit),
  }
}

export async function buildNbaLeaders(season: string, limit = 15): Promise<LeaderGroup | null> {
  const [teamCats, ...playerCatResults] = await Promise.all([
    buildTeamCategories(season, limit),
    ...NBA_GAME_STAT_CATEGORIES.map((cat) => getNBALeagueLeaders(cat, season)),
  ])

  const anyPlayerData = playerCatResults.some((r) => r !== null)
  if (Object.keys(teamCats).length === 0 && !anyPlayerData) return null

  const playersRows: Record<string, LeaderRow[]> = {}
  NBA_GAME_STAT_CATEGORIES.forEach((cat, i) => {
    const rows = playerCatResults[i]
    playersRows[cat] = rows ? rows.map((r) => ({ rank: r.rank, name: r.name, team: r.teamAbbr, value: r.display, record: '—', hitPct: 0 })) : []
  })

  return {
    subs: ['Players', 'Teams'],
    cats: { Players: [...NBA_GAME_STAT_CATEGORIES], Teams: ['Points/G', 'Opp Points/G', '3P%', 'Rebounds/G'] },
    rows: { Players: playersRows, Teams: teamCats },
  }
}
