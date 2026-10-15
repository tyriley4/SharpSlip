import type { Edge } from './types'

/**
 * The quality filter. Every evidence item is scored on four 0-3 criteria and shown only if it clears the minimum:
 *   specificity - does it name tonight's player, opponent, line or threshold?
 *   causality   - is there a direct reason the fact moves this outcome?
 *   recency     - how current is it?
 *   sample      - how many games stand behind it?
 * The minimum is 6 of 12 (for example specificity 2, causality 2, recency 1, sample 1). Items scoring 6-8 are real
 * evidence but lighter, and the card draws them in a muted style; 9-12 is drawn at full weight.
 */
export const MAX_QUALITY = 12
export const MIN_QUALITY = 6
/** At or above this an item is high quality; below it (but passing) it is medium. */
export const HIGH_QUALITY = 9

export type QualityTier = 'high' | 'medium'

function recencyScore(e: Edge): number {
  if (e.ageDays !== undefined && e.ageDays !== null) {
    if (e.ageDays <= 14) return 3
    if (e.ageDays <= 45) return 2
  }
  const s = e.seasonsAgo ?? 0
  return s <= 0 ? 2 : s === 1 ? 1 : 0
}

const sampleScore = (n: number | undefined) => (n === undefined ? 1 : n >= 30 ? 3 : n >= 15 ? 2 : n >= 8 ? 1 : n >= 3 ? 1 : 0)

/** quality = specificity + causality + recency + sample size, each 0-3, 12 at most. */
export function qualityOf(e: Edge): number {
  const q = e.quality
  const spec = q?.specificity ?? 2
  const caus = q?.causality ?? 2
  const rec = q?.recency ?? recencyScore(e)
  const samp = q?.sample ?? sampleScore(e.sample)
  return Math.max(0, Math.min(MAX_QUALITY, spec + caus + rec + samp))
}

export const passesQuality = (e: Edge) => qualityOf(e) >= MIN_QUALITY

export const qualityTier = (score: number): QualityTier => (score >= HIGH_QUALITY ? 'high' : 'medium')
