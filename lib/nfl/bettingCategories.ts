export const NFL_BETTING_SUBS = ['QB', 'RB', 'WR', 'TE'] as const
export type NflBettingSub = (typeof NFL_BETTING_SUBS)[number]

export const NFL_BETTING_CATEGORIES: Record<NflBettingSub, string[]> = {
  QB: ['Pass Yards', 'TD Passes', 'Completions', 'INTs', 'Rush Yards', 'Anytime TD'],
  RB: ['Rush Yards', 'Receiving Yards', 'Receptions', 'Anytime TD'],
  WR: ['Receiving Yards', 'Receptions', 'Anytime TD'],
  TE: ['Receiving Yards', 'Receptions', 'Anytime TD'],
}

export const NFL_BETTING_THRESHOLDS: Record<string, number[]> = {
  'Rush Yards': [29.5, 49.5, 59.5, 74.5, 89.5, 99.5],
  'Receiving Yards': [19.5, 29.5, 39.5, 49.5, 59.5, 74.5, 89.5],
  Receptions: [0.5, 1.5, 2.5, 3.5, 4.5, 5.5],
  'Anytime TD': [1],
  'Pass Yards': [199.5, 224.5, 249.5, 274.5, 299.5, 324.5],
  'TD Passes': [0.5, 1.5, 2.5],
  Completions: [19.5, 24.5, 29.5],
  INTs: [0.5, 1.5],
}

export function isNflBettingSub(sub: string): sub is NflBettingSub {
  return (NFL_BETTING_SUBS as readonly string[]).includes(sub)
}

export function formatNflBettingThreshold(category: string, t: number): string {
  return category === 'Anytime TD' ? 'Scores a TD' : `${t}+`
}

function n(v: string | undefined): number {
  const parsed = Number(v)
  return Number.isFinite(parsed) ? parsed : 0
}

/** The per-game stat a betting category is measured on, from one nflverse weekly row. */
export function nflGameStat(row: Record<string, string>, category: string): number {
  switch (category) {
    case 'Rush Yards':
      return n(row.rushing_yards)
    case 'Receiving Yards':
      return n(row.receiving_yards)
    case 'Receptions':
      return n(row.receptions)
    case 'Anytime TD':
      return n(row.rushing_tds) + n(row.receiving_tds)
    case 'Pass Yards':
      return n(row.passing_yards)
    case 'TD Passes':
      return n(row.passing_tds)
    case 'Completions':
      return n(row.completions)
    case 'INTs':
      return n(row.interceptions)
    default:
      return 0
  }
}
