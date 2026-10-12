import type { Sport } from '@/lib/sport/SportContext'

/** What the trend-line chart should plot for the players currently on the board. */
export interface TrendQuery {
  sport: Sport
  sub: string
  /** 'stat' = rolling game-stat average; 'betting' = rolling hit rate against `threshold`. */
  mode: 'stat' | 'betting'
  /** Game-stat category label (stat mode) or betting category label (betting mode). */
  category: string
  threshold?: number
}

export interface TrendSeries {
  name: string
  team: string
  /** One value per game, oldest first (at most the last 30 games). */
  points: number[]
}

export interface TrendResult {
  series: TrendSeries[]
  /** Y-axis label, e.g. "Hit rate % (rolling 10 games)". */
  yLabel: string
  note?: string
}
