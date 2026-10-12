import { getTeamSchedule } from '@/lib/espn/api'
import { cbbAts, cbbOu, getCbbAnalysis, getCbbTeamSeason, r1, type CbbMatchup, type CbbPlayerSeason, type CbbTeamSeason } from './engine'
import { CBB_LEAGUE } from './box'

const pct1 = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0)

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

export interface CbbBettingLine {
  label: string
  wins: number
  losses: number
  pct: number
}

export interface CbbSummaryCard {
  abbr: string
  record: { wins: number; losses: number; pct: number }
  form: ('W' | 'L')[]
  offense: { ppg: number; fgPct: number; tpPct: number; ftPct: number; astPg: number; toPg: number }
  defense: { papg: number; oppFgPct: number; oppTpPct: number; rebPg: number; stlPg: number; blkPg: number }
  last5: { date: string; opp: string; result: 'W' | 'L'; score: string; home: boolean }[]
  extras: { label: string; value: string }[]
  betting: { moneyline: CbbBettingLine; ats: CbbBettingLine; overUnder: CbbBettingLine; last5OverUnder: CbbBettingLine; home: CbbBettingLine; away: CbbBettingLine; note: string } | null
}

export interface CbbSummaryData {
  away: CbbSummaryCard | null
  home: CbbSummaryCard | null
  note: string | null
}

const line = (label: string, w: number, l: number): CbbBettingLine => ({ label, wins: w, losses: l, pct: pct1(w, w + l) })

function summaryCard(s: CbbTeamSeason): CbbSummaryCard | null {
  if (s.games === 0) return null
  const ats = cbbAts(s.boxes)
  const ou = cbbOu(s.boxes)
  const l5 = cbbOu(s.boxes.slice(-5))
  const home = s.boxes.filter((b) => b.home && !b.neutral)
  const away = s.boxes.filter((b) => !b.home && !b.neutral)
  const rankedAts = cbbAts(s.boxes.filter((b) => b.oppRank !== null))
  return {
    abbr: s.abbr,
    record: { wins: s.wins, losses: s.losses, pct: pct1(s.wins, s.games) },
    form: s.boxes.slice(-10).map((b) => b.result),
    offense: { ppg: s.ppg, fgPct: s.fgPct, tpPct: s.tpPct, ftPct: s.ftPct, astPg: s.astPg, toPg: s.toPg },
    defense: { papg: s.papg, oppFgPct: s.oppFgPct, oppTpPct: s.oppTpPct, rebPg: s.rebPg, stlPg: s.stlPg, blkPg: s.blkPg },
    last5: [...s.boxes].reverse().slice(0, 5).map((b) => ({ date: b.date.slice(0, 10), opp: `${b.oppRank !== null ? `#${b.oppRank} ` : ''}${b.oppAbbr}`, result: b.result, score: `${b.us}-${b.them}`, home: b.home })),
    extras: [
      { label: 'Conference', value: `${s.conf.w}-${s.conf.l}` },
      { label: 'vs Ranked', value: s.vsRanked.w + s.vsRanked.l > 0 ? `${s.vsRanked.w}-${s.vsRanked.l}` : 'None' },
      { label: 'Close games (≤5)', value: `${s.close.w}-${s.close.l}` },
      { label: 'ATS vs Ranked', value: rankedAts.total > 0 ? `${rankedAts.w}-${rankedAts.l}${rankedAts.p ? `-${rankedAts.p}` : ''}` : '—' },
    ],
    betting: {
      moneyline: line(`${s.abbr} ML`, s.wins, s.losses),
      ats: line(`${s.abbr} ATS`, ats.w, ats.l),
      overUnder: line(`${s.abbr} O/U`, ou.o, ou.u),
      last5OverUnder: line(`${s.abbr} L5 O/U`, l5.o, l5.u),
      home: line(`${s.abbr} Home`, home.filter((b) => b.result === 'W').length, home.filter((b) => b.result === 'L').length),
      away: line(`${s.abbr} Away`, away.filter((b) => b.result === 'W').length, away.filter((b) => b.result === 'L').length),
      note: `ATS and Over/Under use the DraftKings closing line ESPN recorded (${ats.total} of ${s.games} games have one; pushes excluded). Neutral-site games are left out of home/away.`,
    },
  }
}

export async function getCbbSummaryTabData(gameId: string): Promise<CbbSummaryData | null> {
  const data = await getCbbAnalysis(gameId)
  if (!data) return null
  return { away: summaryCard(data.awaySeason), home: summaryCard(data.homeSeason), note: data.priorSeasonNote }
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

export interface CbbScorer {
  id: string
  name: string
  games: number
  mpg: number
  ppg: number
  last5Ppg: number | null
  fgPct: number
  tpPct: number
  tpmPg: number
  hot: boolean
  /** A "points over X" mark at his season average, with the real hit rate against it. */
  propLine: { line: number; hits: number; games: number }
}

export interface CbbScoringTeam {
  abbr: string
  profile: { ppg: number; fgPct: number; tpPct: number; ftPct: number; tpaPg: number; paintPg: number; pace: number; offEff: number }
  scorers: CbbScorer[]
}

export interface CbbScoringData {
  away: CbbScoringTeam | null
  home: CbbScoringTeam | null
  /** How each offense stacks up against the other team's defense. */
  matchups: { label: string; away: string; home: string; edge: 'away' | 'home' | 'even'; note: string }[]
  note: string | null
}

function scorer(p: CbbPlayerSeason): CbbScorer {
  const mark = Math.max(4.5, Math.floor(p.ppg) + 0.5)
  return {
    id: p.id, name: p.name, games: p.games, mpg: p.mpg, ppg: p.ppg, last5Ppg: p.last5Ppg, fgPct: p.fgPct, tpPct: p.tpPct, tpmPg: p.tpmPg, hot: p.hot,
    propLine: { line: mark, hits: p.ptsLog.filter((x) => x > mark).length, games: p.ptsLog.length },
  }
}

function scoringTeam(s: CbbTeamSeason): CbbScoringTeam | null {
  if (s.games === 0) return null
  return {
    abbr: s.abbr,
    profile: { ppg: s.ppg, fgPct: s.fgPct, tpPct: s.tpPct, ftPct: s.ftPct, tpaPg: s.tpaPg, paintPg: s.paintPg, pace: s.pace, offEff: s.offEff },
    scorers: s.players.slice(0, 5).map(scorer),
  }
}

export async function getCbbScoringTabData(gameId: string): Promise<CbbScoringData | null> {
  const data = await getCbbAnalysis(gameId)
  if (!data) return null
  const a = data.awaySeason
  const h = data.homeSeason
  const m: CbbScoringData['matchups'] = []
  if (a.games > 0 && h.games > 0) {
    const row = (label: string, av: number, hv: number, higherBetter: boolean, note: string, fmt: (x: number) => string = (x) => x.toFixed(1)) => {
      const diff = av - hv
      m.push({ label, away: fmt(av), home: fmt(hv), edge: Math.abs(diff) < 0.5 ? 'even' : (diff > 0) === higherBetter ? 'away' : 'home', note })
    }
    row(`${a.abbr} scoring vs ${h.abbr} defense`, a.ppg, h.papg, true, `${a.abbr} scores ${a.ppg.toFixed(1)}; ${h.abbr} allows ${h.papg.toFixed(1)}`)
    row(`${h.abbr} scoring vs ${a.abbr} defense`, h.ppg, a.papg, false, `${h.abbr} scores ${h.ppg.toFixed(1)}; ${a.abbr} allows ${a.papg.toFixed(1)}`)
    row('Pace (possessions / game)', a.pace, h.pace, true, 'Faster teams create more scoring chances for both sides')
    row('Three-point rate allowed', a.oppTpPct, h.tpPct, true, `${a.abbr} lets opponents hit ${a.oppTpPct.toFixed(1)}%; ${h.abbr} shoots ${h.tpPct.toFixed(1)}%`)
  }
  return { away: scoringTeam(a), home: scoringTeam(h), matchups: m, note: data.priorSeasonNote }
}

// ---------------------------------------------------------------------------
// Defense
// ---------------------------------------------------------------------------

export interface CbbDefenseTeam {
  abbr: string
  papg: number
  defEff: number
  oppFgPct: number
  oppTpPct: number
  oppRebPg: number
  stlPg: number
  blkPg: number
  toForcedPg: number
  vsRanked: string
  grade: string
  /** Best defensive scorers... defenders by blocks + steals. */
  disruptors: { name: string; spg: number; bpg: number; rpg: number }[]
}

export interface CbbDefenseData {
  away: CbbDefenseTeam | null
  home: CbbDefenseTeam | null
  note: string | null
}

/** Letter grade from points allowed per 100 possessions (D-I average is roughly 104-105). */
function defGrade(eff: number): string {
  return eff < 92 ? 'A+' : eff < 96 ? 'A' : eff < 99 ? 'B+' : eff < 102 ? 'B' : eff < 105 ? 'C+' : eff < 108 ? 'C' : 'D'
}

function defenseTeam(s: CbbTeamSeason): CbbDefenseTeam | null {
  if (s.games === 0) return null
  const forced = s.boxes.reduce((t, b) => t + b.opp.to, 0) / s.games
  return {
    abbr: s.abbr,
    papg: s.papg,
    defEff: s.defEff,
    oppFgPct: s.oppFgPct,
    oppTpPct: s.oppTpPct,
    oppRebPg: s.oppRebPg,
    stlPg: s.stlPg,
    blkPg: s.blkPg,
    toForcedPg: r1(forced),
    vsRanked: s.vsRanked.w + s.vsRanked.l > 0 ? `${s.vsRanked.w}-${s.vsRanked.l}` : 'No ranked opponents yet',
    grade: defGrade(s.defEff),
    disruptors: [...s.players]
      .filter((p) => p.games >= 3)
      .sort((x, y) => y.spg + y.bpg * 1.2 - (x.spg + x.bpg * 1.2))
      .slice(0, 3)
      .map((p) => ({ name: p.name, spg: p.spg, bpg: p.bpg, rpg: p.rpg })),
  }
}

export async function getCbbDefenseTabData(gameId: string): Promise<CbbDefenseData | null> {
  const data = await getCbbAnalysis(gameId)
  if (!data) return null
  return { away: defenseTeam(data.awaySeason), home: defenseTeam(data.homeSeason), note: data.priorSeasonNote }
}

// ---------------------------------------------------------------------------
// Arena
// ---------------------------------------------------------------------------

export interface CbbArenaData {
  arena: { name: string; city: string | null; capacity: number | null; neutral: boolean }
  homeEdge: { homeWinPct: number | null; record: string | null; ats: { wins: number; losses: number; pct: number } | null; overUnder: { wins: number; losses: number; pct: number } | null; avgMargin: number | null }
  atmosphere: { rating: number; label: string; note: string }
  history: { season: number; homeWins: number; homeLosses: number; avgTotalPoints: number }[]
  betImpact: { title: string; detail: string; affects: string[] }[]
  note: string | null
}

function atmosphere(capacity: number | null, homeWinPct: number | null): CbbArenaData['atmosphere'] {
  const cap = capacity ? Math.min(1, capacity / 22000) : 0.45
  const win = homeWinPct !== null ? homeWinPct / 100 : 0.55
  const rating = Math.max(1, Math.min(10, Math.round((cap * 4 + win * 6) * 10) / 10))
  const label = rating >= 8.5 ? 'Electric' : rating >= 7 ? 'Intimidating' : rating >= 5.5 ? 'Loud' : rating >= 4 ? 'Solid' : 'Quiet'
  const parts: string[] = []
  if (capacity) parts.push(`${capacity.toLocaleString('en-US')} seats`)
  if (homeWinPct !== null) parts.push(`${homeWinPct.toFixed(0)}% home win rate`)
  return { rating, label, note: parts.length ? `Rating blends arena size and home results: ${parts.join(' and ')}.` : 'Capacity and home results will refine this rating as the season goes on.' }
}

export async function getCbbArenaTabData(gameId: string): Promise<CbbArenaData | null> {
  const data = await getCbbAnalysis(gameId)
  if (!data) return null
  const { matchup: m, homeSeason: home } = data
  const homeBoxes = home.boxes.filter((b) => b.home && !b.neutral)
  const seasons = await Promise.all([1, 2, 3].map((d) => getTeamSchedule('basketball', CBB_LEAGUE, m.home.id, (home.season || m.season) - d).catch(() => null)))
  const history = seasons
    .map((sched, i) => {
      const games = (sched ?? []).filter((g) => g.state === 'post' && g.home && !g.neutralSite && (g.seasonType === null || g.seasonType === 2) && g.us !== null && g.them !== null)
      if (games.length === 0) return null
      const w = games.filter((g) => g.result === 'W').length
      return { season: (home.season || m.season) - (i + 1), homeWins: w, homeLosses: games.length - w, avgTotalPoints: r1(games.reduce((t, g) => t + (g.us ?? 0) + (g.them ?? 0), 0) / games.length) }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
  const ats = cbbAts(homeBoxes)
  const ou = cbbOu(homeBoxes)
  const hp = home.homeWinPct
  const impact: CbbArenaData['betImpact'] = []
  if (!m.neutral && hp !== null && home.homeGames >= 4 && hp >= 80) impact.push({ title: 'Strong Home Court', detail: `${m.home.shortName} wins ${hp.toFixed(0)}% of its home games${m.venue.capacity ? ` in front of ${m.venue.capacity.toLocaleString('en-US')} fans` : ''}.`, affects: ['Moneyline', 'Spread'] })
  if (m.neutral) impact.push({ title: 'Neutral Site', detail: 'No true home team here, so the home/away splits above carry less weight and the spread leans on team quality.', affects: ['Spread', 'Moneyline'] })
  if (m.venue.capacity && m.venue.capacity >= 15000) impact.push({ title: 'Big Arena', detail: `${m.venue.arena} holds ${m.venue.capacity.toLocaleString('en-US')} — larger, louder crowds tend to lift the home team's free-throw and turnover luck.`, affects: ['Spread'] })
  if (history.length > 0) {
    const avg = history.reduce((t, h) => t + h.avgTotalPoints, 0) / history.length
    impact.push({ title: 'Scoring History', detail: `Home games for ${m.home.shortName} over the last ${history.length} season${history.length === 1 ? '' : 's'} averaged ${avg.toFixed(1)} total points.`, affects: ['Totals'] })
  }
  return {
    arena: { name: m.venue.arena, city: m.venue.city ? `${m.venue.city}${m.venue.state ? `, ${m.venue.state}` : ''}` : null, capacity: m.venue.capacity, neutral: m.neutral },
    homeEdge: {
      homeWinPct: hp,
      record: home.homeGames > 0 ? `${homeBoxes.filter((b) => b.result === 'W').length}-${homeBoxes.filter((b) => b.result === 'L').length}` : null,
      ats: ats.total > 0 ? { wins: ats.w, losses: ats.l, pct: pct1(ats.w, ats.w + ats.l) } : null,
      overUnder: ou.total > 0 ? { wins: ou.o, losses: ou.u, pct: pct1(ou.o, ou.o + ou.u) } : null,
      avgMargin: homeBoxes.length > 0 ? r1(homeBoxes.reduce((t, b) => t + (b.us - b.them), 0) / homeBoxes.length) : null,
    },
    atmosphere: atmosphere(m.venue.capacity, hp),
    history,
    betImpact: impact,
    note: data.priorSeasonNote,
  }
}

export type { CbbMatchup }
