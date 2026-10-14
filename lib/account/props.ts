import { HITTER_PROP_CATEGORIES, PITCHER_PROP_CATEGORIES, thresholdsFor, type PropCategory } from '@/lib/mlb/bettingCategories'
import { NBA_BETTING_CATEGORIES, NBA_BETTING_THRESHOLDS, type NBABettingCategory } from '@/lib/nba/leaderCategories'
import { NFL_BETTING_THRESHOLDS } from '@/lib/nfl/bettingCategories'
import { NHL_GOALIE_BETTING_THRESHOLDS, NHL_SKATER_BETTING_CATEGORIES, NHL_SKATER_BETTING_THRESHOLDS, type NHLSkaterBettingCategory } from '@/lib/nhl/leaderCategories'
import type { BetSport } from './types'

/** Who a player prop is on — only MLB (hitter vs pitcher) and NHL (skater vs goalie) split by role. */
export type PropRole = 'hitter' | 'pitcher' | 'skater' | 'goalie' | 'player'

export interface PropCategoryOption {
  /** Stored on the leg and used to look up thresholds. */
  value: string
  /** Shown on the pill. */
  label: string
}

const NFL_PROPS: PropCategoryOption[] = [
  { value: 'Rush Yards', label: 'Rush Yards' },
  { value: 'Receiving Yards', label: 'Rec Yards' },
  { value: 'Receptions', label: 'Receptions' },
  { value: 'Pass Yards', label: 'Pass Yards' },
  { value: 'Anytime TD', label: 'TDs' },
  { value: 'Completions', label: 'Completions' },
  { value: 'INTs', label: 'INTs' },
]

const NBA_LABEL: Partial<Record<NBABettingCategory, string>> = { '3-Pointers Made': '3-Pointers' }

export function roleOptions(sport: BetSport): { id: PropRole; label: string }[] {
  if (sport === 'mlb') return [{ id: 'hitter', label: 'Hitter' }, { id: 'pitcher', label: 'Pitcher' }]
  if (sport === 'nhl') return [{ id: 'skater', label: 'Skater' }, { id: 'goalie', label: 'Goalie' }]
  return []
}

export function defaultRole(sport: BetSport): PropRole {
  return sport === 'mlb' ? 'hitter' : sport === 'nhl' ? 'skater' : 'player'
}

export function propCategories(sport: BetSport, role: PropRole): PropCategoryOption[] {
  switch (sport) {
    case 'mlb': {
      const list = role === 'pitcher' ? PITCHER_PROP_CATEGORIES : HITTER_PROP_CATEGORIES
      const label: Record<string, string> = { 'Home Runs': 'HR', RBIs: 'RBI', 'Outs Recorded': 'Outs', 'Walks Allowed': 'Walks' }
      return list.map((c) => ({ value: c, label: label[c] ?? c }))
    }
    case 'nfl':
      return NFL_PROPS
    case 'nba':
      return NBA_BETTING_CATEGORIES.map((c) => ({ value: c, label: NBA_LABEL[c] ?? c }))
    case 'nhl':
      if (role === 'goalie') return [{ value: 'Saves', label: 'Saves' }]
      return NHL_SKATER_BETTING_CATEGORIES.map((c) => ({ value: c, label: c === 'Shots on Goal' ? 'Shots' : c }))
    default:
      return []
  }
}

/** The same threshold ladders the Betting Stats boards use, so tracked lines match the hit-rate tables. */
export function propThresholds(sport: BetSport, role: PropRole, category: string): number[] {
  switch (sport) {
    case 'mlb':
      return thresholdsFor(category as PropCategory, role === 'pitcher' ? 'pitching' : 'hitting')
    case 'nfl':
      return NFL_BETTING_THRESHOLDS[category] ?? []
    case 'nba':
      return NBA_BETTING_THRESHOLDS[category as NBABettingCategory] ?? []
    case 'nhl':
      return role === 'goalie' ? NHL_GOALIE_BETTING_THRESHOLDS.Saves : (NHL_SKATER_BETTING_THRESHOLDS[category as NHLSkaterBettingCategory] ?? [])
    default:
      return []
  }
}

export function propLabel(sport: BetSport, role: PropRole, category: string): string {
  return propCategories(sport, role).find((c) => c.value === category)?.label ?? category
}
