import type { RawGameLogEntry } from './api'

export interface HitRateResult {
  hitRate: number
  wins: number
  losses: number
  gamesPlayed: number
}

export interface GameDot {
  date: string
  opp: string
  value: number
  hit: boolean
}

function statValue(g: RawGameLogEntry, statKey: string): number {
  return Number(g.stat[statKey] ?? 0)
}

/** Sorts a game log oldest-first (as returned by the API) into most-recent-first. */
export function mostRecentFirst(games: RawGameLogEntry[]): RawGameLogEntry[] {
  return [...games].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

export function computeHitRate(games: RawGameLogEntry[], statKey: string, threshold: number): HitRateResult {
  let wins = 0
  for (const g of games) {
    if (statValue(g, statKey) >= threshold) wins++
  }
  const gamesPlayed = games.length
  return {
    hitRate: gamesPlayed > 0 ? Math.round((wins / gamesPlayed) * 1000) / 10 : 0,
    wins,
    losses: gamesPlayed - wins,
    gamesPlayed,
  }
}

/** Most-recent-first game dots (green = hit threshold, red = did not). */
export function buildGameDots(
  games: RawGameLogEntry[],
  statKey: string,
  threshold: number,
  count: number,
  teamAbbrById: Map<number, { abbr: string }> | null
): GameDot[] {
  return mostRecentFirst(games)
    .slice(0, count)
    .map((g) => ({
      date: g.date,
      opp: teamAbbrById?.get(g.opponent.id)?.abbr ?? '',
      value: statValue(g, statKey),
      hit: statValue(g, statKey) >= threshold,
    }))
}

export function hitRateTone(hitRate: number): 'green' | 'neutral' | 'red' {
  if (hitRate >= 65) return 'green'
  if (hitRate < 45) return 'red'
  return 'neutral'
}

export function leanForHitRate(hitRate: number): string {
  if (hitRate >= 70) return 'Strong historical hit rate at this line'
  if (hitRate >= 60) return 'Historical data supports the over'
  if (hitRate >= 50) return 'Historical data modestly supports the over'
  return 'Historical data supports the under'
}
