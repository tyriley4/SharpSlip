import type { NHLPlayerGameLogRow } from './api'

export interface NHLThresholdHitRate {
  threshold: number
  hitRate: number
  wins: number
  losses: number
}

export type NHLStatKey = 'points' | 'goals' | 'assists' | 'shots' | 'saves' | 'goalsAgainst'

function statValue(g: NHLPlayerGameLogRow, key: NHLStatKey): number {
  return g[key]
}

export function mostRecentFirst(games: NHLPlayerGameLogRow[]): NHLPlayerGameLogRow[] {
  return [...games].sort((a, b) => new Date(b.gameDate).getTime() - new Date(a.gameDate).getTime())
}

export function computeNHLHitRate(games: NHLPlayerGameLogRow[], key: NHLStatKey, threshold: number): NHLThresholdHitRate {
  let wins = 0
  for (const g of games) {
    if (statValue(g, key) >= threshold) wins++
  }
  const gamesPlayed = games.length
  return {
    threshold,
    hitRate: gamesPlayed > 0 ? Math.round((wins / gamesPlayed) * 1000) / 10 : 0,
    wins,
    losses: gamesPlayed - wins,
  }
}

export function hitRatesForThresholds(games: NHLPlayerGameLogRow[], key: NHLStatKey, thresholds: number[]): NHLThresholdHitRate[] {
  return thresholds.map((t) => computeNHLHitRate(games, key, t))
}

export function formatNHLThreshold(n: number): string {
  return `${n}+`
}

export interface NHLGameDot {
  date: string
  opp: string
  value: number
  hit: boolean
}

export function buildNHLGameDots(games: NHLPlayerGameLogRow[], key: NHLStatKey, threshold: number, count: number): NHLGameDot[] {
  return mostRecentFirst(games)
    .slice(0, count)
    .map((g) => ({ date: g.gameDate, opp: g.opponentAbbr, value: statValue(g, key), hit: statValue(g, key) >= threshold }))
}
