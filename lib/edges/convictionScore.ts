import { MIN_QUALITY, qualityOf, recencyWeight, seasonWeightMultiplier, MAX_QUALITY } from './evidenceFramework'
import { PLAYOFF_WEIGHTS } from './seasonContext'
import type { Edge, Grade, SeasonContext } from './types'

export interface ConvictionInput {
  edges: Edge[]
  /** Facts pointing against the outcome. They never reach the user; they only lower the score. */
  conflicts: number
  /** Recency-weighted historical rate of this outcome, 0-1 (null when there is no sample). */
  historicalRate: number | null
  /** Probability implied by a real price, 0-1 (null without real odds). */
  impliedProbability: number | null
  /** Games behind the primary evidence. */
  sampleSize: number
  season: SeasonContext
  /** Best grade this bet may earn (role changes: first game back, new team). */
  gradeCap?: { grade: Grade; note: string }
}

export interface ConvictionOutput {
  convictionScore: number
  grade: Grade
  isSharpFind: boolean
  limitedSample: boolean
  /** One plain sentence about the grade, when it needs explaining. */
  gradeNote?: string
  ungradedReason?: string
}

export const GRADE_A = 0.8
export const GRADE_B = 0.65
export const GRADE_C = 0.5
export const GRADE_D = 0.35
/** The hit rate must beat the implied probability by this much to count as a Sharp Find (6% in the playoffs). */
export const SHARP_GAP = 0.08
const LIMITED_SAMPLE = 10

export const NO_EDGE_NOTE = 'SharpSlip finds no statistical edge at this line'
export const NO_ODDS_NOTE = 'Grade based on statistical evidence — live odds not available'

const ORDER: Grade[] = ['F', 'D', 'C', 'B', 'A']
const worse = (a: Grade, b: Grade): Grade => (ORDER.indexOf(a) <= ORDER.indexOf(b) ? a : b)

/**
 * One evidence item's contribution: how much weight its kind of evidence carries, times how directly it bears on this
 * outcome, scaled by its quality (specificity, causality, recency, sample), its recency weight, opposition quality and
 * the playoff weighting.
 */
export function edgeContribution(e: Edge, season: SeasonContext): number {
  const quality = 0.6 + 0.4 * (qualityOf(e) / MAX_QUALITY)
  return e.weight * e.relevanceScore * quality * recencyWeight(e) * (e.oppositionMultiplier ?? 1) * seasonWeightMultiplier(e, season)
}

/** Kept for the engine's ordering of insights: strongest first. */
export const edgeBaseScore = (e: Edge, season: SeasonContext) => edgeContribution(e, season)

/** Evidence against the outcome lowers the score but is never shown. */
export function conflictPenalty(conflicts: number): number {
  return conflicts <= 0 ? 1 : conflicts === 1 ? 0.92 : conflicts === 2 ? 0.82 : 0.7
}

/**
 * Layer 4, market value. Needs a real price: a hit rate well above what the price implies lifts the grade, a price that
 * already covers the hit rate lowers it, and heavy favourites carry a payout too small to justify the risk.
 */
export function marketMultiplier(historicalRate: number | null, implied: number | null): number {
  if (implied === null) return 1
  let m = 1
  if (historicalRate !== null) {
    const gap = historicalRate - implied
    if (gap > 0.15) m *= 1.25
    else if (gap > 0.08) m *= 1.15
    else if (gap < 0) m *= 0.85
  }
  if (implied > 0.8) m *= 0.65
  else if (implied > 0.7) m *= 0.8
  return m
}

/** Part 6: an extra penalty for heavy favourites, tiered (not stacked). */
export function heavyFavoritePenalty(implied: number | null): number {
  if (implied === null) return 1
  return implied > 0.85 ? 0.62 : implied > 0.75 ? 0.78 : implied > 0.65 ? 0.9 : 1
}

export function gradeFor(score: number): Grade {
  return score >= GRADE_A ? 'A' : score >= GRADE_B ? 'B' : score >= GRADE_C ? 'C' : score >= GRADE_D ? 'D' : 'F'
}

export function scoreConviction(input: ConvictionInput): ConvictionOutput {
  const { conflicts, historicalRate, impliedProbability, sampleSize, season, gradeCap } = input
  const edges = input.edges.filter((e) => qualityOf(e) >= MIN_QUALITY)
  const limitedSample = sampleSize < LIMITED_SAMPLE

  if (edges.length === 0 || historicalRate === null) {
    return { convictionScore: 0, grade: 'F', isSharpFind: false, limitedSample: sampleSize > 0 && limitedSample, gradeNote: 'Insufficient evidence to form a view', ungradedReason: 'Insufficient data' }
  }

  let raw = Math.min(1, edges.reduce((s, e) => s + edgeContribution(e, season), 0))
  raw *= conflictPenalty(conflicts)
  raw *= marketMultiplier(historicalRate, impliedProbability)
  raw *= heavyFavoritePenalty(impliedProbability)
  const convictionScore = Math.round(Math.min(1, raw) * 1000) / 1000

  let grade = gradeFor(convictionScore)
  let gradeNote: string | undefined

  // The market has priced it in: the price implies at least what the history delivers.
  if (impliedProbability !== null && impliedProbability >= historicalRate) {
    grade = 'F'
    gradeNote = NO_EDGE_NOTE
  } else if (grade === 'F') {
    // A thin case is "not enough to say"; a full case that still scores low is "no edge".
    gradeNote = edges.length >= 3 ? NO_EDGE_NOTE : 'Insufficient evidence to form a view'
  }

  // Without a real price the market layer is inactive and the grade cannot pass C.
  if (impliedProbability === null) {
    grade = worse(grade, 'C')
    if (grade !== 'F') gradeNote = NO_ODDS_NOTE
  }
  if (limitedSample && grade !== 'F') grade = worse(grade, 'C')
  if (gradeCap && grade !== 'F') {
    const capped = worse(grade, gradeCap.grade)
    if (capped !== grade) gradeNote = gradeCap.note
    grade = capped
  }
  if (grade === 'D' && !gradeNote) gradeNote = 'Weak evidence — significant uncertainty or conflicting factors'

  const gap = season.isPlayoffs ? PLAYOFF_WEIGHTS.sharpGap : SHARP_GAP
  const isSharpFind = impliedProbability !== null && historicalRate > impliedProbability + gap && !limitedSample && grade !== 'F'
  return { convictionScore, grade, isSharpFind, limitedSample, gradeNote }
}
