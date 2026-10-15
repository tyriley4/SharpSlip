import { NFL_TEAM_DIVISIONS } from '@/lib/nfl/divisions'
import { calculateCareerHitRate, type CareerGame } from '@/lib/props/careerHitRates'

/**
 * Time-period windows for the research tools. One list of options per sport and one pure function that applies a window to a
 * player's game log, so every number on a page can be recomputed instantly in the browser from the log already loaded.
 * The edge engine reads the same windows (its evidence cites "last 15 games", and these filters let a reader check it).
 */

export type ResearchSport = 'mlb' | 'nfl' | 'nba' | 'nhl' | 'cfb' | 'cbb'

export interface WindowOption {
  id: string
  label: string
  /** The log carries no flag for this split (college conference games), so it cannot be computed. */
  unavailable?: string
}

export const DEFAULT_WINDOW = 'season'

const o = (id: string, label: string): WindowOption => ({ id, label })
const last = (n: number) => o(`last${n}`, n === 1 ? 'Last 1 game' : `Last ${n}`)

export const WINDOW_OPTIONS: Record<ResearchSport, WindowOption[]> = {
  mlb: [last(5), last(10), last(15), last(30), o('season', 'Full Season'), o('2seasons', 'Last 2 Seasons'), o('3seasons', 'Last 3 Seasons'), o('career', 'Career'), o('vsOpp', 'vs This Opponent'), o('home', 'Home Only'), o('away', 'Away Only')],
  nfl: [last(1), last(3), last(5), o('season', 'Full Season'), o('2seasons', 'Last 2 Seasons'), o('3seasons', 'Last 3 Seasons'), o('career', 'Career'), o('vsOpp', 'vs This Opponent'), o('home', 'Home Only'), o('away', 'Away Only'), o('division', 'Divisional Only')],
  nba: [last(5), last(10), last(15), last(20), o('season', 'Full Season'), o('2seasons', 'Last 2 Seasons'), o('career', 'Career'), o('vsOpp', 'vs This Opponent'), o('home', 'Home Only'), o('away', 'Away Only'), o('rested', 'Rested (non B2B)'), o('b2b', 'B2B Second Game')],
  nhl: [last(5), last(10), last(20), o('season', 'Full Season'), o('2seasons', 'Last 2 Seasons'), o('career', 'Career'), o('vsOpp', 'vs This Opponent'), o('home', 'Home Only'), o('away', 'Away Only'), o('rested', 'Rested'), o('b2b', 'B2B Second Game')],
  cfb: [last(3), last(5), o('season', 'Full Season'), o('2seasons', 'Last 2 Seasons'), o('career', 'Career'), o('vsOpp', 'vs This Opponent'), { id: 'conf', label: 'Conference Games Only', unavailable: 'Conference games are not flagged in the game logs' }, o('home', 'Home'), o('away', 'Away')],
  cbb: [last(5), last(10), o('season', 'Full Season'), o('2seasons', 'Last 2 Seasons'), o('career', 'Career'), o('vsOpp', 'vs This Opponent'), { id: 'conf', label: 'Conference Games Only', unavailable: 'Conference games are not flagged in the game logs' }, o('home', 'Home'), o('away', 'Away')],
}

export interface WindowContext {
  sport: ResearchSport
  team?: string
  opponent?: string | null
}

export interface WindowResult {
  games: CareerGame[]
  label: string
  /** Why the window is empty or what it covers, in plain words. */
  note?: string
}

const DAY = 86400000
const sortNewest = (games: CareerGame[]) => [...games].sort((a, b) => b.date.localeCompare(a.date))

/** Second games of a back-to-back, by date (same season, one day after the previous game). */
function backToBackDates(sorted: CareerGame[]): Set<string> {
  const out = new Set<string>()
  sorted.forEach((g, i) => {
    const prev = sorted[i + 1]
    if (prev && prev.season === g.season && Math.round((Date.parse(g.date) - Date.parse(prev.date)) / DAY) === 1) out.add(g.date)
  })
  return out
}

export function applyWindow(allGames: CareerGame[], id: string, ctx: WindowContext): WindowResult {
  const sorted = sortNewest(allGames)
  const labels = Array.from(new Set(sorted.map((g) => g.season)))
  const current = sorted.filter((g) => g.season === labels[0])
  const label = WINDOW_OPTIONS[ctx.sport].find((w) => w.id === id)?.label ?? id
  const lastN = /^last(\d+)$/.exec(id)
  if (lastN) return { games: sorted.slice(0, Number(lastN[1])), label }
  switch (id) {
    case 'season':
      return { games: current, label }
    case '2seasons':
      return { games: sorted.filter((g) => labels.slice(0, 2).includes(g.season)), label }
    case '3seasons':
      return { games: sorted.filter((g) => labels.slice(0, 3).includes(g.season)), label }
    case 'career':
      return { games: sorted, label }
    case 'vsOpp':
      return ctx.opponent ? { games: sorted.filter((g) => g.opp === ctx.opponent), label: `vs ${ctx.opponent}`, note: 'Every meeting in the log, newest first' } : { games: [], label, note: 'No opponent is scheduled for this team today' }
    case 'home':
      return { games: current.filter((g) => g.home === true), label, note: 'This season' }
    case 'away':
      return { games: current.filter((g) => g.home === false), label, note: 'This season' }
    case 'division': {
      const div = ctx.team ? NFL_TEAM_DIVISIONS[ctx.team] : undefined
      return { games: div ? sorted.filter((g) => g.opp && NFL_TEAM_DIVISIONS[g.opp] === div) : [], label, note: 'Every divisional game in the log' }
    }
    case 'b2b': {
      const set = backToBackDates(sorted)
      return { games: current.filter((g) => set.has(g.date)), label, note: 'This season' }
    }
    case 'rested': {
      const set = backToBackDates(sorted)
      return { games: current.filter((g) => !set.has(g.date)), label, note: 'This season' }
    }
    default:
      return { games: [], label, note: WINDOW_OPTIONS[ctx.sport].find((w) => w.id === id)?.unavailable }
  }
}

/** Per-game average of every category in the games. */
export function averages(games: CareerGame[]): Record<string, number> {
  const sums: Record<string, { s: number; n: number }> = {}
  for (const g of games) {
    for (const [k, v] of Object.entries(g.values)) {
      if (typeof v !== 'number') continue
      const cell = (sums[k] ??= { s: 0, n: 0 })
      cell.s += v
      cell.n++
    }
  }
  return Object.fromEntries(Object.entries(sums).map(([k, { s, n }]) => [k, Math.round((s / n) * 10) / 10]))
}

/** Categories worth showing for a player, in the log's own order. */
export function categoriesOf(games: CareerGame[]): string[] {
  const keys = games[0] ? Object.keys(games[0].values) : []
  return keys.filter((k) => k !== 'Anytime TD')
}

export interface HitCompare {
  window: { rate: number; record: string; n: number }
  season: { rate: number; record: string; n: number }
  /** Window rate minus season rate, in points. */
  gap: number
  /** The two differ by 12+ points: worth investigating. */
  diverges: boolean
}

/** Hit rate at a threshold in the selected window, set beside the full-season rate. */
export function compareHitRates(all: CareerGame[], windowId: string, ctx: WindowContext, category: string, threshold: number): HitCompare | null {
  const win = applyWindow(all, windowId, ctx)
  const season = applyWindow(all, 'season', ctx)
  const w = calculateCareerHitRate(win.games, category, threshold)
  const s = calculateCareerHitRate(season.games, category, threshold)
  if (w.gamesPlayed === 0 || s.gamesPlayed === 0) return null
  const gap = Math.round((w.hitRate - s.hitRate) * 10) / 10
  return { window: { rate: w.hitRate, record: w.record, n: w.gamesPlayed }, season: { rate: s.hitRate, record: s.record, n: s.gamesPlayed }, gap, diverges: Math.abs(gap) >= 12 }
}
