import type { PlayerGameRecord, TeamGameRecord } from './types'

/** Minimum games before a rate counts as evidence rather than noise. */
export const MIN_SEASON_GAMES = 10
export const MIN_CAREER_GAMES = 20
export const MIN_SPLIT_GAMES = 8
/** A hit rate at or below this is not a meaningful signal. */
export const MIN_SIGNAL_RATE = 0.52

/** Player history: current season counts double, older seasons fade. */
export function playerSeasonWeight(seasonsAgo: number): number {
  return seasonsAgo <= 0 ? 2.0 : seasonsAgo === 1 ? 1.5 : seasonsAgo === 2 ? 1.0 : 0.75
}

/** Team history: a rolling three-season window; roster turnover makes anything older unusable. */
export function teamSeasonWeight(seasonsAgo: number): number {
  return seasonsAgo <= 0 ? 2.0 : seasonsAgo === 1 ? 1.25 : seasonsAgo === 2 ? 0.75 : 0
}

/** Module-1 recency multipliers by how many days ago the evidence is from. */
export function recencyMultiplier(daysAgo: number): number {
  if (daysAgo <= 7) return 1.5
  if (daysAgo <= 14) return 1.25
  if (daysAgo <= 30) return 1.0
  return 0.85
}

export const daysSince = (isoDate: string, now = Date.now()) => Math.max(0, (now - Date.parse(isoDate)) / 86400000)

export interface Rate {
  /** 0-1, recency-weighted. */
  rate: number
  /** Unweighted hits and games, for record-style display. */
  hits: number
  games: number
}

/** Position of each season label among the labels present, newest = 0. */
export function seasonIndex(labels: string[]): Map<string, number> {
  const uniq = Array.from(new Set(labels)).sort().reverse()
  return new Map(uniq.map((l, i) => [l, i]))
}

/** Recency-weighted hit rate for a player over his logged games. */
export function weightedPlayerRate(games: PlayerGameRecord[], hit: (g: PlayerGameRecord) => boolean | null): Rate | null {
  const idx = seasonIndex(games.map((g) => g.season))
  let w = 0
  let hw = 0
  let hits = 0
  let n = 0
  for (const g of games) {
    const r = hit(g)
    if (r === null) continue
    const weight = playerSeasonWeight(idx.get(g.season) ?? 0)
    w += weight
    n++
    if (r) {
      hw += weight
      hits++
    }
  }
  return n === 0 ? null : { rate: hw / w, hits, games: n }
}

/** Recency-weighted rate for a team over the last three seasons only. */
export function weightedTeamRate(games: TeamGameRecord[], hit: (g: TeamGameRecord) => boolean | null): Rate | null {
  const seasons = Array.from(new Set(games.map((g) => g.season))).sort((a, b) => b - a)
  const idx = new Map(seasons.map((s, i) => [s, i]))
  let w = 0
  let hw = 0
  let hits = 0
  let n = 0
  for (const g of games) {
    const r = hit(g)
    if (r === null) continue
    const weight = teamSeasonWeight(idx.get(g.season) ?? 0)
    if (weight === 0) continue
    w += weight
    n++
    if (r) {
      hw += weight
      hits++
    }
  }
  return n === 0 ? null : { rate: hw / w, hits, games: n }
}

export const pct = (rate: number) => Math.round(rate * 100)
