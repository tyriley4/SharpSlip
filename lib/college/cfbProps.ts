/** Pure CFB prop-market constants shared by the leaders boards and the player-page calculator (safe for client code). */

export type CfbBettingSub = 'QB' | 'RB' | 'WR' | 'TE'
export const CFB_BETTING_SUBS: CfbBettingSub[] = ['QB', 'RB', 'WR', 'TE']

export const CFB_BETTING_CATEGORIES: Record<CfbBettingSub, string[]> = {
  QB: ['Pass Yards', 'Rush Yards', 'Anytime TD'],
  RB: ['Rush Yards', 'Receiving Yards', 'Receptions', 'Anytime TD'],
  WR: ['Receiving Yards', 'Receptions', 'Anytime TD'],
  TE: ['Receiving Yards', 'Receptions', 'Anytime TD'],
}

export const CFB_BETTING_THRESHOLDS: Record<string, number[]> = {
  'Pass Yards': [199.5, 224.5, 249.5, 274.5, 299.5],
  'Rush Yards': [49.5, 74.5, 99.5, 124.5],
  'Receiving Yards': [29.5, 49.5, 74.5, 99.5],
  Receptions: [1.5, 2.5, 3.5, 4.5],
  'Anytime TD': [1],
}

export const isCfbBettingSub = (s: string): s is CfbBettingSub => (CFB_BETTING_SUBS as string[]).includes(s)

export const formatCfbThreshold = (category: string, t: number) => (category === 'Anytime TD' ? 'Scores a TD' : `${t}+`)
