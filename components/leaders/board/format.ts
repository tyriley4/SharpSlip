import { formatProfit, type BettingSort } from '@/lib/betting/rank'
import type { BoardRow } from './types'

export const WHITE = '#F0F2F5'
export const GREEN = '#00E5A0'
export const RED = '#EF4444'

/** Hit-rate text color: 65%+ green, 55–64% white, below 55% red. */
export function hitRateTextColor(pct: number): string {
  if (pct >= 65) return GREEN
  if (pct >= 55) return WHITE
  return RED
}

export interface BettingDisplay {
  /** Headline stat. */
  value: string
  color: string
  /** Smaller muted line under the headline. */
  secondary: string
}

/** How a betting row reads under each sort: a hit-rate %, a W-L record, or flat-bet dollars. */
export function bettingDisplay(row: BoardRow, mode: BettingSort): BettingDisplay {
  const wins = row.wins ?? 0
  const losses = row.losses ?? 0
  const games = row.gamesPlayed ?? wins + losses
  const hitRate = row.hitRate ?? 0

  if (mode === 'W-L Record') {
    return { value: `${wins}-${losses}`, color: WHITE, secondary: `${hitRate}% hit rate` }
  }
  if (mode === 'Conviction Score') {
    const color = row.grade === 'A' ? GREEN : row.grade === 'B' ? '#3B9EFF' : row.grade === 'C' ? '#FFB800' : row.grade === 'D' ? '#FF6B35' : '#4B5058'
    return { value: row.grade ?? '—', color, secondary: row.grade ? `Tonight's conviction: ${row.grade} · ${hitRate}% hit rate` : row.convictionNote ?? `${hitRate}% hit rate · not graded` }
  }
  if (mode === 'Most Profitable') {
    const profit = row.profit ?? 0
    const priced = row.price !== undefined ? ` · ◆ ${row.price > 0 ? '+' : ''}${row.price}` : ''
    return { value: formatProfit(profit), color: profit >= 0 ? GREEN : RED, secondary: `(${games} games${priced})` }
  }
  return { value: `${hitRate}%`, color: hitRateTextColor(hitRate), secondary: `${wins}-${losses} (${games} games)` }
}

/** How far a window's hit rate must sit from the season's before it is flagged as a real shift. */
export const DIVERGENCE_POINTS = 12

/** "Season 58% · hot +18" for a row shown through a narrower window, or null when there is nothing to compare. */
export function seasonCompare(row: Pick<BoardRow, 'hitRate' | 'seasonHitRate'>): { text: string; flag: 'hot' | 'cold' | null; delta: number } | null {
  if (row.hitRate === undefined || row.seasonHitRate === undefined) return null
  const delta = Math.round(row.hitRate - row.seasonHitRate)
  const flag = delta >= DIVERGENCE_POINTS ? 'hot' : delta <= -DIVERGENCE_POINTS ? 'cold' : null
  return { text: `Season ${Math.round(row.seasonHitRate)}%`, flag, delta }
}

export function rowKey(row: Pick<BoardRow, 'name' | 'team'>): string {
  return `${row.name}|${row.team}`
}

/** True when a Team → Player selection exists and this row isn't part of it. */
export function isDimmed(ctx: { selectedPlayers?: string[] }, row: Pick<BoardRow, 'name'>): boolean {
  return !!ctx.selectedPlayers && ctx.selectedPlayers.length > 0 && !ctx.selectedPlayers.includes(row.name)
}

export function isSelected(ctx: { selectedPlayers?: string[] }, row: Pick<BoardRow, 'name'>): boolean {
  return !!ctx.selectedPlayers && ctx.selectedPlayers.includes(row.name)
}
