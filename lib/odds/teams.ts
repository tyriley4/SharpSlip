import { NBA_TEAM_NAMES } from '@/lib/nba/divisions'
import { NFL_TEAM_NAMES } from '@/lib/nfl/divisions'
import { NHL_TEAM_NAMES } from '@/lib/nhl/divisions'
import type { Sport } from '@/lib/sport/SportContext'

/** MLB StatsAPI abbreviations → full club names (the app has no static MLB name table). */
export const MLB_TEAM_NAMES: Record<string, string> = {
  AZ: 'Arizona Diamondbacks',
  ATH: 'Athletics',
  ATL: 'Atlanta Braves',
  BAL: 'Baltimore Orioles',
  BOS: 'Boston Red Sox',
  CHC: 'Chicago Cubs',
  CWS: 'Chicago White Sox',
  CIN: 'Cincinnati Reds',
  CLE: 'Cleveland Guardians',
  COL: 'Colorado Rockies',
  DET: 'Detroit Tigers',
  HOU: 'Houston Astros',
  KC: 'Kansas City Royals',
  LAA: 'Los Angeles Angels',
  LAD: 'Los Angeles Dodgers',
  MIA: 'Miami Marlins',
  MIL: 'Milwaukee Brewers',
  MIN: 'Minnesota Twins',
  NYM: 'New York Mets',
  NYY: 'New York Yankees',
  PHI: 'Philadelphia Phillies',
  PIT: 'Pittsburgh Pirates',
  SD: 'San Diego Padres',
  SF: 'San Francisco Giants',
  SEA: 'Seattle Mariners',
  STL: 'St. Louis Cardinals',
  TB: 'Tampa Bay Rays',
  TEX: 'Texas Rangers',
  TOR: 'Toronto Blue Jays',
  WSH: 'Washington Nationals',
}

// College names are registered at runtime from ESPN's team directory (registerTeamNames), since there are 130+ / 360+ clubs.
// The registry lives on globalThis so a hot reload of this module doesn't forget names the cached directory already supplied.
const college = globalThis as unknown as { __sharpslipCollegeNames?: { cfb: Record<string, string>; cbb: Record<string, string> } }
const COLLEGE_NAMES = (college.__sharpslipCollegeNames ??= { cfb: {}, cbb: {} })
const NAMES: Record<Sport, Record<string, string>> = {
  mlb: MLB_TEAM_NAMES,
  nfl: NFL_TEAM_NAMES,
  cfb: COLLEGE_NAMES.cfb,
  nba: NBA_TEAM_NAMES,
  cbb: COLLEGE_NAMES.cbb,
  nhl: NHL_TEAM_NAMES,
}

/** Adds abbreviation → full-name entries for a sport (used for the college leagues) and invalidates the lookup index. */
export function registerTeamNames(sport: Sport, names: Record<string, string>) {
  Object.assign(NAMES[sport], names)
  indexCache.delete(sport)
}

/** Names books use that differ from the names above. */
const EXTRA_NAMES: Record<Sport, Record<string, string>> = {
  mlb: { 'oakland athletics': 'ATH', 'las vegas athletics': 'ATH', 'sacramento athletics': 'ATH', 'cleveland indians': 'CLE', 'arizona d-backs': 'AZ' },
  nfl: { 'washington redskins': 'WAS', 'washington football team': 'WAS' },
  nba: { 'los angeles clippers': 'LAC', 'la lakers': 'LAL' },
  cfb: {},
  cbb: {},
  nhl: { 'utah hockey club': 'UTA', 'utah mammoth': 'UTA', 'montréal canadiens': 'MTL', 'st louis blues': 'STL', 'arizona coyotes': 'UTA' },
}

export function normalizeName(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const indexCache = new Map<Sport, Map<string, string>>()

function index(sport: Sport): Map<string, string> {
  let idx = indexCache.get(sport)
  if (idx) return idx
  idx = new Map()
  for (const [abbr, name] of Object.entries(NAMES[sport])) idx.set(normalizeName(name), abbr)
  for (const [name, abbr] of Object.entries(EXTRA_NAMES[sport])) idx.set(normalizeName(name), abbr)
  indexCache.set(sport, idx)
  return idx
}

/** Maps a sportsbook/team full name ("Los Angeles Dodgers") to the app's abbreviation, or null. */
export function abbrFromTeamName(sport: Sport, name: string): string | null {
  const key = normalizeName(name)
  const idx = index(sport)
  const exact = idx.get(key)
  if (exact) return exact

  // Nickname match: the book's name ends with a club's nickname (last 1–2 words), e.g. "LA Dodgers".
  let best: { abbr: string; len: number } | null = null
  for (const [full, abbr] of Array.from(idx.entries())) {
    const words = full.split(' ')
    for (const take of [2, 1]) {
      if (words.length <= take) continue
      const nick = words.slice(-take).join(' ')
      if (key === nick || key.endsWith(` ${nick}`)) {
        if (!best || nick.length > best.len) best = { abbr, len: nick.length }
      }
    }
  }
  return best?.abbr ?? null
}

export function teamDisplayName(sport: Sport, abbr: string): string {
  return NAMES[sport][abbr] ?? abbr
}
