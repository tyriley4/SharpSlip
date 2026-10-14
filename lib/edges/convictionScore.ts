import type { Edge, Grade } from './types'

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
}

export interface ConvictionOutput {
  convictionScore: number
  grade: Grade | null
  isSharpFind: boolean
  limitedSample: boolean
  ungradedReason?: string
}

export const GRADE_A = 0.75
export const GRADE_B = 0.55
export const GRADE_C = 0.4
/** The hit rate must beat the implied probability by this much to count as a Sharp Find. */
export const SHARP_GAP = 0.08
const LIMITED_SAMPLE = 10

/** baseScore = weight x relevance, with the module recency and opposition multipliers applied. */
export function edgeBaseScore(e: Edge): number {
  return e.weight * e.relevanceScore * (e.recencyMultiplier ?? 1) * (e.oppositionMultiplier ?? 1)
}

export function conflictPenalty(conflicts: number): number {
  return conflicts <= 0 ? 1 : conflicts === 1 ? 0.9 : conflicts === 2 ? 0.8 : 0.65
}

/** Bonus or penalty for how the price compares with the historical hit rate (only with real odds). */
export function marketMultiplier(historicalRate: number | null, implied: number | null): number {
  if (historicalRate === null || implied === null) return 1
  const gap = historicalRate - implied
  if (gap >= 0.1) return 1.25
  if (gap >= 0.05) return 1.15
  if (implied > historicalRate) return 0.85
  return 1
}

export function gradeFor(score: number): Grade | null {
  return score >= GRADE_A ? 'A' : score >= GRADE_B ? 'B' : score >= GRADE_C ? 'C' : null
}

export function scoreConviction(input: ConvictionInput): ConvictionOutput {
  const { edges, conflicts, historicalRate, impliedProbability, sampleSize } = input
  if (edges.length === 0) {
    return { convictionScore: 0, grade: null, isSharpFind: false, limitedSample: sampleSize > 0 && sampleSize < LIMITED_SAMPLE, ungradedReason: 'Insufficient data' }
  }

  let raw = edges.reduce((s, e) => s + edgeBaseScore(e), 0)
  raw = Math.min(1, raw)
  raw *= conflictPenalty(conflicts)
  raw *= marketMultiplier(historicalRate, impliedProbability)
  const convictionScore = Math.round(Math.min(1, raw) * 1000) / 1000

  const limitedSample = sampleSize < LIMITED_SAMPLE
  let grade = gradeFor(convictionScore)
  if (grade && limitedSample && grade !== 'C') grade = 'C'

  const isSharpFind = historicalRate !== null && impliedProbability !== null && historicalRate > impliedProbability + SHARP_GAP && !limitedSample
  return { convictionScore, grade, isSharpFind, limitedSample, ungradedReason: grade ? undefined : 'Insufficient data' }
}
