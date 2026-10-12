export interface NFLThresholdHitRate {
  threshold: number
  hitRate: number
  wins: number
  losses: number
}

function n(v: string | undefined): number {
  const parsed = Number(v)
  return Number.isFinite(parsed) ? parsed : 0
}

/** Real hit-rate computation over a player's weekly game rows for one stat field and threshold. */
export function computeNFLHitRate(games: Record<string, string>[], statKey: string, threshold: number): NFLThresholdHitRate {
  let wins = 0
  for (const g of games) {
    if (n(g[statKey]) >= threshold) wins++
  }
  const gamesPlayed = games.length
  return {
    threshold,
    hitRate: gamesPlayed > 0 ? Math.round((wins / gamesPlayed) * 1000) / 10 : 0,
    wins,
    losses: gamesPlayed - wins,
  }
}

export function hitRatesForThresholds(games: Record<string, string>[], statKey: string, thresholds: number[]): NFLThresholdHitRate[] {
  return thresholds.map((t) => computeNFLHitRate(games, statKey, t))
}

export function formatNFLThreshold(n: number): string {
  return `${n}+`
}
