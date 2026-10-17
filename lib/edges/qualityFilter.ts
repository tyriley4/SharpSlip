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

// ---------------------------------------------------------------------------
// Evidence standard
// ---------------------------------------------------------------------------

/**
 * Every item that scores must carry the five parts of the standard: what is happening, the number behind it, the comparison
 * that makes the number meaningful, why it is meaningful, and its connection to tonight's bet. The first three and the last
 * are checked here (the "why" is a matter of how each item is written); an item missing any of them never scores or surfaces.
 */
const BANNED: { re: RegExp; why: string }[] = [
  { re: /about \d+% of the time/i, why: 'approximation phrasing instead of a record' },
  { re: /\bexact wager\b|\bthe same bet\b|context matches/i, why: 'boilerplate that connects nothing to tonight' },
  { re: /\b\d+ and \d+ games\b/i, why: 'two sample sizes squeezed into one phrase' },
  { re: /\bbet this\b|\byou should\b/i, why: 'advice phrasing' },
  { re: /last (three|four|five|3|4|5) (regular )?seasons|over the last (three|four|five) seasons/i, why: 'team pattern beyond two seasons' },
]

/** Words that make a number a comparison: against an average, an opponent, a rank, a threshold or another player. */
const COMPARISON = /\b\d+(st|nd|rd|th)\b|\b(vs\.?|versus|against|than|from|above|below|compared|league|average|averag\w+|ranks?|ranked|currently|without him|with him|up from|down from)\b|-most\b|-fewest\b|\bper game\b.*\b(vs|against)\b/i
const CONNECTED = /\btonight\b|\btoday\b|\bthis game\b/i
/** A player or team absence counts only when the sentence says what it changes. */
const ABSENCE = /\b(is out|are out|is without|are without|missing|injured reserve|doubtful|questionable|on the injured list)\b/i
const IMPACT = /\b(shift|rais|lower|trim|lose|redistribut|replac|runs the offense|opens|absorb|ceiling|volume|fewer|backup|thinner|short-handed|compromised|pressure|share|project|cuts|depends)/i

/** A pooled "combined" figure is only allowed as the closing summary after each team's own numbers. */
function pooled(text: string): boolean {
  if (!/\bcombined\b/i.test(text)) return false
  const before = text.slice(0, text.search(/\bcombined\b/i))
  return !(/;/.test(before) || (before.match(/\d+(\.\d+)?/g) ?? []).length >= 2)
}

export function rejectReason(e: Edge): string | null {
  const t = e.description
  for (const b of BANNED) if (b.re.test(t)) return b.why
  if (pooled(t)) return 'combined figure without each team shown separately'
  // Informational caveats (weight 0) carry no number by nature; everything that scores does.
  if (e.weight > 0) {
    if (!/\d/.test(t)) return 'no actual number'
    if (!COMPARISON.test(t)) return 'a number with no comparison'
    if (!CONNECTED.test(t)) return "not connected to tonight's bet"
    if (/\b(strong|weak)\b/i.test(t) && !/\d/.test(t)) return '"strong"/"weak" without a number'
    if (/\belevated\b/i.test(t) && !/\b(vs|from|against|than|above|below)\b/i.test(t)) return '"elevated" without defining against what'
    if (ABSENCE.test(t) && !IMPACT.test(t)) return 'an absence with no stated impact'
  }
  return null
}

/** Keeps the items that meet the evidence standard. */
export const meetsStandard = (e: Edge) => rejectReason(e) === null
