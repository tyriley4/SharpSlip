import type { Edge } from '@/data/breakdown/types'
import { getAnalysisEdges } from '@/lib/edges/analysisEdges'
import { getCollegeDirectory, type CollegeTeam } from '@/lib/college/directory'
import { getAllTeamStats, getGameSummary, getTeamInfo, getTeamRoster, scoreboardFor } from '@/lib/espn/api'
import { teamBoxGames, type TeamGameBox } from '@/lib/football/box'
import { cached } from '@/lib/net/ttlCache'
import type { NFLLastGameQB, NFLQBStats, NFLSkillPlayerStats } from '@/lib/nfl/gameBreakdown'

/**
 * College football data for the breakdown tabs, derived from ESPN box scores (see lib/football/box.ts) and
 * ESPN's team directory/rankings. Output types deliberately match the NFL tab types so the same tab
 * components render both leagues.
 */

export const CFB_LEAGUE = 'college-football' as const

export const r1 = (x: number) => Math.round(x * 10) / 10
const pct1 = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0)
const num = (v: string | undefined): number => {
  const x = Number(String(v ?? '').replace(/,/g, ''))
  return Number.isFinite(x) ? x : 0
}

// ---------------------------------------------------------------------------
// Season + matchup
// ---------------------------------------------------------------------------

export async function cfbSeasonYear(): Promise<number> {
  const board = await scoreboardFor('cfb', { ttl: 600 }).catch(() => null)
  if (board?.seasonYear) return board.seasonYear
  const now = new Date()
  return now.getUTCMonth() >= 6 ? now.getUTCFullYear() : now.getUTCFullYear() - 1
}

export interface CfbSide {
  id: string
  abbr: string
  name: string
  shortName: string
  color: string
  logo: string | null
  rank: number | null
  record: string | null
  conference: string
  conferenceAbbr: string
  score: number | null
}

export interface CfbMatchup {
  gameId: string
  season: number
  week: number | null
  status: 'Pregame' | 'Live' | 'Final'
  statusText: string
  /** ISO kickoff time. */
  date: string | null
  away: CfbSide
  home: CfbSide
  venue: { stadium: string; city: string | null; state: string | null; capacity: number | null; indoor: boolean | null }
  conferenceGame: boolean
  neutral: boolean
  network: string | null
  /** Home team's closing/current spread (negative = home favored), from ESPN's DraftKings line. */
  homeSpread: number | null
  totalLine: number | null
  /** Rivalry / conference context line for the Analysis tab. */
  context: string
}

/** Well-known rivalries, keyed by the two team abbreviations sorted alphabetically. */
const RIVALRIES: Record<string, string> = {
  'GT|UGA': 'Clean, Old-Fashioned Hate',
  'FLA|UGA': 'World’s Largest Outdoor Cocktail Party',
  'ALA|AUB': 'Iron Bowl',
  'OKLA|TEX': 'Red River Rivalry',
  'OU|TEX': 'Red River Rivalry',
  'MICH|OSU': 'The Game',
  'MSU|MICH': 'Paul Bunyan Trophy rivalry',
  'ND|USC': 'Jeweled Shillelagh rivalry',
  'ALA|TENN': 'Third Saturday in October',
  'LSU|ALA': 'SEC West heavyweights',
  'ALA|LSU': 'SEC West heavyweights',
  'CLEM|SC': 'Palmetto Bowl',
  'FSU|FLA': 'Sunshine State rivalry',
  'MIA|FSU': 'Sunshine State rivalry',
  'ARMY|NAVY': 'Army–Navy',
  'ORE|WASH': 'Pacific Northwest rivalry',
  'BYU|UTAH': 'Holy War',
  'MISS|MSST': 'Egg Bowl',
  'PITT|WVU': 'Backyard Brawl',
  'IND|PUR': 'Old Oaken Bucket',
  'IOWA|WIS': 'Heartland Trophy',
  'KU|KSU': 'Sunflower Showdown',
  'ARIZ|ASU': 'Territorial Cup',
  'LOU|UK': 'Governor’s Cup',
  'CAL|STAN': 'The Big Game',
  'UCLA|USC': 'Victory Bell',
  'MIZZ|KU': 'Border War',
  'TA&M|TEX': 'Lone Star rivalry',
  'TAMU|TEX': 'Lone Star rivalry',
}

function contextLine(a: CfbSide, h: CfbSide, conferenceGame: boolean, headline: string | null, week: number | null): string {
  const key = [a.abbr, h.abbr].sort().join('|')
  const rival = headline || RIVALRIES[key]
  const parts: string[] = []
  if (conferenceGame) {
    const bothRanked = a.rank !== null && h.rank !== null
    const late = (week ?? 0) >= 9
    parts.push(rival ? `${h.conferenceAbbr} rivalry — ${rival}` : `${h.conferenceAbbr} conference game${bothRanked && late ? ' with championship implications' : bothRanked ? ' between ranked teams' : ''}`)
  } else if (rival) {
    parts.push(`Rivalry — ${rival}`)
  } else if (a.conference === h.conference) {
    parts.push(`${h.conferenceAbbr} matchup`)
  } else {
    parts.push(`Non-conference: ${a.conferenceAbbr} at ${h.conferenceAbbr}`)
  }
  if (a.rank !== null && h.rank !== null) parts.push(`#${a.rank} vs #${h.rank}`)
  else if (a.rank !== null || h.rank !== null) parts.push(`${a.rank !== null ? a.shortName : h.shortName} ranked #${a.rank ?? h.rank}`)
  return parts.join(' · ')
}

function etParts(iso: string | null): { gameday: string; gametime: string } {
  if (!iso) return { gameday: '', gametime: '' }
  const d = new Date(iso)
  const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', hour12: false, ...o }).format(d)
  return { gameday: fmt({ year: 'numeric', month: '2-digit', day: '2-digit' }), gametime: fmt({ hour: '2-digit', minute: '2-digit' }).replace(/^24/, '00') }
}

export async function getCfbMatchup(gameId: string): Promise<CfbMatchup | null> {
  return cached(`cfb:matchup:${gameId}`, (m: CfbMatchup) => (m.status === 'Live' ? 30 : m.status === 'Final' ? 3600 : 300), async () => {
    const s = await getGameSummary('football', CFB_LEAGUE, gameId)
    if (!s) return null
    const dir = await getCollegeDirectory('cfb')
    const away = s.teams.find((t) => t.homeAway === 'away')
    const home = s.teams.find((t) => t.homeAway === 'home')
    if (!away || !home) return null
    const side = (t: typeof away): CfbSide => {
      const d: CollegeTeam | undefined = dir?.byId.get(t.id)
      return {
        id: t.id,
        abbr: d?.abbr ?? t.abbr,
        name: d?.name ?? t.name,
        shortName: d?.shortName ?? t.name,
        color: d?.color ?? '#4d9fff',
        logo: d?.logo ?? t.logo,
        rank: t.rank,
        record: t.record,
        conference: d?.conference ?? '',
        conferenceAbbr: d?.conferenceAbbr ?? '',
        score: s.state === 'pre' ? null : t.score,
      }
    }
    const a = side(away)
    const h = side(home)
    const info = await getTeamInfo('football', CFB_LEAGUE, h.id).catch(() => null)
    const conferenceGame = s.conferenceGame || (!!a.conference && a.conference === h.conference)
    const { week } = s
    return {
      gameId,
      season: s.seasonYear ?? (await cfbSeasonYear()),
      week,
      status: s.state === 'in' ? 'Live' : s.state === 'post' ? 'Final' : 'Pregame',
      statusText: s.statusText,
      date: s.date,
      away: a,
      home: h,
      venue: { stadium: s.venue.name ?? info?.venue?.name ?? '—', city: s.venue.city ?? info?.venue?.city ?? null, state: s.venue.state, capacity: s.venue.capacity ?? info?.venue?.capacity ?? STADIUM_CAPACITY[h.abbr] ?? null, indoor: s.venue.indoor ?? info?.venue?.indoor ?? null },
      conferenceGame,
      neutral: s.neutralSite,
      network: s.network,
      homeSpread: s.odds?.homeSpread ?? null,
      totalLine: s.odds?.total ?? null,
      context: contextLine(a, h, conferenceGame, s.headline, week),
    }
  })
}

/** Capacities for the sport's largest venues, used when ESPN's venue record has none. Home team abbreviation → seats. */
export const STADIUM_CAPACITY: Record<string, number> = {
  MICH: 107601, PSU: 106572, OSU: 102780, TEX: 100119, TENN: 101915, UGA: 92746, ALA: 100077, LSU: 102321, TAMU: 102733, 'TA&M': 102733,
  AUB: 88043, FLA: 88548, OU: 83489, OKLA: 83489, CLEM: 81500, USC: 77500, ND: 77622, NEB: 85458, WIS: 80321, IOWA: 69250, MSU: 75005,
  FSU: 79560, MIA: 64767, ORE: 54000, WASH: 70138, UTAH: 51444, ARK: 76212, MISS: 64038, MSST: 61337, SC: 77559, UK: 61000, MIZZ: 62621,
  KU: 47233, KSU: 50000, OKST: 55509, TCU: 50000, BAY: 45140, TTU: 60454, UNC: 50500, NCST: 57583, VT: 65632, UVA: 61500, PITT: 68400,
  LOU: 60800, BC: 44500, SYR: 49057, WVU: 60000, BYU: 63725, COLO: 50183, ARIZ: 50782, ASU: 53599, STAN: 50424, CAL: 62467, UCLA: 91136,
  PUR: 57236, IND: 52626, MINN: 50805, ILL: 60670, NU: 47130, RUTG: 52454, MD: 51802, VAN: 40350, ARMY: 38000, NAVY: 34000, BOIS: 36387,
}

// ---------------------------------------------------------------------------
// Team season from box scores
// ---------------------------------------------------------------------------

export interface CfbTeamSeason {
  teamId: string
  abbr: string
  games: number
  wins: number
  losses: number
  ppg: number
  papg: number
  passYpg: number
  rushYpg: number
  totalYpg: number
  passAllowedYpg: number
  rushAllowedYpg: number
  turnoversPerGame: number
  turnoversForcedPerGame: number
  sacks: number
  interceptions: number
  tacklesForLoss: number
  passesDefended: number
  tackles: number
  compPctAllowed: number | null
  homeWinPct: number | null
  awayWinPct: number | null
  homeGames: number
  awayGames: number
  last5W: number
  last5L: number
  /** Current winning streak (0 if the last game was a loss). */
  winStreak: number
  /** Results of the most recent road games, newest first. */
  roadResults: ('W' | 'L' | 'T')[]
  vsRanked: { w: number; l: number }
  conf: { w: number; l: number }
  boxes: TeamGameBox[]
}

export function summarizeTeam(teamId: string, abbr: string, boxes: TeamGameBox[]): CfbTeamSeason {
  const g = boxes.length
  const sum = (f: (b: TeamGameBox) => number) => boxes.reduce((s, b) => s + f(b), 0)
  const per = (x: number) => (g > 0 ? r1(x / g) : 0)
  const wins = boxes.filter((b) => b.result === 'W').length
  const losses = boxes.filter((b) => b.result === 'L').length
  const homeBoxes = boxes.filter((b) => b.home)
  const awayBoxes = boxes.filter((b) => !b.home)
  const decided = (rows: TeamGameBox[]) => rows.filter((b) => b.result !== 'T')
  const winPct = (rows: TeamGameBox[]) => (decided(rows).length > 0 ? pct1(decided(rows).filter((b) => b.result === 'W').length, decided(rows).length) : null)
  const last5 = boxes.slice(-5)
  let streak = 0
  for (let i = boxes.length - 1; i >= 0 && boxes[i].result === 'W'; i--) streak++
  const oppComp = sum((b) => b.oppPassing.reduce((s, p) => s + p.comp, 0))
  const oppAtt = sum((b) => b.oppPassing.reduce((s, p) => s + p.att, 0))
  const ranked = boxes.filter((b) => b.oppRank !== null)
  const conf = boxes.filter((b) => b.conferenceGame)
  return {
    teamId,
    abbr,
    games: g,
    wins,
    losses,
    ppg: per(sum((b) => b.us)),
    papg: per(sum((b) => b.them)),
    passYpg: per(sum((b) => num(b.team.netPassingYards))),
    rushYpg: per(sum((b) => num(b.team.rushingYards))),
    totalYpg: per(sum((b) => num(b.team.totalYards))),
    passAllowedYpg: per(sum((b) => num(b.opp.netPassingYards))),
    rushAllowedYpg: per(sum((b) => num(b.opp.rushingYards))),
    turnoversPerGame: g > 0 ? Math.round((sum((b) => num(b.team.turnovers)) / g) * 100) / 100 : 0,
    turnoversForcedPerGame: g > 0 ? Math.round((sum((b) => num(b.opp.turnovers)) / g) * 100) / 100 : 0,
    sacks: sum((b) => b.defense.reduce((s, d) => s + d.sacks, 0)),
    interceptions: sum((b) => b.interceptions.reduce((s, i) => s + i.int, 0)),
    tacklesForLoss: r1(sum((b) => b.defense.reduce((s, d) => s + d.tfl, 0))),
    passesDefended: sum((b) => b.defense.reduce((s, d) => s + d.pd, 0)),
    tackles: sum((b) => b.defense.reduce((s, d) => s + d.tot, 0)),
    compPctAllowed: oppAtt > 0 ? pct1(oppComp, oppAtt) : null,
    homeWinPct: winPct(homeBoxes),
    awayWinPct: winPct(awayBoxes),
    homeGames: homeBoxes.length,
    awayGames: awayBoxes.length,
    last5W: last5.filter((b) => b.result === 'W').length,
    last5L: last5.filter((b) => b.result === 'L').length,
    winStreak: streak,
    roadResults: awayBoxes.map((b) => b.result).reverse(),
    vsRanked: { w: ranked.filter((b) => b.result === 'W').length, l: ranked.filter((b) => b.result === 'L').length },
    conf: { w: conf.filter((b) => b.result === 'W').length, l: conf.filter((b) => b.result === 'L').length },
    boxes,
  }
}

export async function getCfbTeamSeason(teamId: string, abbr: string, season?: number): Promise<CfbTeamSeason> {
  const [raw, dir] = await Promise.all([teamBoxGames(CFB_LEAGUE, teamId, season), getCollegeDirectory('cfb')])
  // ESPN's schedule feed doesn't flag conference games, so derive it from the two teams' conferences.
  const mine = dir?.byId.get(teamId)?.conference
  const boxes = raw.map((b) => ({ ...b, conferenceGame: !!mine && dir?.byId.get(b.oppId)?.conference === mine }))
  return summarizeTeam(teamId, abbr, boxes)
}

// ---------------------------------------------------------------------------
// National ranks (ESPN byteam, all FBS teams)
// ---------------------------------------------------------------------------

export interface RankedStat {
  value: number
  rank: number
}

export interface CfbNationalRanks {
  pointsPerGame: RankedStat | null
  pointsAllowedPerGame: RankedStat | null
  passYpg: RankedStat | null
  rushYpg: RankedStat | null
  passAllowedYpg: RankedStat | null
  rushAllowedYpg: RankedStat | null
  sacks: RankedStat | null
  interceptions: RankedStat | null
  /** Number of teams ranked. */
  of: number
}

export async function getCfbNationalRanks(teamId: string): Promise<CfbNationalRanks | null> {
  const season = await cfbSeasonYear()
  const all = await getAllTeamStats('football', CFB_LEAGUE, season)
  const dir = await getCollegeDirectory('cfb')
  if (!all || !dir) return null
  const fbs = all.filter((t) => dir.byId.has(t.teamId))
  const rank = (pick: (t: (typeof fbs)[number]) => number | undefined, desc: boolean): RankedStat | null => {
    const vals = fbs.map((t) => ({ id: t.teamId, v: pick(t) })).filter((x): x is { id: string; v: number } => typeof x.v === 'number')
    const mine = vals.find((x) => x.id === teamId)
    if (!mine) return null
    const sorted = [...vals].sort((a, b) => (desc ? b.v - a.v : a.v - b.v))
    return { value: mine.v, rank: sorted.findIndex((x) => x.id === teamId) + 1 }
  }
  return {
    pointsPerGame: rank((t) => t.own.totalPointsPerGame, true),
    pointsAllowedPerGame: rank((t) => t.opp.totalPointsPerGame, false),
    passYpg: rank((t) => t.own.passingYardsPerGame, true),
    rushYpg: rank((t) => t.own.rushingYardsPerGame, true),
    passAllowedYpg: rank((t) => t.opp.passingYardsPerGame, false),
    rushAllowedYpg: rank((t) => t.opp.rushingYardsPerGame, false),
    // The offense's "sacks"/"interceptions" in the feed count what it suffered; the opponent copy is what this defense produced.
    sacks: rank((t) => t.opp.sacks, true),
    interceptions: rank((t) => t.opp.interceptions, true),
    of: fbs.length,
  }
}

// ---------------------------------------------------------------------------
// Quarterbacks
// ---------------------------------------------------------------------------

/** NCAA passer efficiency (the college rating scale, where 150+ is excellent). */
export function ncaaRating(comp: number, att: number, yds: number, td: number, int: number): number {
  if (att === 0) return 0
  return (8.4 * yds + 330 * td + 100 * comp - 200 * int) / att
}

/** The team's QB: the passer with the most attempts in its latest game that had one. */
export function pickStarterQB(boxes: TeamGameBox[]): { id: string; name: string } | null {
  for (let i = boxes.length - 1; i >= 0; i--) {
    const top = [...boxes[i].passing].sort((a, b) => b.att - a.att)[0]
    if (top && top.att >= 5) return { id: top.id, name: top.name }
  }
  return null
}

export function qbSeason(boxes: TeamGameBox[], id: string, team: string): NFLQBStats | null {
  const games = boxes.filter((b) => b.passing.some((p) => p.id === id && p.att > 0))
  if (games.length === 0) return null
  let comp = 0, att = 0, yds = 0, td = 0, int = 0, rushYds = 0, rushTd = 0
  for (const b of games) {
    const p = b.passing.find((x) => x.id === id)!
    comp += p.comp; att += p.att; yds += p.yds; td += p.td; int += p.int
    const r = b.rushing.find((x) => x.id === id)
    if (r) { rushYds += r.yds; rushTd += r.td }
  }
  if (att < 10) return null
  const name = games[games.length - 1].passing.find((x) => x.id === id)!.name
  const last5: NFLLastGameQB[] = [...games].reverse().slice(0, 5).map((b) => {
    const p = b.passing.find((x) => x.id === id)!
    return { week: b.week ?? 0, opp: b.oppAbbr, comp: p.comp, att: p.att, yds: p.yds, td: p.td, int: p.int, rating: r1(ncaaRating(p.comp, p.att, p.yds, p.td, p.int)), result: b.result }
  })
  const seasonRating = ncaaRating(comp, att, yds, td, int)
  const last3 = last5.slice(0, 3)
  const l3 = last3.length >= 3 ? r1(last3.reduce((s, g) => s + g.rating, 0) / last3.length) : null
  return {
    playerId: id,
    name,
    team,
    season: { comp, att, yds, td, int, rating: r1(seasonRating), compPct: pct1(comp, att), rushYds, rushTd, sacks: 0 },
    gamesPlayed: games.length,
    last3RatingAvg: l3,
    hot: l3 !== null && l3 > seasonRating + 15,
    cold: l3 !== null && l3 < seasonRating - 15,
    last5,
  }
}

// ---------------------------------------------------------------------------
// Skill players
// ---------------------------------------------------------------------------

async function positionMap(teamId: string): Promise<Map<string, string>> {
  const roster = await getTeamRoster('football', CFB_LEAGUE, teamId).catch(() => null)
  return new Map((roster?.players ?? []).map((p) => [p.id, p.position]))
}

export async function teamSkillPlayers(boxes: TeamGameBox[], teamId: string, abbr: string, position: 'RB' | 'WR' | 'TE'): Promise<NFLSkillPlayerStats[]> {
  const positions = await positionMap(teamId)
  const passerIds = new Set(boxes.flatMap((b) => b.passing.filter((p) => p.att >= 5).map((p) => p.id)))
  const ids = new Set<string>()
  for (const b of boxes) {
    for (const r of b.rushing) ids.add(r.id)
    for (const r of b.receiving) ids.add(r.id)
  }
  const players: NFLSkillPlayerStats[] = []
  Array.from(ids).forEach((id) => {
    if (passerIds.has(id)) return
    const pos = positions.get(id) ?? ''
    const rows = boxes.filter((b) => b.rushing.some((r) => r.id === id) || b.receiving.some((r) => r.id === id))
    let car = 0, rushYds = 0, rushTd = 0, rec = 0, recYds = 0, recTd = 0, tgts = 0, hasTgts = false
    let name = ''
    for (const b of rows) {
      const ru = b.rushing.find((r) => r.id === id)
      const re = b.receiving.find((r) => r.id === id)
      if (ru) { car += ru.car; rushYds += ru.yds; rushTd += ru.td; name = ru.name }
      if (re) { rec += re.rec; recYds += re.yds; recTd += re.td; name = re.name; if (re.tgts !== null) { tgts += re.tgts; hasTgts = true } }
    }
    // Unknown positions: classify by what they do. Heavy rushers are RBs, everyone else a receiver.
    const effective = pos === 'RB' || pos === 'FB' ? 'RB' : pos === 'TE' ? 'TE' : pos === 'WR' ? 'WR' : car >= recYds / 8 && car >= 8 ? 'RB' : 'WR'
    if (effective !== position) return
    if (position === 'RB' ? car < 8 : rec < 3) return
    const last5 = [...rows].reverse().slice(0, 5).map((b) => {
      const ru = b.rushing.find((r) => r.id === id)
      const re = b.receiving.find((r) => r.id === id)
      return { week: b.week ?? 0, opp: b.oppAbbr, att: ru?.car ?? 0, rushYds: ru?.yds ?? 0, rushTd: ru?.td ?? 0, targets: re?.tgts ?? 0, rec: re?.rec ?? 0, recYds: re?.yds ?? 0, recTd: re?.td ?? 0 }
    })
    players.push({
      playerId: id,
      name,
      position,
      team: abbr,
      season: {
        att: car,
        rushYds,
        rushTd,
        ypc: car > 0 ? r1(rushYds / car) : 0,
        targets: hasTgts ? tgts : 0,
        rec,
        recYds,
        recTd,
        // College box scores carry no targets or air yards, so these stay 0 and the tabs hide them.
        targetShare: 0,
        airYardsShare: 0,
      },
      last5,
    })
  })
  return players.sort((a, b) => (position === 'RB' ? b.season.rushYds - a.season.rushYds : b.season.recYds - a.season.recYds)).slice(0, 3)
}

// ---------------------------------------------------------------------------
// Analysis aggregate
// ---------------------------------------------------------------------------

export interface CfbAnalysisData {
  matchup: CfbMatchup
  awayQB: NFLQBStats | null
  homeQB: NFLQBStats | null
  awaySeason: CfbTeamSeason
  homeSeason: CfbTeamSeason
  edges: Edge[]
  contextStats: { label: string; val: string; good: boolean }[]
  teamColors: Record<string, string>
}

export async function getCfbAnalysis(gameId: string): Promise<CfbAnalysisData | null> {
  const matchup = await getCfbMatchup(gameId)
  if (!matchup) return null
  const [awaySeason, homeSeason] = await Promise.all([
    getCfbTeamSeason(matchup.away.id, matchup.away.abbr, matchup.season),
    getCfbTeamSeason(matchup.home.id, matchup.home.abbr, matchup.season),
  ])
  const aq = pickStarterQB(awaySeason.boxes)
  const hq = pickStarterQB(homeSeason.boxes)
  const awayQB = aq ? qbSeason(awaySeason.boxes, aq.id, matchup.away.abbr) : null
  const homeQB = hq ? qbSeason(homeSeason.boxes, hq.id, matchup.home.abbr) : null

  const edges = await getAnalysisEdges('cfb', matchup.gameId, matchup.away.abbr, matchup.home.abbr)

  const rec = (s: CfbTeamSeason) => `${s.wins}-${s.losses}`
  const contextStats = [
    { label: `${matchup.away.abbr} Record`, val: matchup.away.record ?? rec(awaySeason), good: awaySeason.wins >= awaySeason.losses },
    { label: `${matchup.home.abbr} Record`, val: matchup.home.record ?? rec(homeSeason), good: homeSeason.wins >= homeSeason.losses },
    { label: `${matchup.away.abbr} Pts/G`, val: awaySeason.ppg.toFixed(1), good: awaySeason.ppg >= 30 },
    { label: `${matchup.home.abbr} Pts/G`, val: homeSeason.ppg.toFixed(1), good: homeSeason.ppg >= 30 },
    { label: `${matchup.away.abbr} Allowed/G`, val: awaySeason.papg.toFixed(1), good: awaySeason.papg <= 22 },
    { label: `${matchup.home.abbr} Allowed/G`, val: homeSeason.papg.toFixed(1), good: homeSeason.papg <= 22 },
  ]

  return {
    matchup,
    awayQB,
    homeQB,
    awaySeason,
    homeSeason,
    edges,
    contextStats,
    teamColors: { [matchup.away.abbr]: matchup.away.color, [matchup.home.abbr]: matchup.home.color },
  }
}
