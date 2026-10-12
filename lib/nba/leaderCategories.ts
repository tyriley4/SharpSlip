import type { NBAStatKey } from './bettingStats'

export const NBA_GAME_STAT_CATEGORIES = ['PTS', 'REB', 'AST', 'STL', 'BLK', 'FG%', '3P%', 'FT%', 'MIN', 'TO'] as const
export const NBA_BETTING_CATEGORIES = ['Points', 'Rebounds', 'Assists', '3-Pointers Made', 'Steals', 'Blocks', 'PRA'] as const
export type NBABettingCategory = (typeof NBA_BETTING_CATEGORIES)[number]

export const NBA_BETTING_THRESHOLDS: Record<NBABettingCategory, number[]> = {
  Points: [9.5, 14.5, 19.5, 24.5, 29.5, 34.5, 39.5],
  Rebounds: [3.5, 4.5, 5.5, 6.5, 7.5, 8.5, 9.5, 10.5],
  Assists: [2.5, 3.5, 4.5, 5.5, 6.5, 7.5, 8.5, 9.5],
  '3-Pointers Made': [0.5, 1.5, 2.5, 3.5, 4.5],
  Steals: [0.5, 1.5, 2.5],
  Blocks: [0.5, 1.5, 2.5],
  PRA: [19.5, 24.5, 29.5, 34.5, 39.5, 44.5, 49.5],
}

export const NBA_BETTING_STAT_KEY: Record<NBABettingCategory, NBAStatKey> = {
  Points: 'pts',
  Rebounds: 'reb',
  Assists: 'ast',
  '3-Pointers Made': 'fg3m',
  Steals: 'stl',
  Blocks: 'blk',
  PRA: 'pra',
}

export function formatNBAThresholdLadder(cat: NBABettingCategory): number[] {
  return NBA_BETTING_THRESHOLDS[cat]
}
