import type { BettingLeaderRow } from '@/lib/mlb/bettingLeaders'
import { nflCareerSeasons } from '@/lib/career/seasons'
import { getNFLSchedule, getNFLStatsSeason, getNFLWeeklyPlayerStats, getNFLWeeklyPlayerStatsExact } from './api'
import { nflGameStat, type NflBettingSub } from './bettingCategories'
import { normalizeNflAbbr } from './divisions'
import { gameMatchesFilters, type NFLGameContext, type NFLLeaderFilters } from './filters'

type Row = Record<string, string>

function n(v: string | undefined): number {
  const parsed = Number(v)
  return Number.isFinite(parsed) ? parsed : 0
}

export interface PlayerGame extends NFLGameContext {
  week: number
  row: Row
}

/** A player must average a regular role per game to be ranked (filters out backups with a stray carry). */
function hasRole(sub: NflBettingSub, games: PlayerGame[]): boolean {
  const g = games.length
  if (g === 0) return false
  const sum = (key: string) => games.reduce((s, x) => s + n(x.row[key]), 0)
  if (sub === 'QB') return sum('attempts') / g >= 15
  if (sub === 'RB') return sum('carries') / g >= 4 || sum('targets') / g >= 3
  return sum('targets') / g >= 3
}

/** Game-id format is `season_week_away_home`, so the last segment is the home team. */
function homeFromGameId(gameId: string): string {
  const parts = gameId.split('_')
  return normalizeNflAbbr(parts[parts.length - 1] ?? '')
}

export interface NflPlayerGames {
  id: string
  name: string
  team: string
  games: PlayerGame[]
}

/** Every regular-role player at a position with their weekly games (joined to schedule date, opponent and venue). */
export async function loadNflPlayerGames(sub: NflBettingSub, season: number, career = false): Promise<NflPlayerGames[]> {
  const statsSeason = (await getNFLStatsSeason(season)) ?? season
  let weekly: Row[] | null
  if (career) {
    // Career stitches the last several seasons together (exact files, so nothing is double-counted).
    const parts = await Promise.all(nflCareerSeasons(statsSeason).map((s) => getNFLWeeklyPlayerStatsExact(s)))
    weekly = parts.flatMap((p) => p ?? [])
    if (weekly.length === 0) weekly = null
  } else {
    weekly = await getNFLWeeklyPlayerStats(statsSeason)
  }
  const schedule = await getNFLSchedule(statsSeason)
  if (!weekly) return []

  const dateByGame = new Map<string, string>()
  const allGames = career ? await Promise.all(nflCareerSeasons(statsSeason).map((s) => getNFLSchedule(s))) : [schedule]
  for (const list of allGames) for (const g of list ?? []) dateByGame.set(g.game_id, g.gameday)

  const byPlayer = new Map<string, { name: string; games: PlayerGame[] }>()
  for (const r of weekly) {
    if (r.position !== sub) continue
    const team = normalizeNflAbbr(r.team || r.recent_team)
    const entry = byPlayer.get(r.player_id) ?? { name: r.player_display_name || r.player_name, games: [] }
    entry.games.push({
      date: dateByGame.get(r.game_id) ?? '',
      opponent: normalizeNflAbbr(r.opponent_team),
      isHome: homeFromGameId(r.game_id) === team,
      // season*100 + week keeps games in order across seasons.
      week: n(r.season) * 100 + n(r.week),
      row: r,
    })
    byPlayer.set(r.player_id, entry)
  }

  const players: NflPlayerGames[] = []
  byPlayer.forEach((p, id) => {
    if (!hasRole(sub, p.games)) return
    const latest = p.games.reduce((a, b) => (b.week > a.week ? b : a))
    // Career boards only list players still active in the latest season.
    if (career && latest.week < statsSeason * 100) return
    players.push({ id, name: p.name, team: normalizeNflAbbr(latest.row.team || latest.row.recent_team), games: p.games })
  })
  return players
}

/**
 * Hit rates for NFL skill-position betting categories, computed from the real weekly nflverse
 * game logs (one row per player per game). Qualification (a regular role) is judged on the
 * player's full season, not the filtered games, so a narrow window doesn't disqualify them.
 */
export async function getNflBettingLeaders(
  sub: NflBettingSub,
  category: string,
  threshold: number,
  filters: NFLLeaderFilters,
  season: number,
  limit = 100
): Promise<BettingLeaderRow[]> {
  const players = await loadNflPlayerGames(sub, season, filters.window === 'Career')
  const out: Omit<BettingLeaderRow, 'rank'>[] = []
  players.forEach((p) => {
    const filtered = p.games.filter((g) => gameMatchesFilters(g, filters)).sort((a, b) => b.week - a.week)
    if (filtered.length === 0) return

    const hits = filtered.map((g) => nflGameStat(g.row, category) >= threshold)
    const wins = hits.filter(Boolean).length
    out.push({
      name: p.name,
      team: p.team,
      hitRate: Math.round((wins / filtered.length) * 1000) / 10,
      wins,
      losses: filtered.length - wins,
      gamesPlayed: filtered.length,
      last5: hits.slice(0, 5),
    })
  })

  out.sort((a, b) => b.hitRate - a.hitRate || b.gamesPlayed - a.gamesPlayed)
  return out.slice(0, limit).map((r, i) => ({ rank: i + 1, ...r }))
}
