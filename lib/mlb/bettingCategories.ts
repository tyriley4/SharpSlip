export const HITTER_PROP_CATEGORIES = [
  'Hits',
  'Total Bases',
  'Home Runs',
  'RBIs',
  'Runs',
  'Walks',
  'Stolen Bases',
  'Strikeouts',
] as const
export type HitterPropCategory = (typeof HITTER_PROP_CATEGORIES)[number]

export const PITCHER_PROP_CATEGORIES = [
  'Strikeouts',
  'Outs Recorded',
  'Hits Allowed',
  'Walks Allowed',
  'Earned Runs',
] as const
export type PitcherPropCategory = (typeof PITCHER_PROP_CATEGORIES)[number]

export type PropCategory = HitterPropCategory | PitcherPropCategory

export const PROP_THRESHOLDS: Record<Exclude<PropCategory, 'Strikeouts'>, number[]> = {
  Hits: [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4],
  'Total Bases': [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5],
  'Home Runs': [0.5, 1, 1.5, 2],
  RBIs: [0.5, 1, 1.5, 2, 2.5, 3],
  Runs: [0.5, 1, 1.5, 2],
  Walks: [0.5, 1, 1.5, 2],
  'Stolen Bases': [0.5, 1, 1.5],
  // NOTE: 'Strikeouts' is shared by both pools; the hitter-side thresholds are looked up via
  // hitterStrikeoutThresholds/pitcherStrikeoutThresholds below since the label collides.
  'Outs Recorded': [9.5, 11.5, 12.5, 14.5, 15.5, 17.5, 18.5],
  'Hits Allowed': [3.5, 4.5, 5.5, 6.5, 7.5],
  'Walks Allowed': [0.5, 1.5, 2.5, 3.5],
  'Earned Runs': [0.5, 1.5, 2.5, 3.5],
}

const HITTER_STRIKEOUT_THRESHOLDS = [0.5, 1, 1.5, 2, 2.5, 3]
const PITCHER_STRIKEOUT_THRESHOLDS = [3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5]

/** Strikeouts has different threshold ladders for hitters vs pitchers, so look up by group. */
export function thresholdsFor(category: PropCategory, group: 'hitting' | 'pitching'): number[] {
  if (category === 'Strikeouts') {
    return group === 'hitting' ? HITTER_STRIKEOUT_THRESHOLDS : PITCHER_STRIKEOUT_THRESHOLDS
  }
  return PROP_THRESHOLDS[category]
}

export function formatThreshold(n: number): string {
  return `${n}+`
}

/** Maps a category to the raw per-game stat field on a gameLog entry. */
export function categoryStatKey(category: PropCategory, group: 'hitting' | 'pitching'): string {
  switch (category) {
    case 'Hits':
      return 'hits'
    case 'Total Bases':
      return 'totalBases'
    case 'Home Runs':
      return 'homeRuns'
    case 'RBIs':
      return 'rbi'
    case 'Runs':
      return 'runs'
    case 'Walks':
      return 'baseOnBalls'
    case 'Stolen Bases':
      return 'stolenBases'
    case 'Strikeouts':
      return 'strikeOuts'
    case 'Outs Recorded':
      return 'outs'
    case 'Hits Allowed':
      return 'hits'
    case 'Walks Allowed':
      return 'baseOnBalls'
    case 'Earned Runs':
      return 'earnedRuns'
    default:
      return group === 'hitting' ? 'hits' : 'strikeOuts'
  }
}
