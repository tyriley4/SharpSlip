import type { Edge, Horizon } from './types'

export type HorizonGroup = 'tonight' | 'current' | 'historical'

/** Which horizon an evidence item belongs to: tagged by its module, or read from its wording for the older modules. */
export function horizonOf(e: Edge): Horizon {
  if (e.horizon) return e.horizon
  const text = e.description
  const last = /last (\d+)/i.exec(text)
  if (e.category === 'h2h') return /last 3 meetings|each of the last 3/i.test(text) ? 'recent_meetings' : e.seasonsAgo !== undefined && e.seasonsAgo >= 1 ? 'career_vs_opp' : 'season_vs_opp'
  if (e.category === 'recent_form') {
    const n = last ? Number(last[1]) : 5
    return n <= 7 ? 'last7' : n <= 15 ? 'last15' : 'last30'
  }
  if (e.category === 'hit_rate') {
    if (/career|last \d+ seasons|over the last \d seasons?/i.test(text) || (e.seasonsAgo ?? 0) >= 1) return 'career'
    if (/last 30 days|improving/i.test(text)) return 'last30'
    return 'season'
  }
  return 'tonight'
}

/** Tonight's conditions, the current season (including its recent windows), or the historical record. */
export function horizonGroup(h: Horizon): HorizonGroup {
  if (h === 'tonight') return 'tonight'
  if (h === 'career' || h === 'career_vs_opp' || h === 'recent_meetings') return 'historical'
  return 'current'
}
