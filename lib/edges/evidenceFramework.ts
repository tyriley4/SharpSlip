import { PLAYOFF_WEIGHTS } from './seasonContext'
import type { Edge, EdgeCategory, EvidenceLayer, SeasonContext } from './types'

/**
 * The four layers a sharp bettor weighs. None is categorically excluded; every item has to earn its place on quality.
 *  1 OPPORTUNITY  - is this player/team positioned to succeed? role, usage, lineup spot, game script, injured opponents.
 *  2 STATISTICAL  - what does the data say? hit rates, streaks, situational records, head to head, venue and month splits.
 *  3 SITUATIONAL  - what is different tonight? weather (outdoor only), injuries, rest and travel.
 *  4 MARKET       - does the case exceed the price? applied in convictionScore, not as an evidence item.
 */
export const LAYER_BY_CATEGORY: Record<EdgeCategory, EvidenceLayer> = {
  role: 'opportunity',
  matchup: 'opportunity',
  recent_form: 'statistical',
  hit_rate: 'statistical',
  h2h: 'statistical',
  context: 'situational',
  situational: 'situational',
}

export const layerOf = (e: Edge): EvidenceLayer => e.layer ?? LAYER_BY_CATEGORY[e.category]

/** Quality sub-scores are 0-3 each; the best possible item is 12 and nothing below this is shown. */
export const MAX_QUALITY = 12
export const MIN_QUALITY = 7

/** Recency weight from the spec: days for recent form, seasons for everything else. */
export function recencyWeight(e: Pick<Edge, 'ageDays' | 'seasonsAgo'>): number {
  if (e.ageDays !== undefined && e.ageDays !== null) {
    if (e.ageDays <= 7) return 1.5
    if (e.ageDays <= 30) return 1.25
  }
  const s = e.seasonsAgo ?? 0
  return s <= 0 ? 1.0 : s === 1 ? 0.85 : s === 2 ? 0.7 : 0.5
}

/** Recency sub-score (0-3) for the quality check. */
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

/** Playoff weighting: team season trends fade, matchup-specific and recent-form evidence rise. */
export function seasonWeightMultiplier(e: Edge, season: SeasonContext): number {
  if (!season.isPlayoffs) return 1
  if (e.category === 'recent_form') return PLAYOFF_WEIGHTS.recentForm
  if (e.category === 'matchup' || e.category === 'h2h' || e.category === 'role') return PLAYOFF_WEIGHTS.matchup
  if (e.category === 'hit_rate' || e.category === 'context') return PLAYOFF_WEIGHTS.teamTrend
  return 1
}

/** Minimum-sample thresholds double in the playoffs, where there are fewer games and every one matters more. */
export const sampleScale = (season: SeasonContext) => (season.isPlayoffs ? PLAYOFF_WEIGHTS.minSampleScale : 1)

/** Convenience for modules: a 4-part quality tuple. */
export const q = (specificity: number, causality: number, recency: number, sample: number) => ({ specificity, causality, recency, sample })

/** Plain-language names for the layers (used in notes). */
export const LAYER_LABEL: Record<EvidenceLayer, string> = {
  opportunity: 'Opportunity',
  statistical: 'Statistical support',
  situational: 'Situation',
  market: 'Market value',
}
