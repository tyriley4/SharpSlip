import { MLB_TEAM_COLORS } from '@/data/mlb/teamColors'
import { getStandings, getTeamStats, type RawTeamStatLine } from '@/lib/mlb/api'
import { fetchJson } from '@/lib/mlb/fetchJson'
import { getMlbTeamsIndex, type MlbTeamInfo } from '@/lib/mlb/teams'
import { cityFromName } from '@/lib/standings/common'
import { buildMlbStandings } from '@/lib/standings/mlb'
import type { StandingsRow } from '@/lib/standings/types'
import { mapWithConcurrency } from '@/lib/utils/concurrency'
import { chronological, compareStat, diffTone, finals, lineOutcome, moneyline, pctOf, pctTone, recordString, tally, totalOutcome } from './analysis'
import { assembleBetting } from './assemble'
import type { RosterGroup, RosterPlayer, StatLine, StatSection, SummaryCard, TeamGame, TeamPageData } from './types'

const BASE = 'https://statsapi.mlb.com/api/v1'
const SCHEDULE_TTL = 3600
const ROSTER_TTL = 86400

// ---------------------------------------------------------------------------
// Schedule
// ---------------------------------------------------------------------------

interface RawProbable {
  id: number
  fullName: string
}

interface RawGame {
  gamePk: number
  gameDate: string
  officialDate: string
  status: { abstractGameState: string; detailedState: string }
  teams: {
    away: { team: { id: number }; score?: number; probablePitcher?: RawProbable }
    home: { team: { id: number }; score?: number; probablePitcher?: RawProbable }
  }
  linescore?: { innings?: { num: number; home?: { runs?: number }; away?: { runs?: number } }[]; currentInning?: number; scheduledInnings?: number }
  venue?: { name: string }
  broadcasts?: { name: string; type: string; isNational?: boolean }[]
  dayNight?: string
}

interface ScheduleResponse {
  dates: { games: RawGame[] }[]
}

function currentYear(): number {
  return new Date().getFullYear()
}

/** The team's full regular-season schedule with scores, times, TV, starters and linescores. Revalidates hourly. */
export async function getMLBTeamSchedule(teamId: number, season = currentYear()): Promise<RawGame[] | null> {
  const url = `${BASE}/schedule?sportId=1&teamId=${teamId}&season=${season}&gameType=R&hydrate=probablePitcher,linescore,broadcasts`
  const data = await fetchJson<ScheduleResponse>(url, SCHEDULE_TTL, `mlb-team-schedule-${teamId}-${season}`)
  return data ? data.dates.flatMap((d) => d.games) : null
}

async function pitcherHands(ids: number[]): Promise<Map<number, 'L' | 'R'>> {
  const out = new Map<number, 'L' | 'R'>()
  const unique = Array.from(new Set(ids))
  for (let i = 0; i < unique.length; i += 60) {
    const chunk = unique.slice(i, i + 60)
    const data = await fetchJson<{ people?: { id: number; pitchHand?: { code: string } }[] }>(`${BASE}/people?personIds=${chunk.join(',')}&fields=people,id,pitchHand,code`, 86400, `mlb-hands-${chunk[0]}-${chunk.length}`)
    for (const p of data?.people ?? []) if (p.pitchHand?.code === 'L' || p.pitchHand?.code === 'R') out.set(p.id, p.pitchHand.code)
  }
  return out
}

interface BoxPitcher {
  stats?: { pitching?: { inningsPitched?: string; earnedRuns?: number; strikeOuts?: number } }
}

async function starterLine(gamePk: number, home: boolean, pitcher: RawProbable): Promise<string> {
  const box = await fetchJson<{ teams: Record<'home' | 'away', { players: Record<string, BoxPitcher> }> }>(`${BASE}/game/${gamePk}/boxscore`, 86400, `mlb-box-${gamePk}`)
  const stats = box?.teams[home ? 'home' : 'away']?.players[`ID${pitcher.id}`]?.stats?.pitching
  if (!stats?.inningsPitched) return pitcher.fullName
  const ip = parseFloat(stats.inningsPitched)
  const er = stats.earnedRuns ?? 0
  const gameEra = ip > 0 ? ((er * 9) / ip).toFixed(2) : '—'
  return `${pitcher.fullName} · ${stats.inningsPitched} IP, ${er} ER (${gameEra} ERA)`
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`
}

function lastName(full: string): string {
  const parts = full.split(' ')
  return parts[parts.length - 1]
}

async function buildGames(team: MlbTeamInfo, teams: Map<number, MlbTeamInfo>, raw: RawGame[], lgTotal: number): Promise<TeamGame[]> {
  const handIds = raw.filter((g) => g.status.abstractGameState === 'Final').flatMap((g) => {
    const home = g.teams.home.team.id === team.id
    const p = home ? g.teams.away.probablePitcher : g.teams.home.probablePitcher
    return p ? [p.id] : []
  })
  const hands = await pitcherHands(handIds)

  const games: TeamGame[] = raw.map((g) => {
    const home = g.teams.home.team.id === team.id
    const us = home ? g.teams.home : g.teams.away
    const them = home ? g.teams.away : g.teams.home
    const opp = teams.get(them.team.id)
    const final = g.status.abstractGameState === 'Final'
    const live = g.status.abstractGameState === 'Live'
    const postponed = /postponed|cancelled|suspended/i.test(g.status.detailedState)
    const usRuns = final ? (us.score ?? 0) : null
    const themRuns = final ? (them.score ?? 0) : null
    const innings = g.linescore?.innings ?? []
    const through = (n: number) => innings.filter((i) => i.num <= n).reduce((s, i) => s + (i.home?.runs ?? 0) + (i.away?.runs ?? 0), 0)
    const first = innings.find((i) => i.num === 1)
    const tv = g.broadcasts?.find((b) => b.type === 'TV')?.name ?? null
    const opposingStarter = them.probablePitcher

    return {
      id: String(g.gamePk),
      date: g.officialDate,
      startTime: g.gameDate,
      oppAbbr: opp?.abbr ?? '—',
      home,
      state: postponed ? 'Postponed' : final ? 'Final' : live ? 'Live' : 'Upcoming',
      us: usRuns,
      them: themRuns,
      result: final && usRuns !== null && themRuns !== null ? (usRuns > themRuns ? 'W' : 'L') : null,
      tv,
      venue: g.venue?.name ?? null,
      href: `/games/${g.gamePk}`,
      spread: null,
      total: final ? lgTotal : null,
      totalIsProxy: true,
      divisional: opp ? opp.divisionId === team.divisionId : null,
      day: g.dayNight ? g.dayNight === 'day' : null,
      primetime: false,
      oppHand: opposingStarter ? (hands.get(opposingStarter.id) ?? null) : null,
      extra: (g.linescore?.currentInning ?? 9) > (g.linescore?.scheduledInnings ?? 9),
      rest: null,
      f5Total: final && innings.length >= 5 ? through(5) : null,
      firstInningTotal: final && first ? (first.home?.runs ?? 0) + (first.away?.runs ?? 0) : null,
      keyStat: null,
    }
  })

  const ordered = chronological(games)
  ordered.forEach((g, i) => {
    if (i > 0) {
      const prev = new Date(`${ordered[i - 1].date}T12:00:00`).getTime()
      g.rest = Math.max(0, Math.round((new Date(`${g.date}T12:00:00`).getTime() - prev) / 86400000) - 1)
    }
  })

  // Key stat for the five most recent finals: our starter's line that day.
  const recent = chronological(finals(ordered)).slice(-5)
  await mapWithConcurrency(recent, 3, async (g) => {
    const rawGame = raw.find((r) => String(r.gamePk) === g.id)
    const starter = rawGame ? (g.home ? rawGame.teams.home.probablePitcher : rawGame.teams.away.probablePitcher) : undefined
    if (rawGame && starter) g.keyStat = await starterLine(rawGame.gamePk, g.home, starter).catch(() => starter.fullName)
  })
  return ordered
}

// ---------------------------------------------------------------------------
// Stats (full team + league)
// ---------------------------------------------------------------------------

export interface MlbLeagueStats {
  hitting: RawTeamStatLine[]
  pitching: RawTeamStatLine[]
}

/** Season hitting and pitching lines for every team (the team's own line plus the league for ranks). Revalidates hourly. */
export async function getMLBTeamFullStats(): Promise<MlbLeagueStats | null> {
  const [hitting, pitching] = await Promise.all([getTeamStats('hitting'), getTeamStats('pitching')])
  return hitting && pitching ? { hitting, pitching } : null
}

const num = (v: unknown) => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''))
  return Number.isFinite(n) ? n : 0
}
const dec3 = (n: number) => n.toFixed(3).replace(/^0/, '')
const dec2 = (n: number) => n.toFixed(2)
const int = (n: number) => String(Math.round(n))

function mlbStats(abbr: string, league: MlbLeagueStats, abbrById: Map<number, string>): { sections: StatSection[]; key: StatLine[]; lgTotal: number } {
  const hit = league.hitting.map((t) => ({ abbr: abbrById.get(t.team.id) ?? '', s: t.stat }))
  const pit = league.pitching.map((t) => ({ abbr: abbrById.get(t.team.id) ?? '', s: t.stat }))
  const h = (fn: (s: Record<string, string | number>) => number) => hit.map((t) => ({ abbr: t.abbr, value: fn(t.s) }))
  const p = (fn: (s: Record<string, string | number>) => number) => pit.map((t) => ({ abbr: t.abbr, value: fn(t.s) }))

  const ip = (s: Record<string, string | number>) => {
    const [w, f = '0'] = String(s.inningsPitched ?? '0').split('.')
    return num(w) + num(f) / 3
  }
  // FIP constant so league FIP matches league ERA.
  const lgIp = pit.reduce((s, t) => s + ip(t.s), 0)
  const lgEr = pit.reduce((s, t) => s + num(t.s.earnedRuns), 0)
  const raw = (s: Record<string, string | number>) => (13 * num(s.homeRuns) + 3 * (num(s.baseOnBalls) + num(s.hitByPitch)) - 2 * num(s.strikeOuts)) / Math.max(ip(s), 1)
  const lgRaw = pit.reduce((s, t) => s + (13 * num(t.s.homeRuns) + 3 * (num(t.s.baseOnBalls) + num(t.s.hitByPitch)) - 2 * num(t.s.strikeOuts)), 0) / Math.max(lgIp, 1)
  const fipConst = (lgEr * 9) / Math.max(lgIp, 1) - lgRaw

  const L = (label: string, values: { abbr: string; value: number }[], higherBetter: boolean, format: (n: number) => string) => compareStat(label, abbr, values, { higherBetter, format })
  const offense = [
    L('Runs / G', h((s) => num(s.runs) / Math.max(num(s.gamesPlayed), 1)), true, dec2),
    L('AVG', h((s) => num(s.avg)), true, dec3),
    L('OBP', h((s) => num(s.obp)), true, dec3),
    L('SLG', h((s) => num(s.slg)), true, dec3),
    L('OPS', h((s) => num(s.ops)), true, dec3),
    L('Home Runs', h((s) => num(s.homeRuns)), true, int),
    L('Stolen Bases', h((s) => num(s.stolenBases)), true, int),
    L('K%', h((s) => (num(s.strikeOuts) / Math.max(num(s.plateAppearances), 1)) * 100), false, (n) => `${n.toFixed(1)}%`),
  ].filter((x): x is StatLine => !!x)
  const pitching = [
    L('ERA', p((s) => num(s.era)), false, dec2),
    L('WHIP', p((s) => num(s.whip)), false, dec2),
    L('K / 9', p((s) => num(s.strikeoutsPer9Inn)), true, dec2),
    L('BB / 9', p((s) => num(s.walksPer9Inn)), false, dec2),
    L('FIP', p((s) => raw(s) + fipConst), false, dec2),
    L('HR Allowed', p((s) => num(s.homeRuns)), false, int),
  ].filter((x): x is StatLine => !!x)

  const lgRunsPerGame = hit.reduce((s, t) => s + num(t.s.runs) / Math.max(num(t.s.gamesPlayed), 1), 0) / Math.max(hit.length, 1)
  const lgTotal = Math.round(lgRunsPerGame * 2 * 2) / 2
  const pick = (list: StatLine[], labels: string[]) => list.filter((s) => labels.includes(s.label))
  return {
    sections: [
      { title: 'Offense', stats: offense },
      { title: 'Pitching & Defense', stats: pitching },
    ],
    key: [...pick(offense, ['Runs / G', 'OPS', 'Home Runs']), ...pick(pitching, ['ERA', 'WHIP', 'K / 9'])],
    lgTotal: lgTotal || 8.5,
  }
}

// ---------------------------------------------------------------------------
// Roster
// ---------------------------------------------------------------------------

interface RosterEntry {
  jerseyNumber?: string
  position: { abbreviation: string; type: string }
  person: {
    fullName: string
    stats?: { group: { displayName: string }; splits: { stat: Record<string, string | number> }[] }[]
  }
}

/** Active roster with each player's season hitting and pitching lines. Revalidates daily. */
export async function getMLBTeamRoster(teamId: number, season = currentYear()): Promise<RosterEntry[] | null> {
  const url = `${BASE}/teams/${teamId}/roster?rosterType=active&season=${season}&hydrate=person(stats(group=%5Bhitting,pitching%5D,type=%5Bseason%5D,season=${season}))`
  const data = await fetchJson<{ roster: RosterEntry[] }>(url, ROSTER_TTL, `mlb-roster-stats-${teamId}-${season}`)
  return data?.roster ?? null
}

function statOf(e: RosterEntry, group: 'hitting' | 'pitching'): Record<string, string | number> | null {
  return e.person.stats?.find((s) => s.group.displayName === group)?.splits[0]?.stat ?? null
}

function rosterGroups(entries: RosterEntry[]): RosterGroup[] {
  const hitters = entries
    .filter((e) => e.position.type !== 'Pitcher')
    .map((e) => ({ e, s: statOf(e, 'hitting') }))
    .filter((x) => x.s && num(x.s.plateAppearances) > 0)
    .sort((a, b) => num(b.s!.plateAppearances) - num(a.s!.plateAppearances))
    .slice(0, 8)
  const pitchers = entries.map((e) => ({ e, s: statOf(e, 'pitching') })).filter((x) => x.s && e_isPitcher(x.e))
  const starters = pitchers.filter((x) => num(x.s!.gamesStarted) > 0).sort((a, b) => num(b.s!.gamesStarted) - num(a.s!.gamesStarted) || num(b.s!.inningsPitched) - num(a.s!.inningsPitched)).slice(0, 5)
  const starterIds = new Set(starters.map((x) => x.e.person.fullName))
  const pen = pitchers
    .filter((x) => !starterIds.has(x.e.person.fullName) && num(x.s!.gamesStarted) === 0)
    .sort((a, b) => num(b.s!.saves) * 3 + num(b.s!.holds) - (num(a.s!.saves) * 3 + num(a.s!.holds)) || num(b.s!.gamesPlayed) - num(a.s!.gamesPlayed))
    .slice(0, 3)

  const hitter = ({ e, s }: { e: RosterEntry; s: Record<string, string | number> | null }): RosterPlayer => ({
    name: e.person.fullName,
    position: e.position.abbreviation,
    jersey: e.jerseyNumber ?? null,
    stats: [
      { label: 'AVG', value: String(s?.avg ?? '—') },
      { label: 'HR', value: String(s?.homeRuns ?? '—') },
      { label: 'RBI', value: String(s?.rbi ?? '—') },
    ],
    hot: false,
  })
  const pitcher = ({ e, s }: { e: RosterEntry; s: Record<string, string | number> | null }): RosterPlayer => ({
    name: e.person.fullName,
    position: e.position.abbreviation,
    jersey: e.jerseyNumber ?? null,
    stats: [
      { label: 'ERA', value: String(s?.era ?? '—') },
      { label: 'WHIP', value: String(s?.whip ?? '—') },
      { label: 'K', value: String(s?.strikeOuts ?? '—') },
    ],
    hot: false,
  })
  return [
    { title: 'Lineup', players: hitters.map(hitter) },
    { title: 'Rotation', players: starters.map(pitcher) },
    { title: 'Bullpen', players: pen.map(pitcher) },
  ].filter((g) => g.players.length > 0)
}

function e_isPitcher(e: RosterEntry): boolean {
  return e.position.type === 'Pitcher'
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const money = (n: number) => `${n > 0 ? '+' : ''}${n}`

export async function getMlbTeamPage(abbr: string): Promise<TeamPageData | null> {
  const teams = await getMlbTeamsIndex()
  if (!teams) return null
  const team = Array.from(teams.values()).find((t) => t.abbr === abbr)
  if (!team) return null
  const abbrById = new Map(Array.from(teams.values()).map((t) => [t.id, t.abbr]))
  const unavailable: string[] = []

  const [standingsRaw, league, rawGames, rosterRaw] = await Promise.all([
    getStandings().catch(() => null),
    getMLBTeamFullStats().catch(() => null),
    getMLBTeamSchedule(team.id).catch(() => null),
    getMLBTeamRoster(team.id).catch(() => null),
  ])

  const pitching = league?.pitching ?? null
  const standing: StandingsRow | undefined = standingsRaw ? buildMlbStandings(standingsRaw, teams, pitching).rows.find((r) => r.abbr === abbr) : undefined
  if (!standing) unavailable.push('standings')
  if (!league) unavailable.push('team stats')
  if (!rawGames) unavailable.push('schedule')
  if (!rosterRaw) unavailable.push('roster')

  const stats = league ? mlbStats(abbr, league, abbrById) : { sections: [], key: [], lgTotal: 8.5 }
  const games = rawGames ? await buildGames(team, teams, rawGames, stats.lgTotal).catch(() => []) : []
  const played = chronological(finals(games))
  const newestFirst = [...played].reverse()

  const record = standing ? `${standing.w}-${standing.l}` : (() => { const t = tally(played, moneyline); return `${t.wins}-${t.losses}` })()
  const rd = standing?.extras.find((e) => e.key === 'rd')?.value ?? '—'
  const rdNum = parseInt(rd, 10)
  const gp = Math.max(played.length, 1)
  const rs = played.reduce((s, g) => s + (g.us ?? 0), 0)
  const ra = played.reduce((s, g) => s + (g.them ?? 0), 0)
  const eraLine = stats.sections[1]?.stats.find((s) => s.label === 'ERA')
  const rl = tally(played, (g) => lineOutcome(g, -1.5))
  const ou = tally(played, (g) => { const o = totalOutcome(g); return o === 'O' ? 'W' : o === 'U' ? 'L' : o === 'P' ? 'P' : null })

  const summary: SummaryCard[] = [
    { label: 'W-L Record', value: record, tone: 'neutral', sub: standing?.pct ? `${standing.pct} win pct` : undefined },
    { label: 'Run Diff', value: rd, tone: Number.isNaN(rdNum) ? 'neutral' : diffTone(rdNum) },
    { label: 'Home Record', value: standing?.home ?? '—', tone: 'neutral' },
    { label: 'Away Record', value: standing?.away ?? '—', tone: 'neutral' },
    { label: 'Runs / G', value: (rs / gp).toFixed(2), tone: 'neutral' },
    { label: 'ERA', value: eraLine?.value ?? '—', tone: eraLine?.better === true ? 'good' : eraLine?.better === false ? 'bad' : 'neutral' },
    { label: 'Run Line −1.5', value: recordString(rl), tone: pctTone(pctOf(rl)), sub: pctOf(rl) !== null ? `${pctOf(rl)}% cover` : undefined },
    { label: 'Over / Under', value: `${ou.wins}-${ou.losses}`, tone: 'neutral', sub: `vs lg avg ${stats.lgTotal}` },
  ]

  return {
    sport: 'mlb',
    abbr,
    name: team.name,
    city: cityFromName(team.name),
    color: MLB_TEAM_COLORS[abbr] ?? '#3B9EFF',
    record,
    standing: standing ? `${ordinal(standing.divRank)} ${standing.division}` : '—',
    conferenceDivision: `${team.divisionName.startsWith('AL') ? 'American League' : 'National League'} · ${team.divisionName}`,
    streak: standing?.streak || null,
    form: newestFirst.slice(0, 10).map((g) => g.result!).filter(Boolean),
    summary,
    games,
    roster: rosterRaw ? rosterGroups(rosterRaw) : [],
    betting: assembleBetting('mlb', games, { f5Line: Math.round(((stats.lgTotal * 5) / 9) * 2) / 2 }),
    stats: stats.sections,
    keyStats: stats.key,
    keyStatLabel: 'Starter',
    avgFor: played.length ? rs / played.length : null,
    avgAgainst: played.length ? ra / played.length : null,
    unavailable,
  }
}

export { lastName, money }
