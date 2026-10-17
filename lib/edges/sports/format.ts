import { q } from '../evidenceFramework'
import type { Edge, EdgeCategory, EvidenceLayer, Horizon } from '../types'

/**
 * Shared pieces for the sport evidence modules: number formatting in the way a bettor writes it, and one builder that turns
 * a finished sentence into an evidence item with the weight its priority tier carries.
 *
 * Priority tiers (the same for every sport):
 *   1 tonight-specific context   2 opponent-specific   3 recent form at the number
 *   4 situational records        5 season records      6 historical patterns
 */
export type Tier = 1 | 2 | 3 | 4 | 5 | 6

const WEIGHT: Record<Tier, number> = { 1: 0.2, 2: 0.18, 3: 0.16, 4: 0.13, 5: 0.1, 6: 0.06 }

export const f1 = (n: number) => n.toFixed(1)
export const f2 = (n: number) => n.toFixed(2)
/** A batting average the way it is printed: .389 */
export const avg3 = (n: number) => n.toFixed(3).replace(/^0/, '')
export const signed = (n: number, digits = 1) => `${n > 0 ? '+' : ''}${n.toFixed(digits)}`
export const lineText = (n: number) => `${n > 0 ? '+' : ''}${n}`
export const ordinal = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`
}
/** Innings the way baseball writes them: 12 1/3 is 12.1, 5 2/3 is 5.2. */
export function inn(n: number): string {
  let w = Math.floor(n + 1e-6)
  let f = Math.round((n - w) * 3)
  if (f === 3) {
    w += 1
    f = 0
  }
  return `${w}.${f}`
}
export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
export const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0)
export const pct0 = (r: number) => `${Math.round(r * 100)}%`

/** "5-1" or "5-1-1" with pushes. */
export const recText = (r: { w: number; l: number; p?: number }) => `${r.w}-${r.l}${r.p ? `-${r.p}` : ''}`

const sampleScore = (n: number | undefined) => (n === undefined ? 1 : n >= 30 ? 3 : n >= 15 ? 2 : 1)

export interface EvInput {
  tier: Tier
  text: string
  category: EdgeCategory
  horizon: Horizon
  /** 0-1: how strongly this item points the bet's way. */
  relevance: number
  /** The raw numbers behind the sentence (shown as the item's detail line). */
  support: string
  /** Games behind the item. */
  n?: number
  /** Days since the newest game behind the item, when it is recent form. */
  ageDays?: number
  seasonsAgo?: number
  layer?: EvidenceLayer
  metrics?: Edge['metrics']
  /** Set when the item rests on fewer games than is normally enough: it is shown as an early-season signal. */
  smallSample?: boolean
  /** Weight multiplier on top of the tier (college opponent tiers, risk-lowered items). */
  scale?: number
}

export function ev(i: EvInput): Edge {
  const recency = i.ageDays !== undefined ? (i.ageDays <= 14 ? 3 : i.ageDays <= 45 ? 2 : 1) : (i.seasonsAgo ?? 0) === 0 ? 2 : 1
  return {
    description: i.text,
    category: i.category,
    horizon: i.horizon,
    layer: i.layer,
    relevanceScore: Math.max(0.3, Math.min(1, i.relevance)),
    supportingData: i.support,
    weight: WEIGHT[i.tier] * (i.scale ?? 1),
    tier: i.tier,
    sample: i.n,
    ageDays: i.ageDays,
    seasonsAgo: i.seasonsAgo,
    smallSample: i.smallSample && i.n !== undefined ? i.n : undefined,
    metrics: i.metrics,
    quality: q(3, i.tier <= 3 ? 3 : 2, recency, sampleScore(i.n)),
  }
}

/** Relevance from a win-loss record: .6 wins about 0.6 relevance, a perfect record about 1. */
export function recRelevance(w: number, l: number): number {
  const n = w + l
  return n === 0 ? 0.3 : Math.min(1, 0.3 + (w / n - 0.5) * 1.5 + Math.min(0.15, n / 60))
}

/** Plain "Last N" window label. */
export const lastN = (n: number) => `last ${n}`
