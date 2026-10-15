import type { Edge } from '@/data/breakdown/types'
import { getAnalysisEdges } from '@/lib/edges/analysisEdges'
import { detectGameContext } from '@/lib/edges/seasonContext'
import type { SeasonContext } from '@/lib/edges/types'
import { getCollegeDirectory, type CollegeTeam } from '@/lib/college/directory'
import { getGameSummary, getTeamInfo } from '@/lib/espn/api'
import { cached } from '@/lib/net/ttlCache'
import type { NFLTrend } from '@/lib/nfl/trendsEngine'
import { cbbTeamBoxes, CBB_LEAGUE, type BbGameBox } from './box'

/**
 * College basketball matchup, season profiles, edges, trends and tab data — all computed from ESPN box scores.
 * Before a season has produced games the profiles fall back to last season and say so (`priorSeason`).
 */

/** ESPN season year → "2025-26". */
export const seasonLabel = (year: number) => `${year - 1}-${String(year).slice(2)}`

export const r1 = (x: number) => Math.round(x * 10) / 10
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0)

// ---------------------------------------------------------------------------
// Matchup
// ---------------------------------------------------------------------------

export interface CbbSide {
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

export interface CbbMatchup {
  gameId: string
  /** ESPN season year (2026 = 2025-26). */
  season: number
  status: 'Pregame' | 'Live' | 'Final'
  statusText: string
  date: string | null
  away: CbbSide
  home: CbbSide
  venue: { arena: string; city: string | null; state: string | null; capacity: number | null }
  conferenceGame: boolean
  neutral: boolean
  network: string | null
  homeSpread: number | null
  totalLine: number | null
  context: string
  headline: string | null
}

function contextLine(a: CbbSide, h: CbbSide, conferenceGame: boolean, headline: string | null): string {
  const parts: string[] = []
  if (headline) parts.push(headline)
  else if (conferenceGame) parts.push(`${h.conferenceAbbr} conference game`)
  else if (a.conference && a.conference === h.conference) parts.push(`${h.conferenceAbbr} matchup`)
  else parts.push(`Non-conference: ${a.conferenceAbbr || 'D-I'} vs ${h.conferenceAbbr || 'D-I'}`)
  if (a.rank !== null && h.rank !== null) parts.push(`#${a.rank} vs #${h.rank}`)
  else if (a.rank !== null || h.rank !== null) parts.push(`${a.rank !== null ? a.shortName : h.shortName} ranked #${a.rank ?? h.rank}`)
  return parts.join(' · ')
}

export async function getCbbMatchup(gameId: string): Promise<CbbMatchup | null> {
  return cached(`cbb:matchup:${gameId}`, (m: CbbMatchup) => (m.status === 'Live' ? 30 : m.status === 'Final' ? 3600 : 300), async () => {
    const s = await getGameSummary('basketball', CBB_LEAGUE, gameId)
    if (!s) return null
    const dir = await getCollegeDirectory('cbb')
    const away = s.teams.find((t) => t.homeAway === 'away')
    const home = s.teams.find((t) => t.homeAway === 'home')
    if (!away || !home) return null
    const side = (t: typeof away): CbbSide => {
      const d: CollegeTeam | undefined = dir?.byId.get(t.id)
      return {
        id: t.id,
        abbr: d?.abbr ?? t.abbr,
        name: d?.name ?? t.name,
        shortName: d?.shortName ?? t.name,
        color: d?.color ?? '#FF9F1C',
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
    const info = await getTeamInfo('basketball', CBB_LEAGUE, h.id).catch(() => null)
    const conferenceGame = s.conferenceGame || (!!a.conference && a.conference === h.conference)
    return {
      gameId,
      season: s.seasonYear ?? (new Date().getUTCMonth() >= 6 ? new Date().getUTCFullYear() + 1 : new Date().getUTCFullYear()),
      status: s.state === 'in' ? 'Live' : s.state === 'post' ? 'Final' : 'Pregame',
      statusText: s.statusText,
      date: s.date,
      away: a,
      home: h,
      venue: { arena: s.venue.name ?? info?.venue?.name ?? '—', city: s.venue.city ?? info?.venue?.city ?? null, state: s.venue.state, capacity: s.venue.capacity ?? info?.venue?.capacity ?? null },
      conferenceGame,
      neutral: s.neutralSite,
      network: s.network,
      homeSpread: s.odds?.homeSpread ?? null,
      totalLine: s.odds?.total ?? null,
      context: contextLine(a, h, conferenceGame, s.headline),
      headline: s.headline,
    }
  })
}

// ---------------------------------------------------------------------------
// Team season
// ---------------------------------------------------------------------------

export interface CbbPlayerSeason {
  id: string
  name: string
  games: number
  mpg: number
  ppg: number
  rpg: number
  apg: number
  spg: number
  bpg: number
  fgPct: number
  tpPct: number
  ftPct: number
  tpmPg: number
  last5Ppg: number | null
  /** Hot: last 5 scoring average well above the season's. */
  hot: boolean
  /** Points in each game, newest first (for prop hit rates). */
  ptsLog: number[]
}

export interface CbbTeamSeason {
  teamId: string
  abbr: string
  /** Season the numbers come from; differs from the game's season when `priorSeason`. */
  season: number
  priorSeason: boolean
  games: number
  wins: number
  losses: number
  ppg: number
  papg: number
  margin: number
  fgPct: number
  tpPct: number
  ftPct: number
  oppFgPct: number
  oppTpPct: number
  rebPg: number
  oppRebPg: number
  astPg: number
  toPg: number
  stlPg: number
  blkPg: number
  tpaPg: number
  paintPg: number
  pace: number
  offEff: number
  defEff: number
  homeWinPct: number | null
  awayWinPct: number | null
  homeGames: number
  awayGames: number
  last5W: number
  last5L: number
  winStreak: number
  vsRanked: { w: number; l: number }
  conf: { w: number; l: number }
  /** Games decided by 5 or fewer (record). */
  close: { w: number; l: number }
  boxes: BbGameBox[]
  players: CbbPlayerSeason[]
}

const poss = (t: BbGameBox['team']) => t.fga - t.oreb + t.to + 0.475 * t.fta

export function summarizeCbb(teamId: string, abbr: string, season: number, boxes: BbGameBox[], prior = false): CbbTeamSeason {
  const g = boxes.length
  const sum = (f: (b: BbGameBox) => number) => boxes.reduce((s, b) => s + f(b), 0)
  const per = (x: number) => (g > 0 ? r1(x / g) : 0)
  const wins = boxes.filter((b) => b.result === 'W').length
  const home = boxes.filter((b) => b.home && !b.neutral)
  const away = boxes.filter((b) => !b.home && !b.neutral)
  const winPct = (rows: BbGameBox[]) => (rows.length > 0 ? pct(rows.filter((b) => b.result === 'W').length, rows.length) : null)
  const last5 = boxes.slice(-5)
  let streak = 0
  for (let i = boxes.length - 1; i >= 0 && boxes[i].result === 'W'; i--) streak++
  const ranked = boxes.filter((b) => b.oppRank !== null)
  const conf = boxes.filter((b) => b.conferenceGame)
  const close = boxes.filter((b) => Math.abs(b.us - b.them) <= 5)
  const teamPoss = sum((b) => poss(b.team))
  const oppPoss = sum((b) => poss(b.opp))

  const byPlayer = new Map<string, BbGameBox['players']>()
  const names = new Map<string, string>()
  for (const b of boxes) {
    for (const p of b.players) {
      if (p.min <= 0) continue
      byPlayer.set(p.id, [...(byPlayer.get(p.id) ?? []), p])
      names.set(p.id, p.name)
    }
  }
  const players: CbbPlayerSeason[] = Array.from(byPlayer.entries()).map(([id, list]) => {
    const n = list.length
    const tot = (f: (p: BbGameBox['players'][number]) => number) => list.reduce((s, p) => s + f(p), 0)
    const recent = list.slice(-5)
    const ppg = tot((p) => p.pts) / n
    const l5 = recent.length >= 3 ? recent.reduce((s, p) => s + p.pts, 0) / recent.length : null
    return {
      id,
      name: names.get(id) ?? '',
      games: n,
      mpg: r1(tot((p) => p.min) / n),
      ppg: r1(ppg),
      rpg: r1(tot((p) => p.reb) / n),
      apg: r1(tot((p) => p.ast) / n),
      spg: r1(tot((p) => p.stl) / n),
      bpg: r1(tot((p) => p.blk) / n),
      fgPct: pct(tot((p) => p.fgm), tot((p) => p.fga)),
      tpPct: pct(tot((p) => p.tpm), tot((p) => p.tpa)),
      ftPct: pct(tot((p) => p.ftm), tot((p) => p.fta)),
      tpmPg: r1(tot((p) => p.tpm) / n),
      last5Ppg: l5 === null ? null : r1(l5),
      hot: l5 !== null && n >= 8 && ppg >= 8 && l5 >= ppg * 1.25,
      ptsLog: [...list].reverse().map((p) => p.pts),
    }
  })
  players.sort((a, b) => b.ppg - a.ppg)

  return {
    teamId,
    abbr,
    season,
    priorSeason: prior,
    games: g,
    wins,
    losses: g - wins,
    ppg: per(sum((b) => b.us)),
    papg: per(sum((b) => b.them)),
    margin: per(sum((b) => b.us - b.them)),
    fgPct: pct(sum((b) => b.team.fgm), sum((b) => b.team.fga)),
    tpPct: pct(sum((b) => b.team.tpm), sum((b) => b.team.tpa)),
    ftPct: pct(sum((b) => b.team.ftm), sum((b) => b.team.fta)),
    oppFgPct: pct(sum((b) => b.opp.fgm), sum((b) => b.opp.fga)),
    oppTpPct: pct(sum((b) => b.opp.tpm), sum((b) => b.opp.tpa)),
    rebPg: per(sum((b) => b.team.reb)),
    oppRebPg: per(sum((b) => b.opp.reb)),
    astPg: per(sum((b) => b.team.ast)),
    toPg: per(sum((b) => b.team.to)),
    stlPg: per(sum((b) => b.team.stl)),
    blkPg: per(sum((b) => b.team.blk)),
    tpaPg: per(sum((b) => b.team.tpa)),
    paintPg: per(sum((b) => b.team.paint)),
    pace: g > 0 ? r1((teamPoss + oppPoss) / 2 / g) : 0,
    offEff: teamPoss > 0 ? r1((sum((b) => b.us) / teamPoss) * 100) : 0,
    defEff: oppPoss > 0 ? r1((sum((b) => b.them) / oppPoss) * 100) : 0,
    homeWinPct: winPct(home),
    awayWinPct: winPct(away),
    homeGames: home.length,
    awayGames: away.length,
    last5W: last5.filter((b) => b.result === 'W').length,
    last5L: last5.filter((b) => b.result === 'L').length,
    winStreak: streak,
    vsRanked: { w: ranked.filter((b) => b.result === 'W').length, l: ranked.filter((b) => b.result === 'L').length },
    conf: { w: conf.filter((b) => b.result === 'W').length, l: conf.filter((b) => b.result === 'L').length },
    close: { w: close.filter((b) => b.result === 'W').length, l: close.filter((b) => b.result === 'L').length },
    boxes,
    players,
  }
}

/** The team's season-to-date profile; before tip-off it's last season's, flagged. */
export async function getCbbTeamSeason(teamId: string, abbr: string, season: number): Promise<CbbTeamSeason> {
  const current = await cbbTeamBoxes(teamId, season)
  if (current.length >= 3) return summarizeCbb(teamId, abbr, season, current)
  const prev = await cbbTeamBoxes(teamId, season - 1)
  if (prev.length > 0) return summarizeCbb(teamId, abbr, season - 1, prev, true)
  return summarizeCbb(teamId, abbr, season, current)
}

// ---------------------------------------------------------------------------
// Betting records
// ---------------------------------------------------------------------------

function teamSpread(b: BbGameBox): number | null {
  if (!b.line || b.line.homeSpread === null) return null
  return b.home ? b.line.homeSpread : -b.line.homeSpread
}

export function cbbAts(boxes: BbGameBox[]): { w: number; l: number; p: number; total: number } {
  let w = 0, l = 0, p = 0
  for (const b of boxes) {
    const sp = teamSpread(b)
    if (sp === null) continue
    const m = b.us - b.them + sp
    if (m > 0) w++
    else if (m < 0) l++
    else p++
  }
  return { w, l, p, total: w + l + p }
}

export function cbbOu(boxes: BbGameBox[]): { o: number; u: number; total: number } {
  let o = 0, u = 0
  for (const b of boxes) {
    if (!b.line || b.line.total === null) continue
    const t = b.us + b.them
    if (t > b.line.total) o++
    else if (t < b.line.total) u++
  }
  return { o, u, total: o + u }
}

// ---------------------------------------------------------------------------
// Analysis aggregate
// ---------------------------------------------------------------------------

export interface CbbAnalysisData {
  matchup: CbbMatchup
  awaySeason: CbbTeamSeason
  homeSeason: CbbTeamSeason
  edges: Edge[]
  season: SeasonContext
  contextStats: { label: string; val: string; good: boolean }[]
  teamColors: Record<string, string>
  /** Set when profiles are last season's because this season hasn't started. */
  priorSeasonNote: string | null
}

export async function getCbbAnalysis(gameId: string): Promise<CbbAnalysisData | null> {
  const matchup = await getCbbMatchup(gameId)
  if (!matchup) return null
  // A finished game only knows what led up to it; show the season's profile as of now, which is a fair proxy for Final games too.
  const [awaySeason, homeSeason] = await Promise.all([getCbbTeamSeason(matchup.away.id, matchup.away.abbr, matchup.season), getCbbTeamSeason(matchup.home.id, matchup.home.abbr, matchup.season)])
  const season = await detectGameContext({ sport: 'cbb', gameId: matchup.gameId, startTime: null })
  const edges = season.isPreseason ? [] : await getAnalysisEdges('cbb', matchup.gameId, matchup.away.abbr, matchup.home.abbr)
  const rec = (s: CbbTeamSeason) => `${s.wins}-${s.losses}`
  const contextStats = [
    { label: `${matchup.away.abbr} Record`, val: matchup.away.record ?? rec(awaySeason), good: awaySeason.wins >= awaySeason.losses },
    { label: `${matchup.home.abbr} Record`, val: matchup.home.record ?? rec(homeSeason), good: homeSeason.wins >= homeSeason.losses },
    { label: `${matchup.away.abbr} Pts/G`, val: awaySeason.ppg.toFixed(1), good: awaySeason.ppg >= 76 },
    { label: `${matchup.home.abbr} Pts/G`, val: homeSeason.ppg.toFixed(1), good: homeSeason.ppg >= 76 },
    { label: `${matchup.away.abbr} Allowed/G`, val: awaySeason.papg.toFixed(1), good: awaySeason.papg <= 68 },
    { label: `${matchup.home.abbr} Allowed/G`, val: homeSeason.papg.toFixed(1), good: homeSeason.papg <= 68 },
  ]
  const prior = awaySeason.priorSeason || homeSeason.priorSeason
  return {
    matchup,
    awaySeason,
    homeSeason,
    edges,
    season,
    contextStats,
    teamColors: { [matchup.away.abbr]: matchup.away.color, [matchup.home.abbr]: matchup.home.color },
    priorSeasonNote: prior ? `Showing ${seasonLabel(matchup.season - 1)} results — the ${seasonLabel(matchup.season)} season hasn’t produced enough games yet.` : null,
  }
}

// ---------------------------------------------------------------------------
// Trends
// ---------------------------------------------------------------------------

function teamTrends(s: CbbTeamSeason): Omit<NFLTrend, 'id'>[] {
  const out: Omit<NFLTrend, 'id'>[] = []
  const a = s.abbr
  const last5 = s.boxes.slice(-5)
  const w5 = last5.filter((b) => b.result === 'W').length
  if (last5.length >= 4 && w5 >= 4) out.push({ category: 'Form', title: `${a} — Strong Recent Form`, stat: `${w5}-${last5.length - w5} in last ${last5.length}`, note: 'Playing at a high level heading into this matchup.', hot: w5 === last5.length })
  if (last5.length >= 4 && last5.length - w5 >= 3) out.push({ category: 'Form', title: `${a} — Struggling Stretch`, stat: `${w5}-${last5.length - w5} in last ${last5.length}`, note: 'A trend worth monitoring.', hot: w5 === 0 })
  const l3 = s.boxes.slice(-3)
  if (l3.length === 3) {
    const pts = l3.reduce((t, b) => t + b.us, 0) / 3
    if (pts >= 85) out.push({ category: 'Form', title: `${a} — Offensive Hot Streak`, stat: `${r1(pts)} pts/g over last 3`, note: 'Offense trending well above norms.', hot: pts >= 92 })
    const allowed = l3.reduce((t, b) => t + b.them, 0) / 3
    if (allowed <= 62) out.push({ category: 'Form', title: `${a} — Defensive Dominance`, stat: `${r1(allowed)} pts allowed/g over last 3`, note: 'Defense locking teams down — favors unders.', hot: allowed <= 55 })
    const tp = l3.reduce((t, b) => t + pct(b.team.tpm, b.team.tpa), 0) / 3
    if (tp >= 40) out.push({ category: 'Form', title: `${a} — Three-Point Surge`, stat: `${r1(tp)}% from three over last 3`, note: 'Hot perimeter shooting inflates scoring.', hot: tp >= 45 })
    else if (tp <= 28) out.push({ category: 'Form', title: `${a} — Cold From Deep`, stat: `${r1(tp)}% from three over last 3`, note: 'Perimeter shooting has dried up.', hot: tp <= 24 })
  }
  const conf = s.boxes.filter((b) => b.conferenceGame)
  if (conf.length >= 3) out.push({ category: 'Situational', title: `${a} — Conference Record`, stat: `${s.conf.w}-${s.conf.l} in conference games`, note: 'Conference games are tighter, more familiar matchups.', hot: false })
  if (s.homeGames >= 3) out.push({ category: 'Situational', title: `${a} — Home Record`, stat: `${s.boxes.filter((b) => b.home && !b.neutral && b.result === 'W').length}-${s.boxes.filter((b) => b.home && !b.neutral && b.result === 'L').length} at home`, note: 'Home-court advantage in college basketball is substantial.', hot: s.homeWinPct !== null && s.homeWinPct >= 90 })
  if (s.awayGames >= 3) out.push({ category: 'Situational', title: `${a} — Road Record`, stat: `${s.boxes.filter((b) => !b.home && !b.neutral && b.result === 'W').length}-${s.boxes.filter((b) => !b.home && !b.neutral && b.result === 'L').length} on the road`, note: 'Road performance matters most in hostile arenas.', hot: false })
  if (s.close.w + s.close.l >= 4) out.push({ category: 'Situational', title: `${a} — Close Games`, stat: `${s.close.w}-${s.close.l} in games decided by 5 or fewer`, note: 'How a team closes tight games.', hot: false })
  if (s.vsRanked.w + s.vsRanked.l >= 1) out.push({ category: 'Situational', title: `${a} — vs Ranked Opponents`, stat: `${s.vsRanked.w}-${s.vsRanked.l} straight up`, note: 'Measured against AP top-25 opponents at game time.', hot: s.vsRanked.w > 0 && s.vsRanked.l === 0 && s.vsRanked.w >= 2 })
  const ats = cbbAts(s.boxes)
  if (ats.total >= 4) out.push({ category: 'Situational', title: `${a} — Against the Spread`, stat: `${ats.w}-${ats.l}${ats.p ? `-${ats.p}` : ''} ATS`, note: 'Real DraftKings closing lines recorded by ESPN.', hot: ats.w >= ats.total - 1 && ats.total >= 5 })
  const ou = cbbOu(s.boxes)
  if (ou.total >= 4) out.push({ category: 'Situational', title: `${a} — Over/Under`, stat: `${ou.o} overs, ${ou.u} unders`, note: 'Real DraftKings closing totals.', hot: ou.o >= ou.total - 1 && ou.total >= 5 })
  return out
}

export async function getCbbTrendsData(gameId: string): Promise<{ trends: NFLTrend[]; note: string | null } | null> {
  const data = await getCbbAnalysis(gameId)
  if (!data) return null
  const all = [...teamTrends(data.awaySeason), ...teamTrends(data.homeSeason)]
  const meet = data.awaySeason.boxes.find((b) => b.oppId === data.matchup.home.id && b.date < (data.matchup.date ?? '9'))
  if (meet) all.push({ category: 'H2H', title: `${data.matchup.away.abbr} vs ${data.matchup.home.abbr} — Earlier Meeting`, stat: `${meet.result === 'W' ? data.matchup.away.abbr : data.matchup.home.abbr} won ${meet.us}-${meet.them}`, note: 'The teams have already met this season.', hot: false })
  return { trends: all.sort((x, y) => Number(y.hot) - Number(x.hot)).map((t, i) => ({ ...t, id: i + 1 })), note: data.priorSeasonNote }
}
