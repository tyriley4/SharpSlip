import { normalizeName } from './teams'
import type { PropOffer } from './types'
import type { Sport } from '@/lib/sport/SportContext'

/**
 * Prices of player props that books are offering right now, kept for the Leaders "Most Profitable"
 * sort. Prop prices are only ever pulled when someone opens a game (they cost credits), so this holds
 * whatever has been fetched in the last day; it never makes its own API calls.
 */

interface Remembered {
  line: number
  overPrice: number
  book: string
  at: number
}

const g = globalThis as unknown as { __sharpslipPropPrices?: Map<string, Remembered[]> }
const registry = (g.__sharpslipPropPrices ??= new Map<string, Remembered[]>())
const MAX_AGE_MS = 24 * 3600 * 1000

export function rememberOffers(sport: Sport, offers: PropOffer[]) {
  const now = Date.now()
  for (const o of offers) {
    if (!o.over) continue
    const key = `${sport}|${normalizeName(o.player)}|${o.market}`
    const list = (registry.get(key) ?? []).filter((r) => now - r.at < MAX_AGE_MS && r.line !== o.line)
    list.push({ line: o.line, overPrice: o.over.price, book: o.over.book, at: now })
    registry.set(key, list)
  }
}

/** Which Odds API market a leaderboard category corresponds to, when there is one. */
export function marketFor(sport: Sport, category: string, sub?: string): string | null {
  const c = category.toLowerCase()
  switch (sport) {
    case 'mlb':
      if (sub === 'Pitchers') return c === 'strikeouts' ? 'pitcher_strikeouts' : null
      return c === 'hits' ? 'batter_hits' : c === 'home runs' ? 'batter_home_runs' : null
    case 'nba':
    case 'cbb':
      return c === 'points' ? 'player_points' : c === 'rebounds' ? 'player_rebounds' : c === 'assists' ? 'player_assists' : null
    case 'nhl':
      return c === 'points' ? 'player_points' : c === 'assists' ? 'player_assists' : c === 'shots on goal' ? 'player_shots_on_goal' : null
    case 'nfl':
    case 'cfb':
      return c === 'pass yards' ? 'player_pass_yds' : c === 'rush yards' ? 'player_rush_yds' : c === 'receiving yards' ? 'player_reception_yds' : null
  }
}

/** "stat >= threshold" and "over line" describe the same bet when they round up to the same whole number. */
const sameBet = (threshold: number, line: number) => Math.ceil(threshold) === Math.ceil(line)

/**
 * Adds `price` (the Over's current American price) and `priceBook` to rows whose player has a matching
 * prop on a book right now. Rows without one are returned untouched and are valued at -110 downstream.
 */
export function attachPropPrices<T extends { name: string }>(sport: Sport, category: string, threshold: number, rows: T[], sub?: string): (T & { price?: number; priceBook?: string })[] {
  const market = marketFor(sport, category, sub)
  if (!market) return rows
  const now = Date.now()
  return rows.map((r) => {
    const list = registry.get(`${sport}|${normalizeName(r.name)}|${market}`)
    const hit = list?.find((x) => now - x.at < MAX_AGE_MS && sameBet(threshold, x.line))
    return hit ? { ...r, price: hit.overPrice, priceBook: hit.book } : r
  })
}
