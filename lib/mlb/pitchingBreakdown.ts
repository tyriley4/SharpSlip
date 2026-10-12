import type { RawGameLogEntry, RawRosterEntry } from './api'
import {
  getGameLinescore,
  getMlbTeamsIndex,
  getPerson,
  getPitchArsenal,
  getPlayerGameLog,
  getPlayerHandednessSplit,
  getPlayerStats,
  getSabermetrics,
  getTeamRoster,
} from './api'
import { computeHitRate, mostRecentFirst } from './bettingStats'
import { getGameLineup, getGameMatchup, type LineupEntry } from './gameBreakdown'

function eraFromGames(games: RawGameLogEntry[]): number | null {
  const er = games.reduce((s, g) => s + Number(g.stat.earnedRuns ?? 0), 0)
  const outs = games.reduce((s, g) => s + Number(g.stat.outs ?? 0), 0)
  return outs > 0 ? Math.round(((9 * er) / (outs / 3)) * 100) / 100 : null
}

// ---------------------------------------------------------------------------
// Starters — Overview
// ---------------------------------------------------------------------------

export interface StarterOverview {
  id: number
  name: string
  team: string
  handedness: 'L' | 'R' | '—'
  era: number
  fip: number
  whip: number
  k9: number
  bb9: number
  kPct: number
  avgAgainst: string
  wins: number
  losses: number
  homeEra: number | null
  awayEra: number | null
  avgVsLeft: string | null
  avgVsRight: string | null
}

export async function getStarterOverview(pitcherId: number): Promise<StarterOverview | null> {
  const [person, season, saber, log, teams, vsLeft, vsRight] = await Promise.all([
    getPerson(pitcherId),
    getPlayerStats(pitcherId, 'pitching'),
    getSabermetrics(pitcherId),
    getPlayerGameLog(pitcherId, 'pitching'),
    getMlbTeamsIndex(),
    getPlayerHandednessSplit(pitcherId, 'vl', 'pitching'),
    getPlayerHandednessSplit(pitcherId, 'vr', 'pitching'),
  ])
  if (!person || !season) return null

  const stat = season.stat
  const battersFaced = Number(stat.battersFaced ?? 0)
  const strikeOuts = Number(stat.strikeOuts ?? 0)
  const games = log ?? []

  return {
    id: pitcherId,
    name: person.fullName,
    team: person.currentTeam ? (teams?.get(person.currentTeam.id)?.abbr ?? person.currentTeam.name) : '',
    handedness: (person.pitchHand?.code as 'L' | 'R') ?? '—',
    era: Number(stat.era ?? 0),
    fip: saber ? Math.round(saber.fip * 100) / 100 : Number(stat.era ?? 0),
    whip: Number(stat.whip ?? 0),
    k9: Number(stat.strikeoutsPer9Inn ?? 0),
    bb9: Number(stat.walksPer9Inn ?? 0),
    kPct: battersFaced > 0 ? Math.round((strikeOuts / battersFaced) * 1000) / 10 : 0,
    avgAgainst: String(stat.avg ?? '—'),
    wins: Number(stat.wins ?? 0),
    losses: Number(stat.losses ?? 0),
    homeEra: eraFromGames(games.filter((g) => g.isHome)),
    awayEra: eraFromGames(games.filter((g) => !g.isHome)),
    avgVsLeft: vsLeft ? String(vsLeft.stat.avg ?? '—') : null,
    avgVsRight: vsRight ? String(vsRight.stat.avg ?? '—') : null,
  }
}

// ---------------------------------------------------------------------------
// Starters — Advanced (real pitch mix from Statcast-backed pitchArsenal, real FIP/xFIP)
// ---------------------------------------------------------------------------

export interface PitchMixEntry {
  code: string
  label: string
  pct: number
  avgVelo: number
}

export interface StarterAdvanced {
  pitchMix: PitchMixEntry[]
  fip: number | null
  xfip: number | null
  war: number | null
}

const PITCH_LABELS: Record<string, string> = {
  FF: 'Four-Seam',
  SI: 'Sinker',
  FC: 'Cutter',
  SL: 'Slider',
  ST: 'Sweeper',
  CU: 'Curveball',
  CH: 'Changeup',
  FS: 'Splitter',
  KC: 'Knuckle Curve',
}

/**
 * Real Statcast-backed pitch mix + velocity. Ground ball%/fly ball%/line drive% and per-pitch
 * whiff rate are NOT exposed by the free MLB Stats API, so they're intentionally omitted here
 * rather than approximated.
 */
export async function getStarterAdvanced(pitcherId: number): Promise<StarterAdvanced | null> {
  const [arsenal, saber] = await Promise.all([getPitchArsenal(pitcherId), getSabermetrics(pitcherId)])

  const pitchMix = (arsenal ?? [])
    .map((p) => ({
      code: p.type.code,
      label: PITCH_LABELS[p.type.code] ?? p.type.description,
      pct: Math.round(p.percentage * 1000) / 10,
      avgVelo: Math.round(p.averageSpeed * 10) / 10,
    }))
    .sort((a, b) => b.pct - a.pct)

  if (pitchMix.length === 0 && !saber) return null

  return {
    pitchMix,
    fip: saber ? Math.round(saber.fip * 100) / 100 : null,
    xfip: saber ? Math.round(saber.xfip * 100) / 100 : null,
    war: saber ? Math.round(saber.war * 100) / 100 : null,
  }
}

// ---------------------------------------------------------------------------
// Starters — Last 5 starts
// ---------------------------------------------------------------------------

export interface StarterStartLog {
  date: string
  opp: string
  ip: string
  h: number
  er: number
  bb: number
  k: number
  result: 'W' | 'L' | 'ND'
  gamePk?: number
}

export async function getStarterLast5(pitcherId: number): Promise<StarterStartLog[]> {
  const [log, teams] = await Promise.all([getPlayerGameLog(pitcherId, 'pitching'), getMlbTeamsIndex()])
  const games = mostRecentFirst(log ?? [])
  return games.slice(0, 5).map((g) => ({
    date: g.date,
    opp: teams?.get(g.opponent.id)?.abbr ?? g.opponent.name.slice(0, 3).toUpperCase(),
    ip: String(g.stat.inningsPitched ?? '0'),
    h: Number(g.stat.hits ?? 0),
    er: Number(g.stat.earnedRuns ?? 0),
    bb: Number(g.stat.baseOnBalls ?? 0),
    k: Number(g.stat.strikeOuts ?? 0),
    result: Number(g.stat.wins ?? 0) === 1 ? 'W' : Number(g.stat.losses ?? 0) === 1 ? 'L' : 'ND',
    gamePk: g.game?.gamePk,
  }))
}

// ---------------------------------------------------------------------------
// Starters — vs today's opposing lineup (real handedness splits per batter)
// ---------------------------------------------------------------------------

export interface VsLineupRow {
  order: number
  name: string
  avg: string
  obp: string
  slg: string
}

/** How today's opposing lineup has hit vs this pitcher's throwing hand this season (real per-batter splits). */
export async function getVsLineup(pitcherHand: 'L' | 'R', lineup: LineupEntry[]): Promise<VsLineupRow[]> {
  const sitCode = pitcherHand === 'L' ? 'vl' : 'vr'
  const results = await Promise.all(
    lineup.map(async (entry) => {
      const split = await getPlayerHandednessSplit(entry.id, sitCode, 'hitting')
      return {
        order: entry.order,
        name: entry.name,
        avg: split ? String(split.stat.avg ?? '—') : '—',
        obp: split ? String(split.stat.obp ?? '—') : '—',
        slg: split ? String(split.stat.slg ?? '—') : '—',
      }
    })
  )
  return results
}

// ---------------------------------------------------------------------------
// Starters — Betting stats (K props, outs, hits allowed, earned runs, NRFI)
// ---------------------------------------------------------------------------

export const STARTER_K_THRESHOLDS = [3.5, 4.5, 5.5, 6.5, 7.5, 8.5]
export const STARTER_OUTS_THRESHOLDS = [9.5, 12.5, 15.5, 17.5]
export const STARTER_HITS_ALLOWED_THRESHOLDS = [3.5, 4.5, 5.5, 6.5]
export const STARTER_EARNED_RUNS_THRESHOLDS = [0.5, 1.5, 2.5]

export interface ThresholdHitRate {
  threshold: number
  hitRate: number
  wins: number
  losses: number
}

function hitRatesForThresholds(games: RawGameLogEntry[], statKey: string, thresholds: number[]): ThresholdHitRate[] {
  return thresholds.map((threshold) => {
    const r = computeHitRate(games, statKey, threshold)
    return { threshold, hitRate: r.hitRate, wins: r.wins, losses: r.losses }
  })
}

export interface StarterBettingStats {
  strikeouts: ThresholdHitRate[]
  outs: ThresholdHitRate[]
  hitsAllowed: ThresholdHitRate[]
  earnedRuns: ThresholdHitRate[]
  gamesPlayed: number
}

export async function getStarterBettingStats(pitcherId: number): Promise<StarterBettingStats | null> {
  const log = await getPlayerGameLog(pitcherId, 'pitching')
  if (!log || log.length === 0) return null
  return {
    strikeouts: hitRatesForThresholds(log, 'strikeOuts', STARTER_K_THRESHOLDS),
    outs: hitRatesForThresholds(log, 'outs', STARTER_OUTS_THRESHOLDS),
    hitsAllowed: hitRatesForThresholds(log, 'hits', STARTER_HITS_ALLOWED_THRESHOLDS),
    earnedRuns: hitRatesForThresholds(log, 'earnedRuns', STARTER_EARNED_RUNS_THRESHOLDS),
    gamesPlayed: log.length,
  }
}

/**
 * Real NRFI rate for a starter: the % of his last N starts where the game's first inning (both
 * halves) had zero combined runs. Requires one lightweight linescore fetch per past start.
 */
export async function getPitcherNrfiRate(pitcherId: number, sampleSize = 10): Promise<{ rate: number; sample: number }> {
  const log = await getPlayerGameLog(pitcherId, 'pitching')
  const games = mostRecentFirst(log ?? []).slice(0, sampleSize).filter((g) => g.game?.gamePk)

  const results = await Promise.all(
    games.map(async (g) => {
      const linescore = await getGameLinescore(g.game!.gamePk)
      const first = linescore?.innings?.find((i) => i.num === 1)
      if (!first) return null
      const runs = (first.home?.runs ?? 0) + (first.away?.runs ?? 0)
      return runs === 0
    })
  )

  const valid = results.filter((r): r is boolean => r !== null)
  if (valid.length === 0) return { rate: 0, sample: 0 }
  const nrfiCount = valid.filter(Boolean).length
  return { rate: Math.round((nrfiCount / valid.length) * 1000) / 10, sample: valid.length }
}

// ---------------------------------------------------------------------------
// Bullpen — Game stats (active relievers, role, rest, last outing)
// ---------------------------------------------------------------------------

export type BullpenRole = 'Closer' | 'Setup' | 'Middle' | 'Long Relief'

export interface BullpenArm {
  id: number
  name: string
  handedness: 'L' | 'R' | '—'
  era: number
  whip: number
  k9: number
  appearances: number
  role: BullpenRole
  daysRest: number | null
  lastOutingDate: string | null
  lastOutingIp: string | null
}

function classifyRole(saves: number, holds: number, appearances: number, outs: number): BullpenRole {
  if (saves >= 5) return 'Closer'
  if (holds >= 5) return 'Setup'
  const avgOutsPerApp = appearances > 0 ? outs / appearances : 0
  if (avgOutsPerApp >= 6) return 'Long Relief'
  return 'Middle'
}

export async function getBullpenArms(teamId: number, asOfDate: string): Promise<BullpenArm[]> {
  const roster = await getTeamRoster(teamId)
  if (!roster) return []
  const pitchers = roster.filter((r: RawRosterEntry) => r.position.abbreviation === 'P')

  const results = await Promise.all(
    pitchers.map(async (p): Promise<BullpenArm | null> => {
      const [person, season, log] = await Promise.all([
        getPerson(p.person.id),
        getPlayerStats(p.person.id, 'pitching'),
        getPlayerGameLog(p.person.id, 'pitching'),
      ])
      if (!person || !season) return null

      const stat = season.stat
      const gamesStarted = Number(stat.gamesStarted ?? 0)
      const gamesPitched = Number(stat.gamesPitched ?? 0)
      const isReliever = gamesPitched > 0 && gamesStarted / gamesPitched < 0.5
      if (!isReliever) return null

      const games = mostRecentFirst(log ?? [])
      const lastOuting = games[0] ?? null
      const daysRest = lastOuting
        ? Math.floor((new Date(asOfDate).getTime() - new Date(lastOuting.date).getTime()) / (24 * 60 * 60 * 1000))
        : null

      return {
        id: p.person.id,
        name: person.fullName,
        handedness: (person.pitchHand?.code as 'L' | 'R' | undefined) ?? '—',
        era: Number(stat.era ?? 0),
        whip: Number(stat.whip ?? 0),
        k9: Number(stat.strikeoutsPer9Inn ?? 0),
        appearances: gamesPitched,
        role: classifyRole(Number(stat.saves ?? 0), Number(stat.holds ?? 0), gamesPitched, Number(stat.outs ?? 0)),
        daysRest,
        lastOutingDate: lastOuting?.date ?? null,
        lastOutingIp: lastOuting ? String(lastOuting.stat.inningsPitched ?? '0') : null,
      }
    })
  )

  return results
    .filter((r): r is BullpenArm => r !== null)
    .sort((a, b) => {
      const order: Record<BullpenRole, number> = { Closer: 0, Setup: 1, Middle: 2, 'Long Relief': 3 }
      return order[a.role] - order[b.role] || a.era - b.era
    })
}

// ---------------------------------------------------------------------------
// Bullpen — Betting stats (team bullpen ERA season + L7, blown saves, hold%/save%)
// ---------------------------------------------------------------------------

export interface BullpenBettingStats {
  seasonEra: number | null
  last7Era: number | null
  blownSaves: number
  saveOpportunities: number
  savePct: number | null
  holdPct: number | null
}

export async function getBullpenBettingStats(teamId: number): Promise<BullpenBettingStats> {
  const roster = await getTeamRoster(teamId)
  if (!roster) return { seasonEra: null, last7Era: null, blownSaves: 0, saveOpportunities: 0, savePct: null, holdPct: null }
  const pitchers = roster.filter((r: RawRosterEntry) => r.position.abbreviation === 'P')
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000

  const results = await Promise.all(
    pitchers.map(async (p) => {
      const [season, log] = await Promise.all([getPlayerStats(p.person.id, 'pitching'), getPlayerGameLog(p.person.id, 'pitching')])
      if (!season) return null
      const stat = season.stat
      const gamesStarted = Number(stat.gamesStarted ?? 0)
      const gamesPitched = Number(stat.gamesPitched ?? 0)
      const isReliever = gamesPitched > 0 && gamesStarted / gamesPitched < 0.5
      if (!isReliever) return null

      const games = log ?? []
      const last7Games = games.filter((g) => new Date(g.date).getTime() >= cutoff)

      return {
        seasonEr: Number(stat.earnedRuns ?? 0),
        seasonOuts: Number(stat.outs ?? 0),
        last7Er: last7Games.reduce((s, g) => s + Number(g.stat.earnedRuns ?? 0), 0),
        last7Outs: last7Games.reduce((s, g) => s + Number(g.stat.outs ?? 0), 0),
        blownSaves: Number(stat.blownSaves ?? 0),
        saveOpportunities: Number(stat.saveOpportunities ?? 0),
        saves: Number(stat.saves ?? 0),
        holds: Number(stat.holds ?? 0),
      }
    })
  )

  const valid = results.filter((r): r is NonNullable<typeof r> => r !== null)
  const seasonEr = valid.reduce((s, r) => s + r.seasonEr, 0)
  const seasonOuts = valid.reduce((s, r) => s + r.seasonOuts, 0)
  const last7Er = valid.reduce((s, r) => s + r.last7Er, 0)
  const last7Outs = valid.reduce((s, r) => s + r.last7Outs, 0)
  const blownSaves = valid.reduce((s, r) => s + r.blownSaves, 0)
  const saveOpportunities = valid.reduce((s, r) => s + r.saveOpportunities, 0)
  const saves = valid.reduce((s, r) => s + r.saves, 0)
  const holds = valid.reduce((s, r) => s + r.holds, 0)
  const holdOpportunities = holds + blownSaves

  return {
    seasonEra: seasonOuts > 0 ? Math.round(((9 * seasonEr) / (seasonOuts / 3)) * 100) / 100 : null,
    last7Era: last7Outs > 0 ? Math.round(((9 * last7Er) / (last7Outs / 3)) * 100) / 100 : null,
    blownSaves,
    saveOpportunities,
    savePct: saveOpportunities > 0 ? Math.round((saves / saveOpportunities) * 1000) / 10 : null,
    holdPct: holdOpportunities > 0 ? Math.round((holds / holdOpportunities) * 1000) / 10 : null,
  }
}

// ---------------------------------------------------------------------------
// Full Pitching-tab aggregator (everything for one selected team, one call)
// ---------------------------------------------------------------------------

export interface PitchingTabData {
  starter: StarterOverview | null
  advanced: StarterAdvanced | null
  last5: StarterStartLog[]
  vsLineup: VsLineupRow[]
  starterBetting: StarterBettingStats | null
  nrfi: {
    thisStarter: { rate: number; sample: number }
    opposingStarter: { rate: number; sample: number } | null
    combined: number | null
  }
  bullpenArms: BullpenArm[]
  bullpenBetting: BullpenBettingStats
}

export async function getPitchingTabData(gamePk: number, team: 'away' | 'home'): Promise<PitchingTabData | null> {
  const matchup = await getGameMatchup(gamePk)
  if (!matchup) return null

  const teamInfo = team === 'away' ? matchup.away : matchup.home
  const starterRef = team === 'away' ? matchup.probablePitchers.away : matchup.probablePitchers.home
  const oppStarterRef = team === 'away' ? matchup.probablePitchers.home : matchup.probablePitchers.away

  const [bullpenArms, bullpenBetting] = await Promise.all([
    getBullpenArms(teamInfo.id, matchup.gameDate),
    getBullpenBettingStats(teamInfo.id),
  ])

  if (!starterRef) {
    return {
      starter: null,
      advanced: null,
      last5: [],
      vsLineup: [],
      starterBetting: null,
      nrfi: { thisStarter: { rate: 0, sample: 0 }, opposingStarter: null, combined: null },
      bullpenArms,
      bullpenBetting,
    }
  }

  const lineups = await getGameLineup(gamePk, matchup.status === 'Live' ? 30 : 300)
  const oppLineup = team === 'away' ? (lineups?.home.players ?? []) : (lineups?.away.players ?? [])

  const [starter, advanced, last5, starterBetting, thisNrfi, oppNrfi] = await Promise.all([
    getStarterOverview(starterRef.id),
    getStarterAdvanced(starterRef.id),
    getStarterLast5(starterRef.id),
    getStarterBettingStats(starterRef.id),
    getPitcherNrfiRate(starterRef.id),
    oppStarterRef ? getPitcherNrfiRate(oppStarterRef.id) : Promise.resolve(null),
  ])

  const vsLineup = starter ? await getVsLineup(starter.handedness === 'L' ? 'L' : 'R', oppLineup) : []
  const combined =
    oppNrfi && thisNrfi.sample > 0 && oppNrfi.sample > 0 ? Math.round(((thisNrfi.rate + oppNrfi.rate) / 2) * 10) / 10 : null

  return {
    starter,
    advanced,
    last5,
    vsLineup,
    starterBetting,
    nrfi: { thisStarter: thisNrfi, opposingStarter: oppNrfi, combined },
    bullpenArms,
    bullpenBetting,
  }
}
