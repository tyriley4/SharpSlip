import fs from 'node:fs'
import path from 'node:path'
import { ESPN_REF, getStandings, getTeamList } from '@/lib/espn/api'
import { cached } from '@/lib/net/ttlCache'
import { registerTeamNames } from '@/lib/odds/teams'

/**
 * Who plays in college football's FBS and Division I basketball: every team's name, colors, logo and
 * conference. Conference membership comes from ESPN's standings (the only feed that lists it); colors,
 * logos and names come from the team list. Cached 24 hours.
 */

export type CollegeSport = 'cfb' | 'cbb'

export interface CollegeTeam {
  id: string
  abbr: string
  name: string
  shortName: string
  nickname: string
  location: string
  color: string
  alternateColor: string | null
  logo: string | null
  conference: string
  conferenceAbbr: string
  /** Division within the conference, when it has them (e.g. Sun Belt East/West). */
  division: string | null
}

export interface CollegeConference {
  name: string
  abbr: string
  teamIds: string[]
}

export interface CollegeDirectory {
  sport: CollegeSport
  teams: CollegeTeam[]
  byId: Map<string, CollegeTeam>
  byAbbr: Map<string, CollegeTeam>
  conferences: CollegeConference[]
  /** abbr → hex color, handy for UI components keyed by abbreviation. */
  colors: Record<string, string>
}

/** Short, readable conference labels for badges (ESPN's abbreviations are inconsistent across sports). */
const CONFERENCE_SHORT: Record<string, string> = {
  'Southeastern Conference': 'SEC',
  'Big Ten Conference': 'Big Ten',
  'Big 12 Conference': 'Big 12',
  'Atlantic Coast Conference': 'ACC',
  'Pac-12 Conference': 'Pac-12',
  'American Conference': 'American',
  'Conference USA': 'CUSA',
  'Mid-American Conference': 'MAC',
  'Mountain West Conference': 'MWC',
  'Sun Belt Conference': 'Sun Belt',
  'FBS Independents': 'IND',
  'Big East Conference': 'Big East',
  'Atlantic 10 Conference': 'A-10',
  'West Coast Conference': 'WCC',
  'Missouri Valley Conference': 'MVC',
}

export function conferenceShort(name: string, fallback = ''): string {
  const trimmed = name.replace(/ Conference$/, '')
  // ESPN's own codes for the small basketball conferences are lowercase slugs ("bsky", "aeast"); the name reads better.
  return CONFERENCE_SHORT[name] ?? (fallback && !/^[a-z]+$/.test(fallback) ? fallback : trimmed)
}

/** The Power 4 conferences (plus Notre Dame's independent standing is shown by its own group). */
export const POWER_CONFERENCES = ['Southeastern Conference', 'Big Ten Conference', 'Big 12 Conference', 'Atlantic Coast Conference']

async function build(sport: CollegeSport): Promise<CollegeDirectory | null> {
  const { sport: espnSport, league } = ESPN_REF[sport]
  const [groups, list] = await Promise.all([getStandings(espnSport, league), getTeamList(espnSport, league)])
  if (!groups || !list) return null
  const info = new Map(list.map((t) => [t.id, t]))

  const teams: CollegeTeam[] = []
  const confs = new Map<string, CollegeConference>()
  for (const g of groups) {
    const abbr = conferenceShort(g.conference, g.conferenceAbbr)
    const conf = confs.get(g.conference) ?? { name: g.conference, abbr, teamIds: [] }
    confs.set(g.conference, conf)
    for (const e of g.entries) {
      const t = info.get(e.teamId)
      if (!t || conf.teamIds.includes(e.teamId)) continue
      conf.teamIds.push(e.teamId)
      teams.push({
        id: t.id,
        abbr: t.abbr,
        name: t.name,
        shortName: t.shortName,
        nickname: t.nickname,
        location: t.location,
        color: t.color ?? '#4d9fff',
        alternateColor: t.alternateColor,
        logo: t.logo ?? e.logo,
        conference: g.conference,
        conferenceAbbr: abbr,
        division: g.division,
      })
    }
  }
  if (teams.length === 0) return null
  registerTeamNames(sport, Object.fromEntries(teams.map((t) => [t.abbr, t.name])))
  return {
    sport,
    teams,
    byId: new Map(teams.map((t) => [t.id, t])),
    byAbbr: new Map(teams.map((t) => [t.abbr, t])),
    conferences: Array.from(confs.values()),
    colors: Object.fromEntries(teams.map((t) => [t.abbr, t.color])),
  }
}

type Stored = { at: number; teams: CollegeTeam[]; conferences: CollegeConference[] }

function hydrate(sport: CollegeSport, s: Stored): CollegeDirectory {
  registerTeamNames(sport, Object.fromEntries(s.teams.map((t) => [t.abbr, t.name])))
  return {
    sport,
    teams: s.teams,
    byId: new Map(s.teams.map((t) => [t.id, t])),
    byAbbr: new Map(s.teams.map((t) => [t.abbr, t])),
    conferences: s.conferences,
    colors: Object.fromEntries(s.teams.map((t) => [t.abbr, t.color])),
  }
}

const FILE = (sport: CollegeSport) => path.join(process.cwd(), '.data', `college-directory-${sport}.json`)

/** Cached in memory for 24h and on disk, because rebuilding means pulling ESPN's multi-megabyte standings feed. */
export async function getCollegeDirectory(sport: CollegeSport): Promise<CollegeDirectory | null> {
  return cached(`college:directory:v2:${sport}`, 86400, async () => {
    try {
      const stored = JSON.parse(fs.readFileSync(FILE(sport), 'utf8')) as Stored
      if (Date.now() - stored.at < 86400 * 1000 && stored.teams.length > 0) return hydrate(sport, stored)
    } catch {
      // no usable file yet
    }
    const built = await build(sport)
    if (built) {
      try {
        fs.mkdirSync(path.dirname(FILE(sport)), { recursive: true })
        fs.writeFileSync(FILE(sport), JSON.stringify({ at: Date.now(), teams: built.teams, conferences: built.conferences } satisfies Stored))
      } catch (err) {
        console.error('[college] could not persist directory', (err as Error).message)
      }
    }
    return built
  })
}

/** Team lookup by ESPN id or abbreviation. */
export async function findCollegeTeam(sport: CollegeSport, idOrAbbr: string): Promise<CollegeTeam | null> {
  const dir = await getCollegeDirectory(sport)
  if (!dir) return null
  return dir.byId.get(idOrAbbr) ?? dir.byAbbr.get(idOrAbbr) ?? dir.byAbbr.get(idOrAbbr.toUpperCase()) ?? null
}
