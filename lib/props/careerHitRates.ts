/** Client-safe career hit-rate maths. Career game logs come from /api/player-career; everything here runs in the browser. */

export interface CareerGame {
  /** Season label as the source names it (2026, "2025-26", 20252026). */
  season: string
  date: string
  /** Per-game value of every prop category the player's sport offers, keyed by the category label. */
  values: Record<string, number>
}

export type CareerTrend = 'up' | 'down' | 'stable'

export interface CareerHitRate {
  hitRate: number
  /** "261-126" */
  record: string
  gamesPlayed: number
  seasonsCount: number
  /** Most recent season's rate against the full-career rate: up/down = 5+ points apart. */
  trend: CareerTrend
  lastSeasonRate: number | null
}

const rate = (hits: number, n: number) => (n > 0 ? Math.round((hits / n) * 1000) / 10 : 0)

/** Compares one rate to another: 5+ points above/below is a trend, anything closer is stable. */
export function compareRates(current: number, baseline: number): CareerTrend {
  const d = current - baseline
  return d >= 5 ? 'up' : d <= -5 ? 'down' : 'stable'
}

export function calculateCareerHitRate(gameLogs: CareerGame[], category: string, threshold: number): CareerHitRate {
  const played = gameLogs.filter((g) => typeof g.values[category] === 'number')
  const hits = played.filter((g) => g.values[category] >= threshold).length
  const seasons = Array.from(new Set(played.map((g) => g.season))).sort()
  const careerRate = rate(hits, played.length)

  const last = seasons[seasons.length - 1]
  const lastGames = last ? played.filter((g) => g.season === last) : []
  const lastRate = lastGames.length > 0 ? rate(lastGames.filter((g) => g.values[category] >= threshold).length, lastGames.length) : null

  return {
    hitRate: careerRate,
    record: `${hits}-${played.length - hits}`,
    gamesPlayed: played.length,
    seasonsCount: seasons.length,
    trend: lastRate === null || played.length === 0 ? 'stable' : compareRates(lastRate, careerRate),
    lastSeasonRate: lastRate,
  }
}
