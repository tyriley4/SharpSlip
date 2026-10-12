import fs from 'node:fs'
import path from 'node:path'
import { getGameSummary, getTeamSchedule, type EspnLeagueSlug, type GameSummary, type SummaryPlayerGroup } from '@/lib/espn/api'
import { cached } from '@/lib/net/ttlCache'

/**
 * Football box scores reduced to what the breakdown tabs need, per team per game.
 *
 * ESPN's league-wide player stat lists are unreliable for college football (the values come back empty),
 * but every game's box score is complete. A team's season is therefore the sum of its box scores: player
 * season totals, last-5 game logs, team yardage for and against, turnovers, sacks. Final games never
 * change, so each parsed game is kept on disk and only fetched once.
 */

export interface BoxPasser {
  id: string
  name: string
  comp: number
  att: number
  yds: number
  td: number
  int: number
  /** ESPN's QBR for the game, when given. */
  qbr: number | null
}

export interface BoxRusher {
  id: string
  name: string
  car: number
  yds: number
  td: number
  long: number
}

export interface BoxReceiver {
  id: string
  name: string
  rec: number
  yds: number
  td: number
  long: number
  /** Targets, only where the feed carries them (NFL does, college doesn't). */
  tgts: number | null
}

export interface BoxDefender {
  id: string
  name: string
  tot: number
  solo: number
  sacks: number
  tfl: number
  pd: number
  hur: number
  td: number
}

export interface BoxInterceptor {
  id: string
  name: string
  int: number
  yds: number
  td: number
}

export interface TeamGameBox {
  eventId: string
  date: string
  week: number | null
  home: boolean
  neutral: boolean
  conferenceGame: boolean
  oppId: string
  oppAbbr: string
  oppName: string
  oppRank: number | null
  ourRank: number | null
  us: number
  them: number
  result: 'W' | 'L' | 'T'
  /** Our team box-score stats and the opponent's (strings as ESPN gives them). */
  team: Record<string, string>
  opp: Record<string, string>
  passing: BoxPasser[]
  rushing: BoxRusher[]
  receiving: BoxReceiver[]
  defense: BoxDefender[]
  interceptions: BoxInterceptor[]
  /** What the opponent's passers did against us (for completion % allowed). */
  oppPassing: BoxPasser[]
  /** Closing line for the game when ESPN had one. */
  line: { homeSpread: number | null; total: number | null } | null
}

const n = (v: string | undefined): number => {
  const x = Number(String(v ?? '').replace(/,/g, ''))
  return Number.isFinite(x) ? x : 0
}

const frac = (v: string | undefined): [number, number] => {
  const [a, b] = String(v ?? '0/0').split('/')
  return [n(a), n(b)]
}

function group(groups: SummaryPlayerGroup[] | undefined, name: string): SummaryPlayerGroup | undefined {
  return groups?.find((g) => g.name === name)
}

function col(g: SummaryPlayerGroup | undefined, ...labels: string[]): number {
  if (!g) return -1
  for (const l of labels) {
    const i = g.labels.indexOf(l)
    if (i >= 0) return i
  }
  return -1
}

function parsePassing(groups: SummaryPlayerGroup[] | undefined): BoxPasser[] {
  const g = group(groups, 'passing')
  if (!g) return []
  const iC = col(g, 'C/ATT')
  const iY = col(g, 'YDS')
  const iT = col(g, 'TD')
  const iI = col(g, 'INT')
  const iQ = col(g, 'QBR')
  return g.athletes.map((a) => {
    const [comp, att] = frac(a.stats[iC])
    const qbr = iQ >= 0 ? Number(a.stats[iQ]) : NaN
    return { id: a.id, name: a.name, comp, att, yds: n(a.stats[iY]), td: n(a.stats[iT]), int: n(a.stats[iI]), qbr: Number.isFinite(qbr) ? qbr : null }
  })
}

function parseRushing(groups: SummaryPlayerGroup[] | undefined): BoxRusher[] {
  const g = group(groups, 'rushing')
  if (!g) return []
  const [iC, iY, iT, iL] = [col(g, 'CAR'), col(g, 'YDS'), col(g, 'TD'), col(g, 'LONG')]
  return g.athletes.map((a) => ({ id: a.id, name: a.name, car: n(a.stats[iC]), yds: n(a.stats[iY]), td: n(a.stats[iT]), long: n(a.stats[iL]) }))
}

function parseReceiving(groups: SummaryPlayerGroup[] | undefined): BoxReceiver[] {
  const g = group(groups, 'receiving')
  if (!g) return []
  const [iR, iY, iT, iL, iG] = [col(g, 'REC'), col(g, 'YDS'), col(g, 'TD'), col(g, 'LONG'), col(g, 'TGTS')]
  return g.athletes.map((a) => ({ id: a.id, name: a.name, rec: n(a.stats[iR]), yds: n(a.stats[iY]), td: n(a.stats[iT]), long: n(a.stats[iL]), tgts: iG >= 0 ? n(a.stats[iG]) : null }))
}

function parseDefense(groups: SummaryPlayerGroup[] | undefined): BoxDefender[] {
  const g = group(groups, 'defensive')
  if (!g) return []
  const [iT, iS, iK, iF, iP, iH, iD] = [col(g, 'TOT'), col(g, 'SOLO'), col(g, 'SACKS'), col(g, 'TFL'), col(g, 'PD'), col(g, 'QB HUR'), col(g, 'TD')]
  return g.athletes.map((a) => ({ id: a.id, name: a.name, tot: n(a.stats[iT]), solo: n(a.stats[iS]), sacks: n(a.stats[iK]), tfl: n(a.stats[iF]), pd: n(a.stats[iP]), hur: n(a.stats[iH]), td: n(a.stats[iD]) }))
}

function parseInts(groups: SummaryPlayerGroup[] | undefined): BoxInterceptor[] {
  const g = group(groups, 'interceptions')
  if (!g) return []
  const [iI, iY, iT] = [col(g, 'INT'), col(g, 'YDS'), col(g, 'TD')]
  return g.athletes.map((a) => ({ id: a.id, name: a.name, int: n(a.stats[iI]), yds: n(a.stats[iY]), td: n(a.stats[iT]) }))
}

/** Reduces one finished game's summary to a team-perspective box. Null when the box score has no player data. */
export function toTeamBox(s: GameSummary, teamId: string): TeamGameBox | null {
  const us = s.teams.find((t) => t.id === teamId)
  const them = s.teams.find((t) => t.id !== teamId)
  if (!us || !them || us.score === null || them.score === null) return null
  const mine = s.players[us.id]
  const theirs = s.players[them.id]
  if (!mine && !theirs) return null
  return {
    eventId: s.gameId,
    date: s.date ?? '',
    week: null,
    home: us.homeAway === 'home',
    neutral: false,
    conferenceGame: false,
    oppId: them.id,
    oppAbbr: them.abbr,
    oppName: them.name,
    oppRank: them.rank,
    ourRank: us.rank,
    us: us.score,
    them: them.score,
    result: us.score > them.score ? 'W' : us.score < them.score ? 'L' : 'T',
    team: s.teamStats[us.id] ?? {},
    opp: s.teamStats[them.id] ?? {},
    passing: parsePassing(mine),
    rushing: parseRushing(mine),
    receiving: parseReceiving(mine),
    defense: parseDefense(mine),
    interceptions: parseInts(mine),
    oppPassing: parsePassing(theirs),
    line: s.odds ? { homeSpread: s.odds.homeSpread, total: s.odds.total } : null,
  }
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

const DIR = path.join(process.cwd(), '.data')
const g = globalThis as unknown as { __sharpslipBoxes?: Map<string, Record<string, TeamGameBox>> }
const stores = (g.__sharpslipBoxes ??= new Map())
const timers = new Map<string, ReturnType<typeof setTimeout>>()

const fileFor = (league: EspnLeagueSlug) => path.join(DIR, `box-${league}.json`)

function store(league: EspnLeagueSlug): Record<string, TeamGameBox> {
  let s = stores.get(league)
  if (!s) {
    try {
      s = JSON.parse(fs.readFileSync(fileFor(league), 'utf8')) as Record<string, TeamGameBox>
    } catch {
      s = {}
    }
    stores.set(league, s)
  }
  return s
}

function flushSoon(league: EspnLeagueSlug) {
  if (timers.has(league)) return
  timers.set(
    league,
    setTimeout(() => {
      timers.delete(league)
      try {
        fs.mkdirSync(DIR, { recursive: true })
        fs.writeFileSync(fileFor(league), JSON.stringify(store(league)))
      } catch (err) {
        console.error('[box] persist failed', (err as Error).message)
      }
    }, 2000)
  )
}

async function pool<T, R>(items: T[], size: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = []
  for (let i = 0; i < items.length; i += size) out.push(...(await Promise.all(items.slice(i, i + size).map(fn))))
  return out
}

/**
 * A team's completed regular-season games as boxes, oldest first. Games not yet on disk are fetched
 * (six at a time) and kept; the schedule call is cached an hour, so a page view costs one request plus
 * one per newly finished game.
 */
export async function getTeamBoxGames(league: EspnLeagueSlug, teamId: string, season?: number): Promise<TeamGameBox[]> {
  const sport = league === 'nfl' || league === 'college-football' ? 'football' : 'basketball'
  const schedule = await getTeamSchedule(sport, league, teamId, season)
  if (!schedule) return []
  const finals = schedule.filter((g) => g.state === 'post' && (g.seasonType === null || g.seasonType === 2))
  const s = store(league)
  const missing = finals.filter((g) => !s[`${g.id}:${teamId}`])
  if (missing.length > 0) {
    console.log(`[box] ${league} team ${teamId}: fetching ${missing.length} box score(s)`)
    await pool(missing, 6, async (g) => {
      const summary = await getGameSummary(sport, league, g.id)
      const box = summary ? toTeamBox(summary, teamId) : null
      if (box) {
        s[`${g.id}:${teamId}`] = { ...box, week: g.week, neutral: g.neutralSite, conferenceGame: g.conferenceGame, date: g.date, oppRank: box.oppRank ?? g.opponent.rank }
        flushSoon(league)
      }
    })
  }
  return finals.map((g) => s[`${g.id}:${teamId}`]).filter((b): b is TeamGameBox => !!b)
}

/** Same as above but memoised in-process for the duration of a page render burst. */
export function teamBoxGames(league: EspnLeagueSlug, teamId: string, season?: number): Promise<TeamGameBox[]> {
  return cached(`box:${league}:${teamId}:${season ?? 'cur'}`, 900, async () => getTeamBoxGames(league, teamId, season)).then((v) => v ?? [])
}
