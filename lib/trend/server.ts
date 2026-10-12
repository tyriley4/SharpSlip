import { categoryStatKey, type PropCategory } from '@/lib/mlb/bettingCategories'
import { computeHitRate } from '@/lib/mlb/bettingStats'
import { addHitterGame, addPitcherGame, emptyHitterAgg, emptyPitcherAgg, hitterCategoryValue, pitcherCategoryValue } from '@/lib/mlb/filteredLeaders'
import { getPlayerGameLog } from '@/lib/mlb/api'
import { resolvePlayerIds } from '@/lib/mlb/playerLookup'
import { getAllNBAPlayerSeasonStats, getNBAPlayerGameLog, type NBAPlayerGameLogRow } from '@/lib/nba/api'
import { computeNBAHitRate } from '@/lib/nba/bettingStats'
import { NBA_CURRENT_SEASON } from '@/lib/nba/divisions'
import { NBA_BETTING_STAT_KEY, type NBABettingCategory } from '@/lib/nba/leaderCategories'
import { getActiveNFLSeason } from '@/lib/nfl/api'
import { nflGameStat, type NflBettingSub } from '@/lib/nfl/bettingCategories'
import { loadNflPlayerGames } from '@/lib/nfl/bettingLeaders'
import { getAllNHLGoalieStats, getAllNHLSkaterStats, getNHLPlayerGameLog, type NHLPlayerGameLogRow } from '@/lib/nhl/api'
import { computeNHLHitRate } from '@/lib/nhl/bettingStats'
import { NHL_SKATER_BETTING_STAT_KEY, type NHLSkaterBettingCategory } from '@/lib/nhl/leaderCategories'
import { cbbPlayerSeries } from '@/lib/college/cbbLeaders'
import { cfbPlayerSeries } from '@/lib/college/cfbLeaders'
import { nbaStat, nflStat, nhlGoalieStat, nhlSkaterStat } from '@/lib/scatter/server'
import type { ProSport, Sport } from '@/lib/sport/SportContext'
import { mapWithConcurrency } from '@/lib/utils/concurrency'
import type { TrendResult, TrendSeries } from './types'

const MAX_POINTS = 30
const round2 = (n: number) => Math.round(n * 100) / 100

interface PlayerRef {
  name: string
  team: string
}

/** Rolling value over a trailing window of `size` games, for the last 30 games. */
function rolling<T>(games: T[], size: number, value: (window: T[]) => number): number[] {
  const out = games.map((_, i) => round2(value(games.slice(Math.max(0, i - size + 1), i + 1))))
  return out.slice(-MAX_POINTS)
}

const pct = (hits: number, n: number) => (n > 0 ? (hits / n) * 100 : 0)

// ---------------------------------------------------------------------------
// MLB
// ---------------------------------------------------------------------------

const MLB_COUNT_HITTER = new Set(['HR', 'RBI', 'H', 'R', 'SB', 'K'])
const MLB_COUNT_PITCHER = new Set(['W', 'K', 'SV', 'HLD', 'QS'])

async function mlbTrends(sub: string, mode: string, category: string, threshold: number, players: PlayerRef[]): Promise<TrendSeries[]> {
  const group: 'hitting' | 'pitching' = sub === 'Pitchers' ? 'pitching' : 'hitting'
  const resolved = await resolvePlayerIds(players.map((p) => p.name))
  const byName = new Map(resolved.map((r) => [r.fullName, r.id]))
  const size = 10

  const series = await mapWithConcurrency(players, 5, async (p): Promise<TrendSeries | null> => {
    const id = byName.get(p.name)
    if (!id) return null
    const log = await getPlayerGameLog(id, group)
    if (!log || log.length < 2) return null
    const games = [...log].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    if (mode === 'betting') {
      const key = categoryStatKey(category as PropCategory, group)
      return { name: p.name, team: p.team, points: rolling(games, size, (w) => computeHitRate(w, key, threshold).hitRate) }
    }

    return {
      name: p.name,
      team: p.team,
      points: rolling(games, size, (w) => {
        if (group === 'hitting') {
          const agg = emptyHitterAgg()
          w.forEach((g) => addHitterGame(agg, g))
          const v = hitterCategoryValue(agg, category)
          return MLB_COUNT_HITTER.has(category) ? v / w.length : v
        }
        const agg = emptyPitcherAgg()
        w.forEach((g) => addPitcherGame(agg, g))
        const v = pitcherCategoryValue(agg, category)
        return MLB_COUNT_PITCHER.has(category) ? v / w.length : v
      }),
    }
  })
  return series.filter((s): s is TrendSeries => s !== null)
}

// ---------------------------------------------------------------------------
// NFL
// ---------------------------------------------------------------------------

const NFL_COUNT = new Set(['Pass Yds', 'TDs', 'Rush Yds', 'INTs', 'Rec', 'Rec Yds', 'Fumbles', 'Targets'])

async function nflTrends(sub: string, mode: string, category: string, threshold: number, players: PlayerRef[]): Promise<TrendSeries[]> {
  if (!['QB', 'RB', 'WR', 'TE'].includes(sub)) return []
  const pool = await loadNflPlayerGames(sub as NflBettingSub, await getActiveNFLSeason())
  const byName = new Map(pool.map((p) => [p.name, p]))
  const size = 3

  const out: TrendSeries[] = []
  for (const p of players) {
    const entry = byName.get(p.name)
    if (!entry) continue
    const games = [...entry.games].sort((a, b) => a.week - b.week)
    if (games.length < 2) continue
    if (mode === 'betting') {
      out.push({ name: p.name, team: p.team, points: rolling(games, size, (w) => pct(w.filter((g) => nflGameStat(g.row, category) >= threshold).length, w.length)) })
    } else {
      out.push({
        name: p.name,
        team: p.team,
        points: rolling(games, size, (w) => {
          const v = nflStat(sub, category, w) ?? 0
          return NFL_COUNT.has(category) ? v / w.length : v
        }),
      })
    }
  }
  return out
}

// ---------------------------------------------------------------------------
// NBA
// ---------------------------------------------------------------------------

async function nbaTrends(sub: string, mode: string, category: string, threshold: number, players: PlayerRef[]): Promise<TrendSeries[]> {
  if (sub !== 'Players') return []
  const all = await getAllNBAPlayerSeasonStats(NBA_CURRENT_SEASON)
  if (!all) return []
  const byName = new Map(all.map((p) => [p.name, p.playerId]))
  const size = 10

  const series = await mapWithConcurrency(players, 5, async (p): Promise<TrendSeries | null> => {
    const id = byName.get(p.name)
    if (!id) return null
    const log = await getNBAPlayerGameLog(id, NBA_CURRENT_SEASON)
    if (!log || log.length < 2) return null
    const games: NBAPlayerGameLogRow[] = [...log].sort((a, b) => new Date(a.gameDate).getTime() - new Date(b.gameDate).getTime())
    if (mode === 'betting') {
      const key = NBA_BETTING_STAT_KEY[category as NBABettingCategory]
      return { name: p.name, team: p.team, points: rolling(games, size, (w) => computeNBAHitRate(w, key, threshold).hitRate) }
    }
    return { name: p.name, team: p.team, points: rolling(games, size, (w) => nbaStat(category, w) ?? 0) }
  })
  return series.filter((s): s is TrendSeries => s !== null)
}

// ---------------------------------------------------------------------------
// NHL
// ---------------------------------------------------------------------------

const NHL_RATIO = new Set(['SV%', 'GAA', '+/-'])

async function nhlTrends(sub: string, mode: string, category: string, threshold: number, players: PlayerRef[]): Promise<TrendSeries[]> {
  if (sub !== 'Skaters' && sub !== 'Goalies') return []
  const goalie = sub === 'Goalies'
  const all = goalie ? await getAllNHLGoalieStats() : await getAllNHLSkaterStats()
  if (!all) return []
  const byName = new Map(all.map((p) => [p.name, p.playerId]))
  const size = 10

  const series = await mapWithConcurrency(players, 5, async (p): Promise<TrendSeries | null> => {
    const id = byName.get(p.name)
    if (!id) return null
    const log = await getNHLPlayerGameLog(id)
    if (!log || log.length < 2) return null
    const games: NHLPlayerGameLogRow[] = [...log]
      .filter((g) => !goalie || g.decision !== null)
      .sort((a, b) => new Date(a.gameDate).getTime() - new Date(b.gameDate).getTime())
    if (games.length < 2) return null

    if (mode === 'betting') {
      const key = goalie ? 'saves' : NHL_SKATER_BETTING_STAT_KEY[category as NHLSkaterBettingCategory]
      return { name: p.name, team: p.team, points: rolling(games, size, (w) => computeNHLHitRate(w, key, threshold).hitRate) }
    }
    return {
      name: p.name,
      team: p.team,
      points: rolling(games, size, (w) => {
        const v = (goalie ? nhlGoalieStat(category, w) : nhlSkaterStat(category, w)) ?? 0
        return NHL_RATIO.has(category) ? v : v / w.length
      }),
    }
  })
  return series.filter((s): s is TrendSeries => s !== null)
}

const WINDOW_SIZE: Record<ProSport, number> = { mlb: 10, nfl: 3, nba: 10, nhl: 10 }

async function cbbTrends(mode: string, category: string, threshold: number, players: PlayerRef[]): Promise<TrendSeries[]> {
  const out: TrendSeries[] = []
  for (const p of players) {
    const vals = await cbbPlayerSeries(p.name, p.team, mode === 'betting' ? 'betting' : 'stat', category, threshold)
    if (vals.length < 3) continue
    out.push({ name: p.name, team: p.team, points: rolling(vals, 5, (w) => (mode === 'betting' ? pct(w.reduce((a, b) => a + b, 0), w.length) : w.reduce((a, b) => a + b, 0) / w.length)) })
  }
  return out
}

function cfbTrends(mode: string, category: string, threshold: number, players: PlayerRef[]): TrendSeries[] {
  const out: TrendSeries[] = []
  for (const p of players) {
    const vals = cfbPlayerSeries(p.name, p.team, mode === 'betting' ? 'betting' : 'stat', category, threshold)
    if (vals.length < 2) continue
    const size = 3
    out.push({ name: p.name, team: p.team, points: rolling(vals, size, (w) => (mode === 'betting' ? pct(w.reduce((a, b) => a + b, 0), w.length) : w.reduce((a, b) => a + b, 0) / w.length)) })
  }
  return out
}

export async function buildTrends(sport: Sport, sub: string, mode: 'stat' | 'betting', category: string, threshold: number, players: PlayerRef[]): Promise<TrendResult> {
  const size = sport === 'cfb' ? 3 : sport === 'cbb' ? 5 : (WINDOW_SIZE[sport as ProSport] ?? 10)
  let series: TrendSeries[] = []
  switch (sport) {
    case 'mlb':
      series = await mlbTrends(sub, mode, category, threshold, players)
      break
    case 'nfl':
      series = await nflTrends(sub, mode, category, threshold, players)
      break
    case 'nba':
      series = await nbaTrends(sub, mode, category, threshold, players)
      break
    case 'nhl':
      series = await nhlTrends(sub, mode, category, threshold, players)
      break
    case 'cfb':
      series = cfbTrends(mode, category, threshold, players)
      break
    case 'cbb':
      series = await cbbTrends(mode, category, threshold, players)
      break
  }
  const yLabel = mode === 'betting' ? `Hit rate % (rolling ${size} games)` : `${category} (rolling ${size}-game avg)`
  return { series, yLabel, note: sport === 'nfl' ? 'NFL windows are 3 games because the season is young.' : sport === 'cfb' ? 'College windows are 3 games (12-game seasons).' : undefined }
}
