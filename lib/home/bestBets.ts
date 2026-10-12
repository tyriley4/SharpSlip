import type { TopEdgeResult } from './topEdges'
import type { Edge } from '@/data/breakdown/types'
import type { BetTypePreference, UserSettings } from '@/lib/account/types'

const SINGLE_EDGE_TYPES = ['Moneyline', 'Spread', 'Total', 'Player Props'] as const

function matchesBetType(edge: Edge, pref: BetTypePreference): boolean {
  const label = edge.typeLabel.toLowerCase()
  switch (pref) {
    case 'Total':
      return label.includes('total')
    case 'Player Props':
      return label.includes('prop')
    case 'Spread':
      return label.includes('puck line') || label.includes('spread')
    case 'Moneyline':
      return label.includes('moneyline')
    default:
      return true
  }
}

function gradeRank(grade: string): number {
  if (grade.startsWith('A')) return 3
  if (grade.startsWith('B')) return 2
  return 1
}

export interface BestBetsResult {
  results: TopEdgeResult[]
  personalized: boolean
}

/**
 * Filters today's edges to a user's stated preferences (sport, bet type, risk tolerance). When
 * nothing is set, returns every edge unfiltered with personalized:false so callers can show the
 * "set your preferences" note instead of silently acting on a filter the user never chose.
 */
export function filterBestBets(edges: TopEdgeResult[], settings: UserSettings): BestBetsResult {
  const personalized = settings.betTypePreferences.length > 0 || settings.riskTolerance !== 'none'

  let pool = edges
  if (settings.riskTolerance === 'conservative') pool = pool.filter((e) => gradeRank(e.edge.grade) === 3)
  else if (settings.riskTolerance === 'moderate') pool = pool.filter((e) => gradeRank(e.edge.grade) >= 2)

  // Parlays / Teasers / Round Robin aren't single-edge types, so only the single-bet picks narrow the list.
  const singles = settings.betTypePreferences.filter((t) => (SINGLE_EDGE_TYPES as readonly string[]).includes(t))
  if (singles.length > 0) {
    pool = pool.filter((e) => singles.some((t) => matchesBetType(e.edge, t)))
  }

  const sorted = [...pool].sort((a, b) => b.edge.conf - a.edge.conf)

  return { results: sorted, personalized }
}
