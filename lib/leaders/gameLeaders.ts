import type { LeaderRow } from '@/data/leaders/types'
import { isCareer, nbaLog, nhlLog } from '@/lib/career/logs'
import { getAllNBAPlayerSeasonStats } from '@/lib/nba/api'
import { NBA_CURRENT_SEASON } from '@/lib/nba/divisions'
import { DEFAULT_NBA_FILTERS, gameMatchesFilters as nbaMatches, type TimeWindow as NbaWindow } from '@/lib/nba/filters'
import { NOTABLE_NBA_PLAYERS } from '@/lib/nba/notablePlayers'
import { getActiveNFLSeason } from '@/lib/nfl/api'
import type { NflBettingSub } from '@/lib/nfl/bettingCategories'
import { loadNflPlayerGames } from '@/lib/nfl/bettingLeaders'
import { DEFAULT_NFL_FILTERS, gameMatchesFilters as nflMatches, type TimeWindow as NflWindow } from '@/lib/nfl/filters'
import { getAllNHLGoalieStats, getAllNHLSkaterStats } from '@/lib/nhl/api'
import { DEFAULT_NHL_FILTERS, gameMatchesFilters as nhlMatches, type TimeWindow as NhlWindow } from '@/lib/nhl/filters'
import { NOTABLE_NHL_GOALIES, NOTABLE_NHL_SKATERS } from '@/lib/nhl/notablePlayers'
import { nbaStat, nflStat, nhlGoalieStat, nhlSkaterStat } from '@/lib/scatter/server'
import type { Sport } from '@/lib/sport/SportContext'
import { mapWithConcurrency } from '@/lib/utils/concurrency'

interface Entry {
  name: string
  team: string
  value: number
  display: string
}

function toRows(entries: Entry[], ascending: boolean, limit: number): LeaderRow[] {
  const sorted = [...entries].sort((a, b) => (ascending ? a.value - b.value : b.value - a.value)).slice(0, limit)
  return sorted.map((e, i) => ({ rank: i + 1, name: e.name, team: e.team, value: e.display, record: '—', hitPct: 0 }))
}

const round1 = (v: number) => (Math.round(v * 10) / 10).toFixed(1)

function nflDisplay(label: string, v: number): string {
  if (label === 'Comp%' || label === 'Target%') return `${round1(v)}%`
  if (label === 'Rating' || label === 'YPC' || label === 'YPR') return round1(v)
  return String(Math.round(v))
}

function nhlDisplay(goalie: boolean, label: string, v: number): string {
  if (goalie) {
    if (label === 'SV%') return v.toFixed(3).replace(/^0/, '')
    if (label === 'GAA') return v.toFixed(2)
    return String(Math.round(v))
  }
  return String(Math.round(v))
}

/**
 * A game-stat leaderboard for a non-season time window (Last 30/14/7 or Career), recomputed from
 * per-game logs. Season boards come pre-built from the leaders page; this covers everything else for
 * NFL, NBA and NHL (MLB has its own filtered-leaders engine).
 */
export async function getWindowedGameLeaders(sport: Exclude<Sport, 'mlb'>, sub: string, category: string, window: string, limit = 40): Promise<LeaderRow[]> {
  const career = isCareer(window)

  if (sport === 'nfl') {
    if (!['QB', 'RB', 'WR', 'TE'].includes(sub)) return []
    const season = await getActiveNFLSeason()
    const players = await loadNflPlayerGames(sub as NflBettingSub, season, career)
    const filters = { ...DEFAULT_NFL_FILTERS, window: window as NflWindow }
    const entries: Entry[] = []
    for (const p of players) {
      const games = p.games.filter((g) => nflMatches(g, filters))
      if (games.length === 0) continue
      const v = nflStat(sub, category, games)
      if (v === null) return []
      entries.push({ name: p.name, team: p.team, value: v, display: nflDisplay(category, v) })
    }
    return toRows(entries, category === 'INTs' || category === 'Fumbles', limit)
  }

  if (sport === 'nba') {
    if (sub !== 'Players') return []
    const all = await getAllNBAPlayerSeasonStats(NBA_CURRENT_SEASON)
    if (!all) return []
    const pool = all.filter((p) => NOTABLE_NBA_PLAYERS.includes(p.name))
    const filters = { ...DEFAULT_NBA_FILTERS, window: window as NbaWindow }
    const rows = await mapWithConcurrency(pool, 6, async (p) => {
      const log = await nbaLog(p.playerId, NBA_CURRENT_SEASON, career)
      const games = (log ?? []).filter((g) => nbaMatches(g, filters))
      if (games.length === 0) return null
      const v = nbaStat(category, games)
      return v === null ? null : { name: p.name, team: p.teamAbbr, value: v, display: round1(v) }
    })
    return toRows(rows.filter((r): r is Entry => r !== null), false, limit)
  }

  if (sub !== 'Skaters' && sub !== 'Goalies') return []
  const goalie = sub === 'Goalies'
  const all = goalie ? await getAllNHLGoalieStats() : await getAllNHLSkaterStats()
  if (!all) return []
  const names = goalie ? NOTABLE_NHL_GOALIES : NOTABLE_NHL_SKATERS
  const filters = { ...DEFAULT_NHL_FILTERS, window: window as NhlWindow }
  const rows = await mapWithConcurrency(
    all.filter((p) => names.includes(p.name)),
    6,
    async (p) => {
      const log = await nhlLog(p.playerId, career)
      const games = (log ?? []).filter((g) => nhlMatches(g, filters) && (!goalie || g.decision !== null))
      if (games.length === 0) return null
      const v = goalie ? nhlGoalieStat(category, games) : nhlSkaterStat(category, games)
      return v === null ? null : { name: p.name, team: p.teamAbbr, value: v, display: nhlDisplay(goalie, category, v) }
    }
  )
  return toRows(rows.filter((r): r is Entry => r !== null), goalie && (category === 'GAA' || category === 'GA'), limit)
}
