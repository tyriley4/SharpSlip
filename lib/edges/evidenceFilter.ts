import type { Edge } from './types'

/**
 * The evidence quality pass. Every item the sport modules produce goes through this before it can score or surface. An item
 * is rejected when it uses vague phrasing instead of a record, pools two teams into one figure, or has no number in it.
 * (Whether an item applies to tonight is settled where it is written: the sport modules only build items from tonight's
 * own context - the starters, the venue, the line, the opponent - and leave out anything that does not point the bet's way.)
 */
const BANNED: { re: RegExp; why: string }[] = [
  { re: /about \d+% of the time/i, why: 'percentage phrasing instead of a W-L record' },
  { re: /\bexact wager\b|this split\b.*matches|context matches/i, why: 'boilerplate that connects nothing to tonight' },
  { re: /\b\d+ and \d+ games\b/i, why: 'two sample sizes squeezed into one phrase' },
  { re: /\bbet this\b|\byou should\b/i, why: 'advice phrasing' },
  { re: /\bthe same bet\b/i, why: 'boilerplate' },
]

/** A pooled "combined points/runs" figure is only allowed as the closing summary after each team's own numbers. */
function pooled(text: string): boolean {
  if (!/\bcombined\b/i.test(text)) return false
  const before = text.slice(0, text.search(/\bcombined\b/i))
  // Each team named with its own figure first (separated by a semicolon or a colon list) is the permitted shape.
  return !(/;/.test(before) || (before.match(/\d+(\.\d+)?/g) ?? []).length >= 2)
}

export function rejectReason(e: Edge): string | null {
  for (const b of BANNED) if (b.re.test(e.description)) return b.why
  if (pooled(e.description)) return 'combined figure without each team shown separately'
  // Informational caveats (weight 0: a layoff, a status to check) carry no number by nature; everything that scores does.
  if (e.weight > 0 && !/\d/.test(e.description)) return 'no actual number'
  return null
}

/** Keeps the items that pass. */
export const passesEvidenceFilter = (e: Edge) => rejectReason(e) === null
