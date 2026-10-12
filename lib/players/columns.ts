import type { PlayerSport } from '@/lib/players/types'

export type PositionCategory = 'mlb-pitcher' | 'mlb-hitter' | 'nfl-qb' | 'nfl-rb' | 'nfl-wrte' | 'cfb-def' | 'nba' | 'nhl-skater' | 'nhl-goalie'

const MLB_PITCHER_POS = new Set(['SP', 'RP', 'CL', 'P'])
const NFL_RB_POS = new Set(['RB', 'FB'])
const NFL_WRTE_POS = new Set(['WR', 'TE'])

export function getPositionCategory(sport: PlayerSport, position: string): PositionCategory {
  const pos = position.toUpperCase()
  if (sport === 'mlb') {
    return MLB_PITCHER_POS.has(pos) ? 'mlb-pitcher' : 'mlb-hitter'
  }
  if (sport === 'nba' || sport === 'cbb') return 'nba'
  if (sport === 'nhl') return pos === 'G' ? 'nhl-goalie' : 'nhl-skater'
  if ((sport === 'cfb' || sport === 'nfl') && !['QB', 'RB', 'FB', 'HB', 'WR', 'TE'].includes(pos)) return 'cfb-def'
  if (pos === 'QB') return 'nfl-qb'
  if (NFL_RB_POS.has(pos)) return 'nfl-rb'
  if (NFL_WRTE_POS.has(pos)) return 'nfl-wrte'
  return 'nfl-rb'
}

export interface RecentFormColumn {
  key: string
  label: string
}

export const RECENT_FORM_COLUMNS: Record<PositionCategory, RecentFormColumn[]> = {
  'mlb-pitcher': [
    { key: 'ip', label: 'IP' },
    { key: 'h', label: 'H' },
    { key: 'er', label: 'ER' },
    { key: 'k', label: 'K' },
    { key: 'bb', label: 'BB' },
  ],
  'mlb-hitter': [
    { key: 'ab', label: 'AB' },
    { key: 'h', label: 'H' },
    { key: 'hr', label: 'HR' },
    { key: 'rbi', label: 'RBI' },
    { key: 'bb', label: 'BB' },
    { key: 'avg', label: 'AVG' },
  ],
  'nfl-qb': [
    { key: 'comp', label: 'COMP' },
    { key: 'yds', label: 'YDS' },
    { key: 'td', label: 'TD' },
    { key: 'int', label: 'INT' },
    { key: 'rating', label: 'RATING' },
  ],
  'nfl-rb': [
    { key: 'att', label: 'ATT' },
    { key: 'yds', label: 'YDS' },
    { key: 'ypc', label: 'YPC' },
    { key: 'td', label: 'TD' },
  ],
  'nfl-wrte': [
    { key: 'tgt', label: 'TGT' },
    { key: 'rec', label: 'REC' },
    { key: 'yds', label: 'YDS' },
    { key: 'td', label: 'TD' },
  ],
  'cfb-def': [
    { key: 'tkl', label: 'TKL' },
    { key: 'sack', label: 'SACK' },
    { key: 'tfl', label: 'TFL' },
    { key: 'pd', label: 'PD' },
    { key: 'int', label: 'INT' },
  ],
  nba: [
    { key: 'pts', label: 'PTS' },
    { key: 'reb', label: 'REB' },
    { key: 'ast', label: 'AST' },
    { key: 'stl', label: 'STL' },
    { key: 'blk', label: 'BLK' },
    { key: 'min', label: 'MIN' },
  ],
  'nhl-skater': [
    { key: 'g', label: 'G' },
    { key: 'a', label: 'A' },
    { key: 'pts', label: 'PTS' },
    { key: 'plusMinus', label: '+/-' },
    { key: 'sog', label: 'SOG' },
    { key: 'toi', label: 'TOI' },
  ],
  'nhl-goalie': [
    { key: 'dec', label: 'DEC' },
    { key: 'sa', label: 'SA' },
    { key: 'sv', label: 'SV' },
    { key: 'ga', label: 'GA' },
    { key: 'svPct', label: 'SV%' },
    { key: 'toi', label: 'TOI' },
  ],
}

/** Stat keys that should render in green when "good" / red when "bad", per position category. */
export const GOOD_STAT_KEYS: Record<PositionCategory, string[]> = {
  'mlb-pitcher': ['k'],
  'mlb-hitter': ['h', 'hr', 'rbi'],
  'nfl-qb': ['yds', 'td', 'rating'],
  'nfl-rb': ['yds', 'td'],
  'nfl-wrte': ['yds', 'td'],
  'cfb-def': ['tkl', 'sack', 'tfl'],
  nba: ['pts', 'reb', 'ast'],
  'nhl-skater': ['g', 'a', 'pts'],
  'nhl-goalie': ['sv', 'svPct'],
}

export const BAD_STAT_KEYS: Record<PositionCategory, string[]> = {
  'mlb-pitcher': ['er', 'bb'],
  'mlb-hitter': [],
  'nfl-qb': ['int'],
  'nfl-rb': [],
  'nfl-wrte': [],
  'cfb-def': [],
  nba: [],
  'nhl-skater': [],
  'nhl-goalie': ['ga'],
}
