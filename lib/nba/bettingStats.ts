import type { NBAPlayerGameLogRow } from './api'

export interface NBAThresholdHitRate {
  threshold: number
  hitRate: number
  wins: number
  losses: number
}

export type NBAStatKey = 'pts' | 'reb' | 'ast' | 'stl' | 'blk' | 'fg3m' | 'tov' | 'pra'

function statValue(g: NBAPlayerGameLogRow, key: NBAStatKey): number {
  if (key === 'pra') return g.pts + g.reb + g.ast
  return g[key]
}

export function mostRecentFirst(games: NBAPlayerGameLogRow[]): NBAPlayerGameLogRow[] {
  return [...games].sort((a, b) => new Date(b.gameDate).getTime() - new Date(a.gameDate).getTime())
}

export function computeNBAHitRate(games: NBAPlayerGameLogRow[], key: NBAStatKey, threshold: number): NBAThresholdHitRate {
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

export function hitRatesForThresholds(games: NBAPlayerGameLogRow[], key: NBAStatKey, thresholds: number[]): NBAThresholdHitRate[] {
  return thresholds.map((t) => computeNBAHitRate(games, key, t))
}

export function formatNBAThreshold(n: number): string {
  return `${n}+`
}

export interface NBAGameDot {
  date: string
  opp: string
  value: number
  hit: boolean
}

export function buildNBAGameDots(games: NBAPlayerGameLogRow[], key: NBAStatKey, threshold: number, count: number): NBAGameDot[] {
  return mostRecentFirst(games)
    .slice(0, count)
    .map((g) => ({ date: g.gameDate, opp: g.opponentAbbr, value: statValue(g, key), hit: statValue(g, key) >= threshold }))
}
