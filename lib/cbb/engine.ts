import type { Edge } from '@/data/breakdown/types'
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
// Edges
// ---------------------------------------------------------------------------

export interface CbbEdgeSide {
  abbr: string
  name: string
  rank: number | null
  season: CbbTeamSeason
}

type DraftEdge = Omit<Edge, 'id' | 'type'>
const clamp = (v: number) => Math.max(50, Math.min(96, Math.round(v)))

function scoringAdvantage(t: CbbEdgeSide, o: CbbEdgeSide): DraftEdge | null {
  if (!(t.season.ppg > 80 && o.season.papg >= 75)) return null
  return {
    icon: '🔥',
    bet: `${t.abbr} — Scoring Advantage`,
    team: t.abbr,
    typeLabel: 'Offense',
    grade: t.season.ppg >= 85 && o.season.papg >= 80 ? 'A' : 'B',
    conf: clamp(58 + (t.season.ppg - 80) * 1.1 + (o.season.papg - 75) * 0.9),
    supporting: 2,
    line: `${t.abbr} ${t.season.ppg.toFixed(1)} pts/g`,
    altPlay: `${o.abbr} allows ${o.season.papg.toFixed(1)} pts/g`,
    analysis: `${t.name} scores ${t.season.ppg.toFixed(1)} per game against a ${o.name} defense giving up ${o.season.papg.toFixed(1)} — points should come easily.`,
    bullets: [`${t.abbr} ${t.season.ppg.toFixed(1)} pts/g vs ${o.abbr} allowing ${o.season.papg.toFixed(1)}`, `${t.abbr} shoots ${t.season.fgPct.toFixed(1)}% from the field`],
  }
}

function defensiveWall(t: CbbEdgeSide, o: CbbEdgeSide): DraftEdge | null {
  if (!(t.season.papg < 60 && t.season.games >= 3)) return null
  return {
    icon: '🛡️',
    bet: `${t.abbr} Defense — Defensive Wall`,
    team: t.abbr,
    typeLabel: 'Defense',
    grade: t.season.papg < 55 ? 'A' : 'B',
    conf: clamp(60 + (60 - t.season.papg) * 2 + (o.season.ppg < 70 ? 4 : 0)),
    supporting: 2,
    line: `${t.abbr} allows ${t.season.papg.toFixed(1)} pts/g`,
    altPlay: `${o.abbr} scores ${o.season.ppg.toFixed(1)} pts/g`,
    analysis: `${t.name} holds opponents to ${t.season.papg.toFixed(1)} points per game (${t.season.oppFgPct.toFixed(1)}% shooting against) — a slower, lower-scoring game is the likely script.`,
    bullets: [`${t.abbr} allows ${t.season.papg.toFixed(1)} pts/g`, `Opponents shoot ${t.season.oppFgPct.toFixed(1)}% vs ${t.abbr}`],
  }
}

function homeCourt(h: CbbEdgeSide, a: CbbEdgeSide, neutral: boolean): DraftEdge | null {
  if (neutral || h.season.homeWinPct === null || h.season.homeGames < 4 || !(h.season.homeWinPct > 80)) return null
  return {
    icon: '🏟',
    bet: `${h.abbr} — Home Court Advantage`,
    team: h.abbr,
    typeLabel: 'Situational',
    grade: h.season.homeWinPct >= 90 ? 'A' : 'B',
    conf: clamp(57 + (h.season.homeWinPct - 80) * 0.9 + (a.season.awayWinPct !== null ? (50 - a.season.awayWinPct) * 0.15 : 0)),
    supporting: 2,
    line: `${h.abbr} home win% ${h.season.homeWinPct.toFixed(0)}%`,
    altPlay: a.season.awayWinPct !== null ? `${a.abbr} road win% ${a.season.awayWinPct.toFixed(0)}%` : `${a.abbr} on the road`,
    analysis: `${h.name} wins ${h.season.homeWinPct.toFixed(0)}% of its home games (${h.season.homeGames} played). College crowds and travel make home courts matter.`,
    bullets: [`${h.abbr} ${h.season.homeWinPct.toFixed(0)}% at home`],
  }
}

function rankingAdvantage(t: CbbEdgeSide, o: CbbEdgeSide): DraftEdge | null {
  if (t.rank === null || o.rank !== null) return null
  return {
    icon: '🏅',
    bet: `${t.abbr} — Ranking Advantage`,
    team: t.abbr,
    typeLabel: 'Spread-ML',
    grade: t.rank <= 10 ? 'A' : 'B',
    conf: clamp(58 + (26 - t.rank) * 0.7 + (t.season.margin - o.season.margin) * 0.3),
    supporting: 2,
    line: `#${t.rank} ${t.name}`,
    altPlay: `${o.name} unranked`,
    analysis: `${t.name} is ranked #${t.rank} in the AP poll against an unranked ${o.name}${t.rank <= 10 ? ' — a top-10 team against an unranked opponent is a strong baseline edge' : ''}.`,
    bullets: [`#${t.rank} ${t.abbr} vs unranked ${o.abbr}`, `${t.abbr} margin ${t.season.margin > 0 ? '+' : ''}${t.season.margin.toFixed(1)} per game`],
  }
}

function recentForm(t: CbbEdgeSide, o: CbbEdgeSide): DraftEdge | null {
  if (t.season.winStreak < 5) return null
  return {
    icon: '📈',
    bet: `${t.abbr} — Recent Form`,
    team: t.abbr,
    typeLabel: 'Situational',
    grade: t.season.winStreak >= 8 ? 'A' : 'B',
    conf: clamp(56 + (t.season.winStreak - 5) * 3 + (o.season.last5L >= 3 ? 4 : 0)),
    supporting: 2,
    line: `${t.abbr} ${t.season.winStreak} straight wins`,
    altPlay: `${o.abbr} ${o.season.last5W}-${o.season.last5L} in last 5`,
    analysis: `${t.name} has won ${t.season.winStreak} in a row.`,
    bullets: [`${t.abbr} W${t.season.winStreak}`, `${o.abbr} ${o.season.last5W}-${o.season.last5L} L5`],
  }
}

function totalsEdge(a: CbbEdgeSide, h: CbbEdgeSide): DraftEdge | null {
  if (a.season.games < 3 || h.season.games < 3) return null
  const f = a.season.ppg + h.season.ppg
  const ag = a.season.papg + h.season.papg
  if (a.season.ppg >= 78 && h.season.ppg >= 78) {
    return { icon: '🎆', bet: `${a.abbr} @ ${h.abbr} — Shootout Profile`, typeLabel: 'Totals', grade: 'B', conf: clamp(56 + (f - 156) * 0.5), supporting: 2, line: `${f.toFixed(1)} combined pts/g`, altPlay: `${ag.toFixed(1)} combined pts allowed/g`, analysis: `Both offenses score 78+ per game (${a.season.ppg.toFixed(1)} and ${h.season.ppg.toFixed(1)}) — the profile of a high total.`, bullets: [`${a.abbr} ${a.season.ppg.toFixed(1)} / ${h.abbr} ${h.season.ppg.toFixed(1)} pts/g`] }
  }
  if (a.season.papg < 66 && h.season.papg < 66) {
    return { icon: '🧱', bet: `${a.abbr} @ ${h.abbr} — Defensive Struggle`, typeLabel: 'Totals', grade: 'B', conf: clamp(56 + (132 - ag) * 0.6), supporting: 2, line: `${ag.toFixed(1)} combined pts allowed/g`, altPlay: `${f.toFixed(1)} combined pts/g`, analysis: `Both defenses allow under 66 per game (${a.season.papg.toFixed(1)} and ${h.season.papg.toFixed(1)}), pointing toward a lower-scoring game.`, bullets: [`${a.abbr} allows ${a.season.papg.toFixed(1)} / ${h.abbr} allows ${h.season.papg.toFixed(1)}`] }
  }
  return null
}

export function generateCbbEdges(away: CbbEdgeSide, home: CbbEdgeSide, neutral: boolean): Edge[] {
  const drafts: DraftEdge[] = []
  const add = (d: DraftEdge | null) => d && drafts.push(d)
  add(scoringAdvantage(away, home))
  add(scoringAdvantage(home, away))
  add(defensiveWall(away, home))
  add(defensiveWall(home, away))
  add(homeCourt(home, away, neutral))
  add(rankingAdvantage(away, home))
  add(rankingAdvantage(home, away))
  add(recentForm(away, home))
  add(recentForm(home, away))
  add(totalsEdge(away, home))
  return drafts
    .sort((a, b) => b.conf - a.conf)
    .slice(0, 6)
    .map((d, i) => ({ ...d, id: i + 1, type: d.typeLabel.toLowerCase() }))
}

// ---------------------------------------------------------------------------
// Analysis aggregate
// ---------------------------------------------------------------------------

export interface CbbAnalysisData {
  matchup: CbbMatchup
  awaySeason: CbbTeamSeason
  homeSeason: CbbTeamSeason
  edges: Edge[]
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
  const edges = generateCbbEdges(
    { abbr: matchup.away.abbr, name: matchup.away.shortName, rank: matchup.away.rank, season: awaySeason },
    { abbr: matchup.home.abbr, name: matchup.home.shortName, rank: matchup.home.rank, season: homeSeason },
    matchup.neutral
  )
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
