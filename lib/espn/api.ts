import { cachedResult, fetchJsonSafe, type Ttl } from '@/lib/net/ttlCache'
import type { Sport } from '@/lib/sport/SportContext'
import { fromEspnAbbr } from './teams'
import { reportError } from '@/lib/monitoring/sentry'

/**
 * Universal ESPN client. One interface for every sport and league the app covers — all free, no API key.
 *
 *   getScoreboard · getStandings · getTeamInfo · getTeamRoster · getTeamSchedule · getGameSummary ·
 *   getLeagueLeaders · getPlayerStats · getPlayerGameLog · getPlayerProfile · searchPlayer ·
 *   getInjuries · getNews · getRankings · getTeamStats
 *
 * Every function is wrapped in try/catch, returns null (or an empty list) when ESPN errors, and logs the
 * endpoint that failed. Callers own the clean "unavailable" state. Most calls are cached in-process;
 * the lifetimes follow the spec (scoreboards 60s live / 300s idle, standings 30m, rosters and profiles
 * 24h, schedules/stats 1h, injuries 30m, news 1h, rankings 24h, summaries 600s pre / 30s live / 1h final).
 *
 * Two of the spec's endpoints don't exist on ESPN's public API, so equivalents are used and noted inline:
 * `/leaders` (→ site v3 leaders) and `/athletes?search=` (→ common v3 search).
 */

export type EspnSport = 'football' | 'basketball' | 'baseball' | 'hockey'
export type EspnLeagueSlug = 'nfl' | 'college-football' | 'nba' | 'mens-college-basketball' | 'mlb' | 'nhl' | 'wnba'

export interface EspnRef {
  sport: EspnSport
  league: EspnLeagueSlug
}

/** The app's sport ids → ESPN sport/league. */
export const ESPN_REF: Record<Sport, EspnRef> = {
  mlb: { sport: 'baseball', league: 'mlb' },
  nfl: { sport: 'football', league: 'nfl' },
  cfb: { sport: 'football', league: 'college-football' },
  nba: { sport: 'basketball', league: 'nba' },
  cbb: { sport: 'basketball', league: 'mens-college-basketball' },
  nhl: { sport: 'hockey', league: 'nhl' },
}

export const espnRef = (sport: Sport): EspnRef => ESPN_REF[sport]

/** Which app sport an ESPN league belongs to (WNBA isn't an app sport). */
export function appSportOf(ref: EspnRef): Sport | null {
  return (Object.keys(ESPN_REF) as Sport[]).find((s) => ESPN_REF[s].league === ref.league) ?? null
}

const SITE = 'https://site.api.espn.com/apis/site/v2/sports'
const WEB = 'https://site.web.api.espn.com/apis'
const CORE = 'https://sports.core.api.espn.com/v2/sports'

export const TTL = {
  scoreboardLive: 60,
  scoreboardIdle: 300,
  standings: 1800,
  team: 86400,
  roster: 86400,
  schedule: 3600,
  leaders: 3600,
  stats: 3600,
  profile: 86400,
  search: 86400,
  injuries: 1800,
  news: 3600,
  rankings: 86400,
  summaryPre: 600,
  summaryLive: 30,
  summaryFinal: 3600,
} as const

type Json = Record<string, any>

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : Number(String(v).replace(/^[ou]/i, '').replace(/,/g, ''))
  return Number.isFinite(n) ? n : null
}

function price(v: unknown): number | null {
  if (typeof v === 'string' && v.toUpperCase() === 'EVEN') return 100
  return num(v)
}

async function get(url: string, tag: string, timeoutMs = 12000): Promise<Json | null> {
  const res = await fetchJsonSafe<Json>(url, { timeoutMs, cache: 'no-store' }, `espn:${tag}`)
  return res?.data ?? null
}

async function cachedGet<T>(key: string, ttl: Ttl<T>, load: () => Promise<T | null>): Promise<T | null> {
  try {
    const r = await cachedResult(key, ttl, load)
    return r.value
  } catch (err) {
    reportError(err, 'espn')
    console.error(`[espn] ${key} failed`, err)
    return null
  }
}

/** Colleges keep ESPN's abbreviations; pro leagues are mapped onto the app's own. */
function appAbbr(ref: EspnRef, espnAbbr: string): string {
  const s = appSportOf(ref)
  if (!s || s === 'cfb' || s === 'cbb') return espnAbbr
  return fromEspnAbbr(s, espnAbbr)
}

const slug = (ref: EspnRef) => `${ref.sport}/${ref.league}`

// ---------------------------------------------------------------------------
// Scoreboard
// ---------------------------------------------------------------------------

export interface EspnOddsLine {
  provider: string
  /** Home-team point spread (negative = home favored), null when not posted. */
  homeSpread: number | null
  homeSpreadPrice: number | null
  awaySpreadPrice: number | null
  homeMl: number | null
  awayMl: number | null
  total: number | null
  overPrice: number | null
  underPrice: number | null
}

export interface EspnTeamLine {
  id: string
  abbr: string
  espnAbbr: string
  name: string
  shortName: string
  score: number | null
  record: string | null
  logo: string | null
  color: string | null
  /** AP / College Poll rank for college teams, null when unranked. */
  rank: number | null
  winner: boolean
  /** Conference id (college). */
  conferenceId: string | null
}

export interface EspnSituation {
  /** Football: "2nd & 7 at DEN 32". */
  downDistance: string | null
  /** Football: abbreviation of the team with the ball. */
  possession: string | null
  isRedZone: boolean
  /** Baseball */
  outs: number | null
  balls: number | null
  strikes: number | null
  onFirst: boolean
  onSecond: boolean
  onThird: boolean
  lastPlay: string | null
}

export interface EspnGame {
  id: string
  league: EspnLeagueSlug
  /** ISO start time. */
  date: string
  name: string
  shortName: string
  state: 'pre' | 'in' | 'post'
  completed: boolean
  statusText: string
  shortStatus: string
  period: number
  clock: string | null
  away: EspnTeamLine
  home: EspnTeamLine
  network: string | null
  venue: string | null
  venueCity: string | null
  indoor: boolean | null
  neutralSite: boolean
  conferenceGame: boolean
  /** Football week number / basketball has none. */
  week: number | null
  seasonYear: number | null
  /** 1 = preseason, 2 = regular season, 3 = postseason. */
  seasonType: number | null
  headline: string | null
  situation: EspnSituation | null
  odds: EspnOddsLine | null
}

export function parseOdds(raw: Json | undefined): EspnOddsLine | null {
  if (!raw) return null
  const spread = raw.pointSpread
  const total = raw.total
  const ml = raw.moneyline
  const line: EspnOddsLine = {
    provider: raw.provider?.displayName ?? raw.provider?.name ?? 'ESPN BET',
    homeSpread: num(spread?.home?.close?.line) ?? num(raw.spread),
    homeSpreadPrice: price(spread?.home?.close?.odds),
    awaySpreadPrice: price(spread?.away?.close?.odds),
    homeMl: price(ml?.home?.close?.odds),
    awayMl: price(ml?.away?.close?.odds),
    total: num(total?.over?.close?.line) ?? num(raw.overUnder),
    overPrice: price(total?.over?.close?.odds),
    underPrice: price(total?.under?.close?.odds),
  }
  return line.homeSpread !== null || line.total !== null || line.homeMl !== null ? line : null
}

function parseTeam(ref: EspnRef, c: Json | undefined): EspnTeamLine {
  const t = c?.team ?? {}
  const espnAbbr = String(t.abbreviation ?? '')
  const record = (c?.records as Json[] | undefined)?.find((r) => r.type === 'total')?.summary ?? null
  const rawRank = num(c?.curatedRank?.current)
  return {
    id: String(t.id ?? ''),
    abbr: appAbbr(ref, espnAbbr),
    espnAbbr,
    name: String(t.displayName ?? t.name ?? espnAbbr),
    shortName: String(t.shortDisplayName ?? t.name ?? espnAbbr),
    score: num(c?.score?.value ?? c?.score),
    record,
    logo: t.logo ?? t.logos?.[0]?.href ?? null,
    color: t.color ? `#${t.color}` : null,
    rank: rawRank !== null && rawRank >= 1 && rawRank <= 25 ? rawRank : null,
    winner: !!c?.winner,
    conferenceId: t.conferenceId ? String(t.conferenceId) : null,
  }
}

function parseSituation(raw: Json | undefined, homeId: string, awayId: string, homeAbbr: string, awayAbbr: string): EspnSituation | null {
  if (!raw) return null
  let possession: string | null = null
  if (raw.possession !== undefined && raw.possession !== null) {
    const id = String(raw.possession)
    possession = id === homeId ? homeAbbr : id === awayId ? awayAbbr : null
  }
  return {
    downDistance: raw.downDistanceText ?? raw.shortDownDistanceText ?? null,
    possession,
    isRedZone: !!raw.isRedZone,
    outs: num(raw.outs),
    balls: num(raw.balls),
    strikes: num(raw.strikes),
    onFirst: !!raw.onFirst,
    onSecond: !!raw.onSecond,
    onThird: !!raw.onThird,
    lastPlay: raw.lastPlay?.text ?? null,
  }
}

export function parseEvent(ref: EspnRef, ev: Json): EspnGame | null {
  const comp = ev.competitions?.[0]
  if (!comp) return null
  const competitors: Json[] = comp.competitors ?? []
  const homeRaw = competitors.find((c) => c.homeAway === 'home')
  const awayRaw = competitors.find((c) => c.homeAway === 'away')
  if (!homeRaw || !awayRaw) return null
  const home = parseTeam(ref, homeRaw)
  const away = parseTeam(ref, awayRaw)
  const status = comp.status ?? ev.status ?? {}
  const state = (status.type?.state as 'pre' | 'in' | 'post') ?? 'pre'

  const broadcastNames: string[] = ((comp.broadcasts as Json[] | undefined) ?? []).flatMap((b) => (b.names as string[] | undefined) ?? [])
  const geo = (comp.geoBroadcasts as Json[] | undefined)?.find((b) => b.market?.type === 'National')?.media?.shortName
  const network = broadcastNames[0] ?? geo ?? null

  return {
    id: String(ev.id),
    league: ref.league,
    date: String(ev.date),
    name: String(ev.name ?? `${away.name} at ${home.name}`),
    shortName: String(ev.shortName ?? `${away.abbr} @ ${home.abbr}`),
    state,
    completed: !!status.type?.completed,
    statusText: String(status.type?.detail ?? status.type?.description ?? ''),
    shortStatus: String(status.type?.shortDetail ?? status.type?.detail ?? ''),
    period: num(status.period) ?? 0,
    clock: status.displayClock ?? null,
    away,
    home,
    network,
    venue: comp.venue?.fullName ?? null,
    venueCity: comp.venue?.address?.city ?? null,
    indoor: typeof comp.venue?.indoor === 'boolean' ? comp.venue.indoor : null,
    neutralSite: !!comp.neutralSite,
    conferenceGame: !!comp.conferenceCompetition,
    week: num(ev.week?.number),
    seasonYear: num(ev.season?.year),
    seasonType: num(ev.season?.type),
    headline: comp.notes?.[0]?.headline ?? null,
    situation: parseSituation(comp.situation, home.id, away.id, home.abbr, away.abbr),
    odds: parseOdds(comp.odds?.[0]),
  }
}

export interface ScoreboardOpts {
  /** Football week number (regular season unless seasonType is set). */
  week?: number
  seasonType?: 1 | 2 | 3
  /** ESPN group id: 80 = FBS, 50 = Division I basketball. Defaulted for the college leagues. */
  groups?: number
  /** Overrides the default cache lifetime (the live strip wants 30s). */
  ttl?: number
}

export interface ScoreboardResult {
  games: EspnGame[]
  week: number | null
  seasonYear: number | null
  seasonType: number | null
  /** Any game in progress right now. */
  hasLive: boolean
  /** ESPN's calendar window for the league's current season (ISO), e.g. when college basketball opens. */
  calendarStart: string | null
  calendarEnd: string | null
  /** "live" = fetched just now, "fresh" = in-process cache, "stale" = last known good after a failed call. */
  origin: 'live' | 'fresh' | 'stale'
}

const DEFAULT_GROUPS: Partial<Record<EspnLeagueSlug, number>> = { 'college-football': 80, 'mens-college-basketball': 50 }

/** All games for a date (default today). Football also takes a `week`. Cached 60s while games are live, 300s otherwise. */
export async function getScoreboard(sport: EspnSport, league: EspnLeagueSlug, date?: string, opts: ScoreboardOpts = {}): Promise<ScoreboardResult | null> {
  const ref = { sport, league }
  const groups = opts.groups ?? DEFAULT_GROUPS[league]
  const params = new URLSearchParams({ limit: '400' })
  if (date) params.set('dates', date.replace(/-/g, ''))
  if (opts.week !== undefined) {
    params.set('week', String(opts.week))
    params.set('seasontype', String(opts.seasonType ?? 2))
    if (!date) params.set('dates', String(new Date().getUTCFullYear() - (new Date().getUTCMonth() < 2 ? 1 : 0)))
  } else if (opts.seasonType) params.set('seasontype', String(opts.seasonType))
  if (groups) params.set('groups', String(groups))
  const key = `espn:sb:${league}:${params.toString()}`
  try {
    const r = await cachedResult<Omit<ScoreboardResult, 'origin'>>(
      key,
      (v) => opts.ttl ?? (v.hasLive ? TTL.scoreboardLive : TTL.scoreboardIdle),
      async () => {
        const data = await get(`${SITE}/${slug(ref)}/scoreboard?${params.toString()}`, `${league} scoreboard`, 15000)
        if (!data) return null
        const games = ((data.events as Json[] | undefined) ?? []).map((e) => parseEvent(ref, e)).filter((g): g is EspnGame => g !== null)
        return {
          games,
          week: num(data.week?.number),
          seasonYear: num(data.season?.year),
          seasonType: num(data.season?.type),
          hasLive: games.some((g) => g.state === 'in'),
          calendarStart: data.leagues?.[0]?.calendarStartDate ?? null,
          calendarEnd: data.leagues?.[0]?.calendarEndDate ?? null,
        }
      }
    )
    if (!r.value) {
      console.error(`[espn] ${league} scoreboard unavailable (live call failed and no cached copy)`)
      return null
    }
    if (r.origin === 'live') console.log(`[espn] ${league} scoreboard from live call (${r.value.games.length} games)`)
    return { ...r.value, origin: r.origin === 'none' ? 'stale' : (r.origin as 'live' | 'fresh' | 'stale') }
  } catch (err) {
    reportError(err, 'espn')
    console.error(`[espn] getScoreboard(${league}) threw`, err)
    return null
  }
}

/** Convenience for app sports: `scoreboardFor('nfl', { week: 5 })`. */
export function scoreboardFor(sport: Sport, opts: ScoreboardOpts & { date?: string } = {}): Promise<ScoreboardResult | null> {
  const { sport: s, league } = ESPN_REF[sport]
  const { date, ...rest } = opts
  return getScoreboard(s, league, date, rest)
}

/** Finds a game on a scoreboard by the app's team abbreviations (order-insensitive). */
export function findGame(games: EspnGame[], away: string, home: string): EspnGame | null {
  return games.find((g) => g.away.abbr === away && g.home.abbr === home) ?? games.find((g) => g.away.abbr === home && g.home.abbr === away) ?? null
}

/** The network broadcasting each game, keyed "AWAY@HOME" in the app's abbreviations. */
export async function getNetworkMap(sport: Sport): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  const board = await scoreboardFor(sport, { ttl: 300 })
  for (const g of board?.games ?? []) if (g.network) map.set(`${g.away.abbr}@${g.home.abbr}`, g.network)
  return map
}

// ---------------------------------------------------------------------------
// Standings
// ---------------------------------------------------------------------------

export interface StandingsEntry {
  teamId: string
  abbr: string
  name: string
  shortName: string
  logo: string | null
  /** Display records keyed by ESPN's split type: total, homerecord, awayrecord, vsconf, vsdivision, vsaprankedteams, … */
  records: Record<string, string>
  /** Numeric stats from the overall split, keyed by name: wins, losses, ties, winPercent, pointsFor, pointsAgainst, … */
  nums: Record<string, number>
  streak: string
  gamesBehind: string
  /** 1-based position within its group, as ESPN ordered it. */
  rank: number
}

export interface StandingsGroup {
  id: string
  name: string
  abbreviation: string
  /** Parent group name (a division's conference), if any. */
  parent: string | null
  /** The conference this group belongs to (the group itself when it is a conference). Pro leagues: the conference/league. */
  conference: string
  conferenceAbbr: string
  /** Division name when the group is a division inside a conference. */
  division: string | null
  entries: StandingsEntry[]
}

function parseStandingsEntry(ref: EspnRef, e: Json, rank: number): StandingsEntry {
  const records: Record<string, string> = {}
  const nums: Record<string, number> = {}
  let streak = '—'
  let gamesBehind = '-'
  for (const s of (e.stats as Json[] | undefined) ?? []) {
    const type = String(s.type ?? '')
    // ESPN lists several splits back to back; only the overall split ("total", or untyped) feeds the numeric fields.
    const overall = !type.includes('_')
    if (s.displayValue !== undefined && ['total', 'homerecord', 'awayrecord', 'vsconf', 'vsdivision', 'vsaprankedteams', 'vsusarankedteams', 'lasttengames'].includes(type)) {
      records[type] = String(s.displayValue)
    }
    if (overall) {
      const v = num(s.value)
      if (v !== null && s.name && nums[s.name] === undefined) nums[s.name] = v
      if (s.name === 'streak' && s.displayValue) streak = String(s.displayValue)
      if (s.name === 'gamesBehind' && s.displayValue !== undefined) gamesBehind = String(s.displayValue)
    }
    // Pro leagues name their splits instead of typing them ("Home", "Road", "Last Ten Games", "overall").
    const label = String(s.name ?? '')
    if (label === 'overall' && !records.total) records.total = String(s.displayValue)
    if (label === 'Home' && !records.homerecord) records.homerecord = String(s.displayValue)
    if ((label === 'Road' || label === 'Away') && !records.awayrecord) records.awayrecord = String(s.displayValue)
    if (label === 'vs. Conf.' && !records.vsconf) records.vsconf = String(s.displayValue)
    if (label === 'Last Ten Games' && !records.lasttengames) records.lasttengames = String(s.displayValue)
  }
  const m = /^(\d+)-(\d+)(?:-(\d+))?/.exec(records.total ?? '')
  if (m) {
    nums.wins = Number(m[1])
    nums.losses = Number(m[2])
    nums.ties = m[3] ? Number(m[3]) : (nums.ties ?? 0)
  }
  const t = e.team ?? {}
  return {
    teamId: String(t.id ?? ''),
    abbr: appAbbr(ref, String(t.abbreviation ?? '')),
    name: String(t.displayName ?? ''),
    shortName: String(t.shortDisplayName ?? t.name ?? ''),
    logo: t.logos?.[0]?.href ?? t.logo ?? null,
    records,
    nums,
    streak,
    gamesBehind,
    rank,
  }
}

function flattenStandings(ref: EspnRef, node: Json, parent: string | null, out: StandingsGroup[], depth = 0, conf: { name: string; abbr: string } | null = null) {
  const name = String(node.name ?? '')
  const abbr = String(node.abbreviation ?? node.shortName ?? '')
  // Depth 0 is the league root; depth 1 are conferences; depth 2 are divisions inside a conference.
  const myConf = depth === 1 ? { name, abbr } : conf
  const entries: Json[] = node.standings?.entries ?? []
  if (entries.length > 0) {
    out.push({
      id: String(node.id ?? node.uid ?? node.name),
      name,
      abbreviation: abbr,
      parent,
      conference: myConf?.name ?? name,
      conferenceAbbr: myConf?.abbr ?? abbr,
      division: depth >= 2 ? name : null,
      entries: entries.map((e, i) => parseStandingsEntry(ref, e, i + 1)),
    })
  }
  for (const child of (node.children as Json[] | undefined) ?? []) flattenStandings(ref, child, name || parent, out, depth + 1, myConf)
}

/** Full standings, flattened to leaf groups (conferences / divisions). College leagues default to the top division. Cached 30 minutes. */
export async function getStandings(sport: EspnSport, league: EspnLeagueSlug, season?: number): Promise<StandingsGroup[] | null> {
  const ref = { sport, league }
  const groups = DEFAULT_GROUPS[league]
  const params = new URLSearchParams()
  if (season) params.set('season', String(season))
  if (groups) params.set('group', String(groups))
  // Pro football/basketball/hockey list conferences with divisions underneath only at level 3.
  if (!groups) params.set('level', '3')
  return cachedGet(`espn:standings:${league}:${params.toString()}`, TTL.standings, async () => {
    const data = await get(`${WEB}/v2/sports/${slug(ref)}/standings?${params.toString()}`, `${league} standings`, 20000)
    if (!data) return null
    const out: StandingsGroup[] = []
    flattenStandings(ref, data, null, out)
    return out.length > 0 ? out : null
  })
}

// ---------------------------------------------------------------------------
// Teams
// ---------------------------------------------------------------------------

export interface TeamListEntry {
  id: string
  abbr: string
  name: string
  shortName: string
  nickname: string
  location: string
  color: string | null
  alternateColor: string | null
  logo: string | null
}

/** Every team ESPN lists for the league (colors, logos, names). Cached 24h. */
export async function getTeamList(sport: EspnSport, league: EspnLeagueSlug): Promise<TeamListEntry[] | null> {
  const ref = { sport, league }
  return cachedGet(`espn:teamlist:${league}`, TTL.team, async () => {
    const data = await get(`${SITE}/${slug(ref)}/teams?limit=1000`, `${league} team list`, 20000)
    const list: Json[] | undefined = data?.sports?.[0]?.leagues?.[0]?.teams
    if (!list) return null
    return list.map(({ team: t }) => ({
      id: String(t.id),
      abbr: appAbbr(ref, String(t.abbreviation ?? '')),
      name: String(t.displayName ?? ''),
      shortName: String(t.shortDisplayName ?? t.name ?? ''),
      nickname: String(t.name ?? ''),
      location: String(t.location ?? ''),
      color: t.color ? `#${t.color}` : null,
      alternateColor: t.alternateColor ? `#${t.alternateColor}` : null,
      logo: t.logos?.[0]?.href ?? null,
    }))
  })
}

export interface TeamInfo {
  id: string
  abbr: string
  name: string
  location: string
  nickname: string
  color: string | null
  alternateColor: string | null
  logo: string | null
  /** Overall record summary, e.g. "4-1". */
  record: string | null
  standingSummary: string | null
  venue: { name: string; city: string | null; capacity: number | null; indoor: boolean | null } | null
  /** Head coach, when the roster feed names one. */
  coach: string | null
  conferenceId: string | null
  nextEventId: string | null
}

/** Team details: name, colors, record, venue, coach. Cached 24h. `teamId` is ESPN's id or abbreviation slug. */
export async function getTeamInfo(sport: EspnSport, league: EspnLeagueSlug, teamId: string): Promise<TeamInfo | null> {
  const ref = { sport, league }
  return cachedGet(`espn:team:${league}:${teamId}`, TTL.team, async () => {
    const [data, roster] = await Promise.all([get(`${SITE}/${slug(ref)}/teams/${teamId}`, `${league} team ${teamId}`), getTeamRoster(sport, league, teamId)])
    const t = data?.team
    if (!t) return null
    const venue = t.franchise?.venue
    return {
      id: String(t.id),
      abbr: appAbbr(ref, String(t.abbreviation ?? '')),
      name: String(t.displayName ?? ''),
      location: String(t.location ?? ''),
      nickname: String(t.name ?? ''),
      color: t.color ? `#${t.color}` : null,
      alternateColor: t.alternateColor ? `#${t.alternateColor}` : null,
      logo: t.logos?.[0]?.href ?? null,
      record: t.record?.items?.find((i: Json) => i.type === 'total')?.summary ?? t.record?.items?.[0]?.summary ?? null,
      standingSummary: t.standingSummary ?? null,
      venue: venue
        ? { name: String(venue.fullName ?? ''), city: venue.address?.city ?? null, capacity: num(venue.capacity), indoor: typeof venue.indoor === 'boolean' ? venue.indoor : null }
        : null,
      coach: roster?.coach ?? null,
      conferenceId: t.groups?.id ? String(t.groups.id) : null,
      nextEventId: t.nextEvent?.[0]?.id ? String(t.nextEvent[0].id) : null,
    }
  })
}

export interface RosterEntry {
  id: string
  name: string
  /** Position abbreviation (QB, WR, PG, …). */
  position: string
  jersey: string | null
  age: number | null
  college: string | null
  height: string | null
  weight: string | null
  experience: number | null
  headshot: string | null
  /** Football unit: offense / defense / special teams (null for other sports). */
  group: 'offense' | 'defense' | 'specialTeams' | null
  /** Roster designation such as "Injured Reserve" or "Practice Squad", when not on the active roster. */
  designation: string | null
  /** Current injury status text, if ESPN lists one. */
  injury: string | null
}

export interface RosterResult {
  players: RosterEntry[]
  coach: string | null
}

const GROUP_OF: Record<string, RosterEntry['group']> = { offense: 'offense', defense: 'defense', specialTeam: 'specialTeams' }
const DESIGNATION_OF: Record<string, string> = { injuredReserveOrOut: 'Injured Reserve', suspended: 'Suspended', practiceSquad: 'Practice Squad' }

/** Current roster with football offense/defense/special-teams grouping. Cached 24h. */
export async function getTeamRoster(sport: EspnSport, league: EspnLeagueSlug, teamId: string): Promise<RosterResult | null> {
  const ref = { sport, league }
  return cachedGet(`espn:roster:${league}:${teamId}`, TTL.roster, async () => {
    const data = await get(`${SITE}/${slug(ref)}/teams/${teamId}/roster`, `${league} roster ${teamId}`, 15000)
    if (!data) return null
    const toEntry = (a: Json, group: RosterEntry['group'], designation: string | null): RosterEntry => ({
      id: String(a.id),
      name: String(a.displayName ?? a.fullName ?? ''),
      position: String(a.position?.abbreviation ?? ''),
      jersey: a.jersey ? String(a.jersey) : null,
      age: num(a.age),
      college: a.college?.name ?? a.college?.shortName ?? null,
      height: a.displayHeight ?? null,
      weight: a.displayWeight ?? null,
      experience: num(a.experience?.years),
      headshot: a.headshot?.href ?? null,
      group,
      designation,
      injury: a.injuries?.[0]?.status ?? null,
    })
    const players: RosterEntry[] = []
    for (const g of (data.athletes as Json[] | undefined) ?? []) {
      if (Array.isArray(g.items)) {
        const group = GROUP_OF[String(g.position)] ?? null
        const designation = DESIGNATION_OF[String(g.position)] ?? null
        for (const a of g.items) players.push(toEntry(a, group, designation))
      } else if (g.id) {
        players.push(toEntry(g, null, null))
      }
    }
    const coach = (data.coach as Json[] | undefined)?.[0]
    return { players, coach: coach ? `${coach.firstName ?? ''} ${coach.lastName ?? ''}`.trim() || null : null }
  })
}

export interface ScheduleGame {
  id: string
  date: string
  week: number | null
  seasonType: number | null
  home: boolean
  neutralSite: boolean
  opponent: { id: string; abbr: string; name: string; logo: string | null; rank: number | null }
  state: 'pre' | 'in' | 'post'
  completed: boolean
  /** The team's own score / the opponent's. Null before the game. */
  us: number | null
  them: number | null
  result: 'W' | 'L' | 'T' | null
  network: string | null
  venue: string | null
  conferenceGame: boolean
  statusText: string
}

/** Team schedule: past results with scores plus upcoming games. Cached 1h. */
export async function getTeamSchedule(sport: EspnSport, league: EspnLeagueSlug, teamId: string, season?: number): Promise<ScheduleGame[] | null> {
  const ref = { sport, league }
  const qs = new URLSearchParams({ seasontype: '2' })
  if (season) qs.set('season', String(season))
  return cachedGet(`espn:sched:${league}:${teamId}:${qs.toString()}`, TTL.schedule, async () => {
    const data = await get(`${SITE}/${slug(ref)}/teams/${teamId}/schedule?${qs.toString()}`, `${league} schedule ${teamId}`, 15000)
    if (!data) return null
    const myId = String(data.team?.id ?? teamId)
    const out: ScheduleGame[] = []
    for (const ev of (data.events as Json[] | undefined) ?? []) {
      const comp = ev.competitions?.[0]
      if (!comp) continue
      const cs: Json[] = comp.competitors ?? []
      const mine = cs.find((c) => String(c.team?.id) === myId) ?? cs.find((c) => String(c.team?.abbreviation).toLowerCase() === teamId.toLowerCase())
      const theirs = cs.find((c) => c !== mine)
      if (!mine || !theirs) continue
      const state = (comp.status?.type?.state as 'pre' | 'in' | 'post') ?? 'pre'
      const us = num(mine.score?.value ?? mine.score)
      const them = num(theirs.score?.value ?? theirs.score)
      const opp = parseTeam(ref, theirs)
      const net = ((comp.broadcasts as Json[] | undefined) ?? []).flatMap((b) => (b.media?.shortName ? [b.media.shortName as string] : []))[0] ?? null
      out.push({
        id: String(ev.id),
        date: String(ev.date),
        week: num(ev.week?.number),
        seasonType: num(ev.seasonType?.type ?? ev.seasonType?.id),
        home: mine.homeAway === 'home',
        neutralSite: !!comp.neutralSite,
        opponent: { id: opp.id, abbr: opp.abbr, name: opp.name, logo: opp.logo, rank: opp.rank },
        state,
        completed: !!comp.status?.type?.completed,
        us: state === 'pre' ? null : us,
        them: state === 'pre' ? null : them,
        result: state === 'post' && us !== null && them !== null ? (us > them ? 'W' : us < them ? 'L' : 'T') : null,
        network: net,
        venue: comp.venue?.fullName ?? null,
        conferenceGame: !!comp.conferenceCompetition,
        statusText: String(comp.status?.type?.shortDetail ?? ''),
      })
    }
    return out.sort((a, b) => a.date.localeCompare(b.date))
  })
}

// ---------------------------------------------------------------------------
// Game summary
// ---------------------------------------------------------------------------

export interface SummaryTeam {
  id: string
  abbr: string
  name: string
  logo: string | null
  homeAway: 'home' | 'away'
  score: number | null
  record: string | null
  rank: number | null
  winner: boolean
}

export interface SummaryPlayerGroup {
  /** passing, rushing, receiving, defensive, … (football) or one group of "starters/bench" (basketball). */
  name: string
  labels: string[]
  athletes: { id: string; name: string; position: string; jersey: string | null; starter: boolean; stats: string[] }[]
}

export interface GameSummary {
  gameId: string
  league: EspnLeagueSlug
  /** Football week number (null for other sports). */
  week: number | null
  seasonYear: number | null
  neutralSite: boolean
  conferenceGame: boolean
  /** ESPN's game note, e.g. "Red River Rivalry" or a bowl name. */
  headline: string | null
  state: 'pre' | 'in' | 'post'
  statusText: string
  period: number
  clock: string | null
  date: string | null
  venue: { name: string | null; city: string | null; state: string | null; capacity: number | null; indoor: boolean | null }
  attendance: number | null
  network: string | null
  teams: SummaryTeam[]
  /** Team box-score stats keyed by team id, e.g. { totalYards: "301", thirdDownEff: "5-12" }. */
  teamStats: Record<string, Record<string, string>>
  /** Per-team player box score (final/live games). */
  players: Record<string, SummaryPlayerGroup[]>
  /** Category leaders per team, e.g. passing / rushing / receiving. */
  leaders: { teamId: string; category: string; name: string; athleteId: string | null; value: string }[]
  injuries: { teamId: string; name: string; position: string; status: string; detail: string | null }[]
  weather: { tempF: number | null; conditions: string | null; windMph: number | null } | null
  officials: string[]
  /** Betting line ESPN shows for the game (DraftKings), when posted. */
  odds: EspnOddsLine | null
  situation: EspnSituation | null
  /** Most recent plays, newest last. */
  recentPlays: { text: string; clock: string | null; period: number | null; scoring: boolean }[]
  /** Win probability for the home side, 0-1, latest point. */
  homeWinProbability: number | null
}

const SUMMARY_TTL = (s: GameSummary): number => (s.state === 'in' ? TTL.summaryLive : s.state === 'post' ? TTL.summaryFinal : TTL.summaryPre)

/** Everything ESPN has on one game: pregame (stats, injuries, weather, odds), live (score, situation, plays) or final (box score). */
export async function getGameSummary(sport: EspnSport, league: EspnLeagueSlug, gameId: string): Promise<GameSummary | null> {
  const ref = { sport, league }
  return cachedGet<GameSummary>(`espn:summary:${league}:${gameId}`, SUMMARY_TTL, async () => {
    const data = await get(`${WEB}/site/v2/sports/${slug(ref)}/summary?event=${gameId}`, `${league} summary ${gameId}`, 20000)
    if (!data) return null
    const comp = data.header?.competitions?.[0]
    if (!comp) return null
    const status = comp.status ?? {}
    const state = (status.type?.state as 'pre' | 'in' | 'post') ?? 'pre'

    const teams: SummaryTeam[] = ((comp.competitors as Json[] | undefined) ?? []).map((c) => ({
      id: String(c.team?.id ?? c.id),
      abbr: appAbbr(ref, String(c.team?.abbreviation ?? '')),
      name: String(c.team?.displayName ?? ''),
      logo: c.team?.logos?.[0]?.href ?? null,
      homeAway: c.homeAway === 'home' ? 'home' : 'away',
      score: num(c.score),
      record: (c.record as Json[] | undefined)?.find((r) => r.type === 'total')?.displayValue ?? c.record?.[0]?.displayValue ?? null,
      rank: ((r) => (r !== null && r >= 1 && r <= 25 ? r : null))(num(c.rank)),
      winner: !!c.winner,
    }))

    const teamStats: Record<string, Record<string, string>> = {}
    for (const t of (data.boxscore?.teams as Json[] | undefined) ?? []) {
      const m: Record<string, string> = {}
      for (const s of (t.statistics as Json[] | undefined) ?? []) m[String(s.name)] = String(s.displayValue ?? s.value ?? '')
      teamStats[String(t.team?.id)] = m
    }

    const players: Record<string, SummaryPlayerGroup[]> = {}
    for (const block of (data.boxscore?.players as Json[] | undefined) ?? []) {
      const tid = String(block.team?.id)
      players[tid] = ((block.statistics as Json[] | undefined) ?? []).map((g) => ({
        name: String(g.name ?? g.type ?? 'stats'),
        labels: (g.labels as string[] | undefined) ?? [],
        athletes: ((g.athletes as Json[] | undefined) ?? []).map((a) => ({
          id: String(a.athlete?.id),
          name: String(a.athlete?.displayName ?? ''),
          position: String(a.athlete?.position?.abbreviation ?? ''),
          jersey: a.athlete?.jersey ? String(a.athlete.jersey) : null,
          starter: !!a.starter,
          stats: ((a.stats as unknown[] | undefined) ?? []).map(String),
        })),
      }))
    }

    const leaders: GameSummary['leaders'] = []
    for (const t of (data.leaders as Json[] | undefined) ?? []) {
      for (const cat of (t.leaders as Json[] | undefined) ?? []) {
        const top = cat.leaders?.[0]
        if (top) leaders.push({ teamId: String(t.team?.id), category: String(cat.name), name: String(top.athlete?.displayName ?? ''), athleteId: top.athlete?.id ? String(top.athlete.id) : null, value: String(top.displayValue ?? '') })
      }
    }

    const injuries: GameSummary['injuries'] = []
    for (const t of (data.injuries as Json[] | undefined) ?? []) {
      for (const i of (t.injuries as Json[] | undefined) ?? []) {
        injuries.push({ teamId: String(t.team?.id), name: String(i.athlete?.displayName ?? ''), position: String(i.athlete?.position?.abbreviation ?? ''), status: String(i.status ?? ''), detail: i.details?.type ?? i.type?.description ?? null })
      }
    }

    const w = data.gameInfo?.weather
    const pick = (data.pickcenter as Json[] | undefined) ?? []
    const dk = pick.find((p) => /draftkings/i.test(p.provider?.name ?? '')) ?? pick[0]
    const venue = data.gameInfo?.venue
    const plays = (data.plays as Json[] | undefined) ?? (data.drives?.current?.plays as Json[] | undefined) ?? []
    const home = teams.find((t) => t.homeAway === 'home')
    const away = teams.find((t) => t.homeAway === 'away')
    const sit = data.situation ?? comp.situation
    const wp = (data.winprobability as Json[] | undefined)?.slice(-1)[0]?.homeWinPercentage

    return {
      gameId: String(gameId),
      league,
      week: num(data.header?.week),
      seasonYear: num(data.header?.season?.year),
      neutralSite: !!comp.neutralSite,
      conferenceGame: !!comp.conferenceCompetition,
      headline: comp.notes?.[0]?.headline ?? data.header?.gameNote ?? null,
      state,
      statusText: String(status.type?.detail ?? ''),
      period: num(status.period) ?? 0,
      clock: status.displayClock ?? null,
      date: comp.date ?? data.header?.competitions?.[0]?.date ?? null,
      venue: { name: venue?.fullName ?? null, city: venue?.address?.city ?? null, state: venue?.address?.state ?? null, capacity: num(venue?.capacity), indoor: typeof venue?.indoor === 'boolean' ? venue.indoor : null },
      attendance: num(data.gameInfo?.attendance),
      network: ((comp.broadcasts as Json[] | undefined) ?? []).flatMap((b) => (b.media?.shortName ? [b.media.shortName as string] : []))[0] ?? null,
      teams,
      teamStats,
      players,
      leaders,
      injuries,
      weather: w ? { tempF: num(w.temperature), conditions: w.displayValue ?? w.conditionId ?? null, windMph: num(w.gust ?? w.windSpeed) } : null,
      officials: ((data.gameInfo?.officials as Json[] | undefined) ?? []).map((o) => String(o.displayName ?? o.fullName ?? '')).filter(Boolean),
      odds: dk
        ? {
            provider: dk.provider?.name ?? 'DraftKings',
            homeSpread: num(dk.spread),
            homeSpreadPrice: price(dk.homeTeamOdds?.spreadOdds),
            awaySpreadPrice: price(dk.awayTeamOdds?.spreadOdds),
            homeMl: price(dk.homeTeamOdds?.moneyLine),
            awayMl: price(dk.awayTeamOdds?.moneyLine),
            total: num(dk.overUnder),
            overPrice: price(dk.overOdds),
            underPrice: price(dk.underOdds),
          }
        : null,
      situation: sit ? parseSituation(sit, home?.id ?? '', away?.id ?? '', home?.abbr ?? '', away?.abbr ?? '') : null,
      recentPlays: plays.slice(-5).map((p) => ({ text: String(p.text ?? p.shortText ?? ''), clock: p.clock?.displayValue ?? null, period: num(p.period?.number), scoring: !!p.scoringPlay })),
      homeWinProbability: typeof wp === 'number' ? wp : null,
    }
  })
}

// ---------------------------------------------------------------------------
// Leaders
// ---------------------------------------------------------------------------

export interface LeaderEntry {
  rank: number
  playerId: string
  name: string
  position: string
  teamId: string | null
  teamAbbr: string
  value: number
  display: string
  headshot: string | null
}

export interface LeaderCategory {
  /** ESPN's stat key, e.g. passingYards. */
  key: string
  label: string
  abbreviation: string
  leaders: LeaderEntry[]
}

/** Top players per stat category for the league (position-appropriate categories). Cached 1h. Uses ESPN's site v3 leaders feed — the v2 `/leaders` path in the spec is 404. */
export async function getLeagueLeaders(sport: EspnSport, league: EspnLeagueSlug, season?: number): Promise<LeaderCategory[] | null> {
  const ref = { sport, league }
  const qs = new URLSearchParams({ seasontype: '2' })
  if (season) qs.set('season', String(season))
  return cachedGet(`espn:leaders:${league}:${qs.toString()}`, TTL.leaders, async () => {
    const data = await get(`${WEB}/site/v3/sports/${slug(ref)}/leaders?${qs.toString()}`, `${league} leaders`, 20000)
    if (!data) return null
    const cats: Json[] = data.leaders?.categories ?? []
    const out = cats.map(
      (c): LeaderCategory => ({
        key: String(c.name),
        label: String(c.displayName ?? c.name),
        abbreviation: String(c.abbreviation ?? ''),
        leaders: ((c.leaders as Json[] | undefined) ?? []).map((l, i) => ({
          rank: i + 1,
          playerId: String(l.athlete?.id ?? ''),
          name: String(l.athlete?.displayName ?? ''),
          position: String(l.athlete?.position?.abbreviation ?? ''),
          teamId: l.team?.id ? String(l.team.id) : null,
          teamAbbr: appAbbr(ref, String(l.team?.abbreviation ?? l.athlete?.team?.abbreviation ?? '')),
          value: num(l.value) ?? 0,
          display: String(l.displayValue ?? l.value ?? ''),
          headshot: l.athlete?.headshot?.href ?? null,
        })),
      })
    )
    return out.length > 0 ? out : null
  })
}

// ---------------------------------------------------------------------------
// Players
// ---------------------------------------------------------------------------

export interface StatCategory {
  name: string
  stats: Record<string, { label: string; value: number; display: string }>
}

/** Full season stats by category (passing, rushing, …) from ESPN's core API. Cached 1h. */
export async function getPlayerStats(sport: EspnSport, league: EspnLeagueSlug, playerId: string, season?: number): Promise<StatCategory[] | null> {
  const year = season ?? new Date().getUTCFullYear()
  return cachedGet(`espn:pstats:${league}:${playerId}:${year}`, TTL.stats, async () => {
    const data = await get(`${CORE}/${sport}/leagues/${league}/seasons/${year}/types/2/athletes/${playerId}/statistics/0`, `${league} player stats ${playerId}`)
    const cats: Json[] | undefined = data?.splits?.categories
    if (!cats) return null
    return cats.map((c) => ({
      name: String(c.name),
      stats: Object.fromEntries(((c.stats as Json[] | undefined) ?? []).map((s) => [String(s.name), { label: String(s.abbreviation ?? s.shortDisplayName ?? s.name), value: num(s.value) ?? 0, display: String(s.displayValue ?? s.value ?? '') }])),
    }))
  })
}

export interface GameLogRow {
  eventId: string
  date: string | null
  week: number | null
  /** Opponent abbreviation. */
  opponent: string
  home: boolean
  result: 'W' | 'L' | 'T' | null
  /** "24-27" style final score, from the player's team's perspective when ESPN gives it. */
  score: string | null
  /** Stats keyed by ESPN name (passingYards, completions, points, …). */
  stats: Record<string, number>
  /** The same values as ESPN printed them, including composites such as "9-18" that don't parse as numbers. */
  raw: Record<string, string>
}

export interface GameLog {
  /** Display labels keyed by stat name. */
  labels: Record<string, string>
  rows: GameLogRow[]
}

/** Game-by-game stats for a season (regular season, newest first). Cached 1h. */
export async function getPlayerGameLog(sport: EspnSport, league: EspnLeagueSlug, playerId: string, season?: number): Promise<GameLog | null> {
  const ref = { sport, league }
  const qs = season ? `?season=${season}` : ''
  return cachedGet(`espn:glog:${league}:${playerId}:${season ?? 'cur'}`, TTL.stats, async () => {
    const data = await get(`${WEB}/common/v3/sports/${slug(ref)}/athletes/${playerId}/gamelog${qs}`, `${league} gamelog ${playerId}`)
    if (!data) return null
    const names: string[] = data.names ?? []
    const labels: Record<string, string> = {}
    names.forEach((n, i) => (labels[n] = String(data.labels?.[i] ?? n)))
    const events: Json = data.events ?? {}
    const rows: GameLogRow[] = []
    for (const st of (data.seasonTypes as Json[] | undefined) ?? []) {
      if (/post|pre/i.test(String(st.displayName)) && !/regular/i.test(String(st.displayName))) continue
      for (const cat of (st.categories as Json[] | undefined) ?? []) {
        if (cat.type && cat.type !== 'event') continue
        for (const ev of (cat.events as Json[] | undefined) ?? []) {
          const meta = events[String(ev.eventId)] ?? {}
          const stats: Record<string, number> = {}
          const raw: Record<string, string> = {}
          names.forEach((n, i) => {
            raw[n] = String((ev.stats as unknown[])[i] ?? '')
            const v = num((ev.stats as unknown[])[i])
            if (v !== null) stats[n] = v
          })
          rows.push({
            eventId: String(ev.eventId),
            date: meta.gameDate ?? null,
            week: num(meta.week),
            opponent: appAbbr(ref, String(meta.opponent?.abbreviation ?? '')),
            home: meta.atVs !== '@',
            result: meta.gameResult === 'W' ? 'W' : meta.gameResult === 'L' ? 'L' : meta.gameResult === 'T' ? 'T' : null,
            score: meta.score ?? null,
            stats,
            raw,
          })
        }
      }
    }
    rows.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
    return rows.length > 0 ? { labels, rows } : null
  })
}

export interface PlayerProfile {
  id: string
  name: string
  position: string
  teamId: string | null
  teamAbbr: string | null
  teamName: string | null
  jersey: string | null
  headshot: string | null
  height: string | null
  weight: string | null
  age: number | null
  college: string | null
  draft: string | null
  experience: string | null
  status: string | null
  /** ESPN's one-line stat summary for the player's current season, e.g. "1268 YDS, 7 TD". */
  statsSummary: string | null
}

/** Name, position, team, jersey, headshot, size, college, draft and experience. Cached 24h. */
export async function getPlayerProfile(sport: EspnSport, league: EspnLeagueSlug, playerId: string): Promise<PlayerProfile | null> {
  const ref = { sport, league }
  return cachedGet(`espn:profile:${league}:${playerId}`, TTL.profile, async () => {
    const data = await get(`${WEB}/common/v3/sports/${slug(ref)}/athletes/${playerId}`, `${league} athlete ${playerId}`)
    const a = data?.athlete
    if (!a) return null
    return {
      id: String(a.id),
      name: String(a.displayName ?? a.fullName ?? ''),
      position: String(a.position?.abbreviation ?? ''),
      teamId: a.team?.id ? String(a.team.id) : null,
      teamAbbr: a.team?.abbreviation ? appAbbr(ref, String(a.team.abbreviation)) : null,
      teamName: a.team?.displayName ?? null,
      jersey: a.jersey ? String(a.jersey) : null,
      headshot: a.headshot?.href ?? null,
      height: a.displayHeight ?? null,
      weight: a.displayWeight ?? null,
      age: num(a.age),
      college: a.college?.name ?? a.collegeTeam?.displayName ?? null,
      draft: a.displayDraft ?? null,
      experience: a.displayExperience ?? null,
      status: a.status?.name ?? null,
      statsSummary: a.statsSummary?.displayName ? `${a.statsSummary.displayName}: ${(a.statsSummary.statistics as Json[] | undefined)?.map((s) => `${s.displayValue} ${s.abbreviation}`).join(', ') ?? ''}` : null,
    }
  })
}

export interface PlayerSearchHit {
  id: string
  name: string
  position: string | null
  teamName: string | null
  league: string
  sport: string
}

/** Players matching a name, with ESPN ids, restricted to the league. Cached 24h. Uses ESPN's common v3 search — `/athletes?search=` in the spec is 404. */
export async function searchPlayer(sport: EspnSport, league: EspnLeagueSlug, name: string): Promise<PlayerSearchHit[] | null> {
  const q = name.trim()
  if (q.length < 2) return []
  return cachedGet(`espn:search:${league}:${q.toLowerCase()}`, TTL.search, async () => {
    const data = await get(`${WEB}/common/v3/search?query=${encodeURIComponent(q)}&limit=25&type=player`, `search "${q}"`)
    if (!data) return null
    return ((data.items as Json[] | undefined) ?? [])
      .filter((i) => i.sport === sport && i.league === league)
      .map((i) => ({
        id: String(i.id),
        name: String(i.displayName),
        position: i.position ?? null,
        teamName: i.teamRelationships?.[0]?.displayName ?? i.subtitle ?? null,
        league: String(i.league),
        sport: String(i.sport),
      }))
  })
}

// ---------------------------------------------------------------------------
// Injuries / news / rankings
// ---------------------------------------------------------------------------

export type InjuryDesignation = 'out' | 'doubtful' | 'questionable' | 'gtd' | 'probable' | 'ir'

export interface EspnInjury {
  sport: Sport
  /** App team abbreviation. */
  team: string
  teamName: string
  player: string
  playerId: string | null
  position: string
  designation: InjuryDesignation
  /** ESPN's wording, e.g. "15-Day-IL". */
  rawStatus: string
  /** e.g. "Knee", "Hamstring". */
  injury: string
  comment: string | null
  returnDate: string | null
  updated: string | null
}

const STATUS_MAP: [RegExp, InjuryDesignation][] = [
  [/^out$/i, 'out'],
  [/suspen/i, 'out'],
  [/doubtful/i, 'doubtful'],
  [/questionable/i, 'questionable'],
  [/day-to-day|day to day/i, 'gtd'],
  [/probable/i, 'probable'],
  [/injured reserve|\bIL\b|-IL|\bIR\b|\bPUP\b|\bNFI\b/i, 'ir'],
]

function designationFor(status: string): InjuryDesignation | null {
  for (const [re, d] of STATUS_MAP) if (re.test(status)) return d
  return null
}

/** All current injury designations for the league. Cached 30 minutes; the payloads are large so they're reduced immediately. */
export async function getInjuries(sport: EspnSport, league: EspnLeagueSlug): Promise<EspnInjury[] | null> {
  const ref = { sport, league }
  const appSport = appSportOf(ref)
  if (!appSport) return null
  return cachedGet(`espn:injuries:${league}`, TTL.injuries, async () => {
    const data = await get(`${SITE}/${slug(ref)}/injuries`, `${league} injuries`, 20000)
    if (!data) return null
    const out: EspnInjury[] = []
    for (const t of (data.injuries as Json[] | undefined) ?? []) {
      for (const i of (t.injuries as Json[] | undefined) ?? []) {
        const raw = String(i.status ?? '')
        const designation = designationFor(raw)
        if (!designation) continue // "Active" and unknown designations are not injuries
        const team = appAbbr(ref, String(i.athlete?.team?.abbreviation ?? ''))
        out.push({
          sport: appSport,
          team,
          teamName: String(t.displayName ?? i.athlete?.team?.displayName ?? team),
          player: String(i.athlete?.displayName ?? ''),
          playerId: i.athlete?.id ? String(i.athlete.id) : null,
          position: String(i.athlete?.position?.abbreviation ?? ''),
          designation,
          rawStatus: raw,
          injury: String(i.details?.type ?? i.type?.description ?? ''),
          comment: typeof i.shortComment === 'string' && i.shortComment.length > 3 ? i.shortComment : null,
          returnDate: i.details?.returnDate ?? null,
          updated: i.date ?? null,
        })
      }
    }
    return out.filter((i) => i.player && i.team)
  })
}

export interface EspnArticle {
  id: string
  headline: string
  description: string
  published: string
  link: string | null
  image: string | null
  /** Teams and players the story is tagged with. */
  related: { type: 'team' | 'athlete'; name: string; id: string | null }[]
}

/** Latest headlines with related teams/players. Cached 1h. */
export async function getNews(sport: EspnSport, league: EspnLeagueSlug, limit = 10): Promise<EspnArticle[] | null> {
  const ref = { sport, league }
  return cachedGet(`espn:news:${league}:${limit}`, TTL.news, async () => {
    const data = await get(`${SITE}/${slug(ref)}/news?limit=${limit}`, `${league} news`)
    if (!data) return null
    return ((data.articles as Json[] | undefined) ?? []).map(
      (a): EspnArticle => ({
        id: String(a.id ?? a.dataSourceIdentifier ?? a.headline),
        headline: String(a.headline ?? ''),
        description: String(a.description ?? ''),
        published: String(a.published ?? a.lastModified ?? ''),
        link: a.links?.web?.href ?? null,
        image: a.images?.[0]?.url ?? null,
        related: ((a.categories as Json[] | undefined) ?? [])
          .filter((c) => c.type === 'team' || c.type === 'athlete')
          .map((c) => ({ type: c.type as 'team' | 'athlete', name: String(c.description ?? ''), id: c.teamId ? String(c.teamId) : c.athleteId ? String(c.athleteId) : null })),
      })
    )
  })
}

export interface RankedTeam {
  rank: number
  /** Last week's rank, null if unranked then. */
  previous: number | null
  /** Positive = moved up. */
  movement: number | null
  teamId: string
  abbr: string
  name: string
  logo: string | null
  record: string | null
  points: number | null
  firstPlaceVotes: number | null
  conferenceId: string | null
}

export interface RankingPoll {
  /** e.g. "AP Top 25", "AFCA Coaches Poll", "College Football Playoff". */
  name: string
  shortName: string
  headline: string
  week: number | null
  season: number | null
  updated: string | null
  ranks: RankedTeam[]
}

/** AP / Coaches / CFP polls for the college leagues. Cached 24h (they change weekly). */
export async function getRankings(sport: EspnSport, league: EspnLeagueSlug): Promise<RankingPoll[] | null> {
  if (league !== 'college-football' && league !== 'mens-college-basketball') return []
  const ref = { sport, league }
  return cachedGet(`espn:rankings:${league}`, TTL.rankings, async () => {
    const data = await get(`${SITE}/${slug(ref)}/rankings`, `${league} rankings`, 20000)
    if (!data) return null
    const season = num(data.latestSeason ?? data.requestedSeason)
    return ((data.rankings as Json[] | undefined) ?? [])
      // Only the polls that matter for betting context; the FCS / lower-division polls are noise.
      .filter((p) => /AP Top 25|Coaches Poll|College Football Playoff|CFP/i.test(String(p.name)) && !/FCS|Division II|Division III/i.test(String(p.name)))
      .map(
        (p): RankingPoll => ({
          name: String(p.name),
          shortName: String(p.shortName ?? p.name),
          headline: String(p.headline ?? p.name),
          week: num(p.occurrence?.number),
          season,
          updated: p.date ?? p.lastUpdated ?? null,
          ranks: ((p.ranks as Json[] | undefined) ?? []).map(
            (r): RankedTeam => {
              const cur = num(r.current)
              const prev = num(r.previous)
              return {
                rank: cur ?? 0,
                previous: prev !== null && prev > 0 ? prev : null,
                movement: cur !== null && prev !== null && prev > 0 ? prev - cur : null,
                teamId: String(r.team?.id ?? ''),
                abbr: String(r.team?.abbreviation ?? ''),
                name: String(r.team?.nickname ? `${r.team.location ?? ''} ${r.team.nickname}`.trim() : r.team?.name ?? r.team?.displayName ?? ''),
                logo: r.team?.logo ?? null,
                record: r.recordSummary ?? null,
                points: num(r.points),
                firstPlaceVotes: num(r.firstPlaceVotes),
                conferenceId: r.team?.conferenceId ? String(r.team.conferenceId) : null,
              }
            }
          ),
        })
      )
  })
}

// ---------------------------------------------------------------------------
// Team stats
// ---------------------------------------------------------------------------

export interface TeamStatCategory {
  name: string
  stats: Record<string, { label: string; value: number; display: string; perGame: number | null; rank: number | null }>
}

/** Full team season stats from ESPN's core API, with national ranks where ESPN provides them. Cached 1h. */
export async function getTeamStats(sport: EspnSport, league: EspnLeagueSlug, teamId: string, season?: number): Promise<TeamStatCategory[] | null> {
  const year = season ?? new Date().getUTCFullYear()
  return cachedGet(`espn:tstats:${league}:${teamId}:${year}`, TTL.stats, async () => {
    const data = await get(`${CORE}/${sport}/leagues/${league}/seasons/${year}/types/2/teams/${teamId}/statistics/0`, `${league} team stats ${teamId}`)
    const cats: Json[] | undefined = data?.splits?.categories
    if (!cats) return null
    return cats.map((c) => ({
      name: String(c.name),
      stats: Object.fromEntries(
        ((c.stats as Json[] | undefined) ?? []).map((s) => [
          String(s.name),
          { label: String(s.abbreviation ?? s.shortDisplayName ?? s.name), value: num(s.value) ?? 0, display: String(s.displayValue ?? s.value ?? ''), perGame: num(s.perGameValue), rank: num(s.rank) },
        ])
      ),
    }))
  })
}

// ---------------------------------------------------------------------------
// League-wide team stats (for national ranks) — ESPN common v3 "byteam"
// ---------------------------------------------------------------------------

export interface AllTeamStatsRow {
  teamId: string
  abbr: string
  name: string
  /** The team's own numbers keyed by ESPN stat name (passingYards, avgPoints, …). */
  own: Record<string, number>
  /** What its opponents did against it (the second copy of each category in the feed). */
  opp: Record<string, number>
}

/** Every team's season stats in one call, own and opponent, so national ranks can be computed. Cached 1h. */
export async function getAllTeamStats(sport: EspnSport, league: EspnLeagueSlug, season?: number): Promise<AllTeamStatsRow[] | null> {
  const ref = { sport, league }
  const qs = new URLSearchParams({ seasontype: '2', limit: '500' })
  if (season) qs.set('season', String(season))
  return cachedGet(`espn:byteam:${league}:${qs.toString()}`, TTL.stats, async () => {
    const data = await get(`${WEB}/common/v3/sports/${slug(ref)}/statistics/byteam?${qs.toString()}`, `${league} byteam`, 25000)
    if (!data) return null
    const cats: Json[] = data.categories ?? []
    const out: AllTeamStatsRow[] = []
    for (const t of (data.teams as Json[] | undefined) ?? []) {
      const own: Record<string, number> = {}
      const opp: Record<string, number> = {}
      const seen = new Set<string>()
      ;(t.categories as Json[] | undefined)?.forEach((c) => {
        const names: string[] = (cats.find((m) => m.name === c.name && m.names)?.names as string[] | undefined) ?? []
        const target = seen.has(String(c.name)) ? opp : own
        seen.add(String(c.name))
        names.forEach((n, i) => {
          const v = num((c.values as unknown[])?.[i])
          if (v !== null && target[n] === undefined) target[n] = v
        })
      })
      out.push({ teamId: String(t.team?.id), abbr: appAbbr(ref, String(t.team?.abbreviation ?? '')), name: String(t.team?.displayName ?? ''), own, opp })
    }
    return out.length > 0 ? out : null
  })
}

/** All players' season stats in the app's flat shape, sorted by a sort key (e.g. "passing.passingYards"). Paged; cached 1h. */
export interface AllPlayerStatsRow {
  playerId: string
  name: string
  position: string
  teamId: string
  teamAbbr: string
  /** Stats keyed `${category}.${name}`, e.g. passing.passingYards. */
  stats: Record<string, number>
}

export async function getAllPlayerStats(sport: EspnSport, league: EspnLeagueSlug, opts: { season?: number; sort: string; limit?: number }): Promise<AllPlayerStatsRow[] | null> {
  const ref = { sport, league }
  const limit = Math.min(opts.limit ?? 150, 500)
  const qs = new URLSearchParams({ seasontype: '2', isqualified: 'false', limit: String(limit), sort: `${opts.sort}:desc` })
  if (opts.season) qs.set('season', String(opts.season))
  return cachedGet(`espn:byathlete:${league}:${qs.toString()}`, TTL.stats, async () => {
    const data = await get(`${WEB}/common/v3/sports/${slug(ref)}/statistics/byathlete?${qs.toString()}`, `${league} byathlete`, 30000)
    if (!data) return null
    const cats: Json[] = data.categories ?? []
    return ((data.athletes as Json[] | undefined) ?? []).map((row): AllPlayerStatsRow => {
      const a = row.athlete ?? {}
      const stats: Record<string, number> = {}
      for (const c of (row.categories as Json[] | undefined) ?? []) {
        const names: string[] = (cats.find((m) => m.name === c.name)?.names as string[] | undefined) ?? []
        names.forEach((n, i) => {
          const v = num((c.values as unknown[])?.[i])
          if (v !== null) stats[`${c.name}.${n}`] = v
        })
      }
      return {
        playerId: String(a.id),
        name: String(a.displayName ?? ''),
        position: String(a.position?.abbreviation ?? ''),
        teamId: String(a.teamId ?? ''),
        teamAbbr: appAbbr(ref, String(a.teamShortName ?? '')),
        stats,
      }
    })
  })
}

// ---------------------------------------------------------------------------
// Compatibility shims for the original single-sport helpers
// ---------------------------------------------------------------------------

export const getNFLLiveScores = () => scoreboardFor('nfl', { ttl: 30 })
export const getNFLInjuries = () => getInjuries('football', 'nfl')
export const getNFLNews = (limit?: number) => getNews('football', 'nfl', limit)
export const getCFBScores = () => scoreboardFor('cfb', { ttl: 60 })

/** Injuries by app sport id. */
export const injuriesFor = (sport: Sport) => getInjuries(ESPN_REF[sport].sport, ESPN_REF[sport].league)
