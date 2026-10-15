import { NFL_TEAM_DIVISIONS } from '@/lib/nfl/divisions'
import { getTeamLinedGames, type LinedGame } from '@/lib/odds/history'
import type { Sport } from '@/lib/sport/SportContext'
import { q } from '../evidenceFramework'
import { minimumsFor } from '../minimums'
import type { ModuleInput } from '../modules/shared'
import { subjectTeam } from '../modules/shared'
import type { Edge, GameContext, ModuleOutput } from '../types'

/**
 * Against-the-spread, straight-up and over/under records from real closing lines (the lines ESPN keeps for finished games),
 * split by the role the team plays tonight (home or road, favourite or underdog), the quality of the opponent, and for the
 * NFL the schedule spot (off a bye, short week, divisional). Only closing lines on file are used; nothing is estimated.
 */

export interface Rec {
  w: number
  l: number
  p: number
}

const blank = (): Rec => ({ w: 0, l: 0, p: 0 })
const add = (r: Rec, v: 1 | 0 | -1) => (v > 0 ? r.w++ : v < 0 ? r.l++ : r.p++)
const games = (r: Rec) => r.w + r.l

export type RoleKey = 'homeFav' | 'homeDog' | 'roadFav' | 'roadDog'

export interface TeamLineFacts {
  team: string
  lined: number
  ats: Rec
  su: Rec
  roles: Record<RoleKey, { ats: Rec; su: Rec }>
  vsStrong: { ats: Rec; su: Rec }
  vsWeak: { ats: Rec; su: Rec }
  ou: { over: number; under: number; push: number }
  /** NFL schedule spots. */
  spots: { offBye: { ats: Rec; su: Rec }; shortWeek: { ats: Rec; su: Rec }; divisional: { ats: Rec; su: Rec } }
}

export interface LineFacts {
  away: TeamLineFacts | null
  home: TeamLineFacts | null
}

const MAX_NEW: Record<Sport, number> = { nfl: 18, mlb: 12, nba: 12, nhl: 12, cfb: 6, cbb: 6 }

function build(abbr: string, sport: Sport, list: LinedGame[], leaguePct: Record<string, number>): TeamLineFacts | null {
  const rows = list.filter((g) => g.line && g.line.homeSpread !== null)
  if (rows.length === 0) return null
  const out: TeamLineFacts = {
    team: abbr,
    lined: rows.length,
    ats: blank(),
    su: blank(),
    roles: { homeFav: { ats: blank(), su: blank() }, homeDog: { ats: blank(), su: blank() }, roadFav: { ats: blank(), su: blank() }, roadDog: { ats: blank(), su: blank() } },
    vsStrong: { ats: blank(), su: blank() },
    vsWeak: { ats: blank(), su: blank() },
    ou: { over: 0, under: 0, push: 0 },
    spots: { offBye: { ats: blank(), su: blank() }, shortWeek: { ats: blank(), su: blank() }, divisional: { ats: blank(), su: blank() } },
  }
  const dates = list.map((g) => Date.parse(g.date)).sort((a, b) => a - b)
  for (const g of rows) {
    const home = g.home === abbr
    const us = home ? g.homeScore : g.awayScore
    const them = home ? g.awayScore : g.homeScore
    const opp = home ? g.away : g.home
    const ownSpread = home ? (g.line!.homeSpread as number) : -(g.line!.homeSpread as number)
    const cover: 1 | 0 | -1 = Math.sign(us - them + ownSpread) as 1 | 0 | -1
    const su: 1 | 0 | -1 = Math.sign(us - them) as 1 | 0 | -1
    const role: RoleKey = home ? (ownSpread < 0 ? 'homeFav' : 'homeDog') : ownSpread < 0 ? 'roadFav' : 'roadDog'
    const rec = (t: { ats: Rec; su: Rec }) => {
      add(t.ats, cover)
      add(t.su, su)
    }
    add(out.ats, cover)
    add(out.su, su)
    rec(out.roles[role])
    const oppPct = leaguePct[opp]
    if (oppPct !== undefined) rec(oppPct >= 0.5 ? out.vsStrong : out.vsWeak)
    const total = g.line!.total
    if (total != null) {
      const t = g.homeScore + g.awayScore
      if (t > total) out.ou.over++
      else if (t < total) out.ou.under++
      else out.ou.push++
    }
    if (sport === 'nfl') {
      const prev = dates.filter((d) => d < Date.parse(g.date)).pop()
      const rest = prev ? Math.round((Date.parse(g.date) - prev) / 86400000) : null
      if (rest !== null && rest >= 12) rec(out.spots.offBye)
      if (rest !== null && rest <= 5) rec(out.spots.shortWeek)
      if (NFL_TEAM_DIVISIONS[abbr] && NFL_TEAM_DIVISIONS[abbr] === NFL_TEAM_DIVISIONS[opp]) rec(out.spots.divisional)
    }
  }
  return out
}

export async function loadLineFacts(sport: Sport, away: string, home: string, season: number, leaguePct: Record<string, number>): Promise<LineFacts> {
  const [a, h] = await Promise.all([getTeamLinedGames(sport, away, season, MAX_NEW[sport]).catch(() => null), getTeamLinedGames(sport, home, season, MAX_NEW[sport]).catch(() => null)])
  return { away: a ? build(away, sport, a, leaguePct) : null, home: h ? build(home, sport, h, leaguePct) : null }
}

const recText = (r: Rec) => `${r.w}-${r.l}${r.p ? `-${r.p}` : ''}`

/** Tonight's role from the posted spread: favourite or underdog, home or road. */
function tonightRole(game: GameContext, team: string): RoleKey | null {
  const sp = game.odds?.spread
  const point = team === game.home ? sp?.home?.point : sp?.away?.point
  if (point === null || point === undefined) return null
  const home = team === game.home
  return home ? (point < 0 ? 'homeFav' : 'homeDog') : point < 0 ? 'roadFav' : 'roadDog'
}

const ROLE_TEXT: Record<RoleKey, string> = { homeFav: 'a home favorite', homeDog: 'a home underdog', roadFav: 'a road favorite', roadDog: 'a road underdog' }

/** Moneyline, spread and total: records in tonight's exact situation, from real closing lines. */
export function getLineEvidence({ outcome: o, game }: ModuleInput): ModuleOutput {
  const edges: Edge[] = []
  let conflicts = 0
  const facts = game.facts.lines
  if (!facts) return { edges, conflicts }
  const mins = minimumsFor(game)
  const need = mins.early ? 3 : 6

  if (o.type === 'total') {
    const over = o.direction !== 'under'
    const a = facts.away?.ou
    const h = facts.home?.ou
    if (a && h) {
      const n = a.over + a.under + h.over + h.under
      const hit = over ? a.over + h.over : a.under + h.under
      if (n >= need * 2 && (hit / n >= 0.62 || hit / n <= 0.38)) {
        if (hit / n >= 0.62) edges.push({ description: `The ${over ? 'over' : 'under'} is ${hit}-${n - hit} for ${game.away} and ${game.home} combined against closing totals this season (${game.away} ${over ? a.over : a.under}-${over ? a.under : a.over}, ${game.home} ${over ? h.over : h.under}-${over ? h.under : h.over})`, category: 'hit_rate', horizon: 'season', layer: 'statistical', relevanceScore: Math.min(1, 0.4 + (hit / n - 0.5) * 1.8), supportingData: 'Closing totals on file', weight: 0.12, quality: q(3, 2, 2, n >= 20 ? 2 : 1), sample: n, smallSample: n < 20 ? n : undefined })
        else conflicts++
      }
    }
    return { edges, conflicts }
  }

  const team = subjectTeam(o)
  const opp = o.team?.opponent
  if (!team || !opp) return { edges, conflicts }
  const mine = team === game.home ? facts.home : facts.away
  if (!mine) return { edges, conflicts }
  const role = tonightRole(game, team)
  const spread = o.type === 'spread'
  const pick = (t: { ats: Rec; su: Rec }) => (spread ? t.ats : t.su)
  const verb = (r: Rec) => (spread ? `${recText(r)} against the spread` : `${recText(r)} straight up`)

  // Tonight's role: favourite/underdog and home/road, from the posted line.
  if (role) {
    const r = pick(mine.roles[role])
    if (games(r) >= Math.min(need, 3) && (r.w / games(r) >= 0.6 || r.w / games(r) <= 0.34)) {
      if (r.w / games(r) >= 0.6) edges.push({ description: `${team} is ${verb(r)} as ${ROLE_TEXT[role]} this season — tonight's exact role${role === 'homeDog' || role === 'roadDog' ? ' (the market lists them as the underdog)' : ''}`, category: 'hit_rate', horizon: 'season', layer: 'statistical', relevanceScore: Math.min(1, 0.4 + (r.w / games(r) - 0.5) * 1.6), supportingData: `${mine.lined} games with closing lines on file`, weight: 0.18, quality: q(3, 3, 2, games(r) >= 8 ? 2 : 1), sample: games(r), smallSample: games(r) < 8 ? games(r) : undefined })
      else conflicts++
    }
  }
  // The opponent's quality tier.
  const oppPct = game.leagueWinPct[opp]
  if (oppPct !== undefined) {
    const strong = oppPct >= 0.5
    const r = pick(strong ? mine.vsStrong : mine.vsWeak)
    if (games(r) >= need && (r.w / games(r) >= 0.62 || r.w / games(r) <= 0.34)) {
      if (r.w / games(r) >= 0.62) edges.push({ description: `${team} is ${verb(r)} against teams ${strong ? 'at or above' : 'under'} .500 — tonight's opponent ${opp} is at ${oppPct.toFixed(3).replace(/^0/, '')}`, category: 'hit_rate', horizon: 'season', layer: 'statistical', relevanceScore: Math.min(1, 0.4 + (r.w / games(r) - 0.5) * 1.6), supportingData: 'Closing lines on file this season', weight: 0.16, quality: q(3, 3, 2, games(r) >= 8 ? 2 : 1), sample: games(r), smallSample: games(r) < 8 ? games(r) : undefined })
      else conflicts++
    }
  }
  // NFL schedule spots, only when tonight matches.
  if (game.sport === 'nfl') {
    const rest = game.rest[team]
    const spots: { key: 'offBye' | 'shortWeek' | 'divisional'; on: boolean; text: string }[] = [
      { key: 'offBye', on: rest !== null && rest !== undefined && rest >= 12, text: 'coming off a bye' },
      { key: 'shortWeek', on: rest !== null && rest !== undefined && rest <= 5, text: 'on a short week' },
      { key: 'divisional', on: game.flags.divisional, text: 'in divisional games' },
    ]
    for (const s of spots) {
      if (!s.on) continue
      const r = pick(mine.spots[s.key])
      if (games(r) >= 2 && r.w / games(r) >= 0.67) edges.push({ description: `${team} is ${verb(r)} ${s.text} — tonight's situation`, category: 'situational', horizon: 'tonight', layer: 'situational', relevanceScore: 0.5, supportingData: 'Closing lines on file', weight: 0.08, quality: q(3, 3, 2, 0), sample: games(r), smallSample: games(r) })
    }
  }
  return { edges, conflicts }
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0)
const SCALE: Record<string, number> = { mlb: 0.6, nhl: 0.5, nfl: 2.5, cfb: 3, nba: 3, cbb: 3.5 }

/** Recent offense against recent defense: what each side has been scoring and allowing lately, set against its season. */
export function getScoringMatchup({ outcome: o, game }: ModuleInput): ModuleOutput {
  const edges: Edge[] = []
  let conflicts = 0
  if (o.type === 'player_prop') return { edges, conflicts }
  const scale = SCALE[game.sport] ?? 1
  const recent = (abbr: string, n: number) => (game.results[abbr] ?? []).slice(0, n)
  const seasonOf = (abbr: string) => {
    const g = game.results[abbr] ?? []
    if (!g.length) return []
    const s = Math.max(...g.map((x) => x.season))
    return g.filter((x) => x.season === s)
  }
  const proj = (offense: string, defense: string) => {
    const n = minimumsFor(game).early ? 3 : 5
    const o5 = recent(offense, 5)
    const d5 = recent(defense, 5)
    if (o5.length < n || d5.length < n) return null
    const scored = mean(o5.map((g) => g.us))
    const allowed = mean(d5.map((g) => g.them))
    const base = mean(seasonOf(offense).map((g) => g.us))
    return { scored, allowed, base, expected: (scored + allowed) / 2, n: Math.min(o5.length, d5.length) }
  }

  if (o.type === 'total' && o.threshold !== undefined) {
    const a = proj(game.away, game.home)
    const h = proj(game.home, game.away)
    if (a && h) {
      const combined = a.expected + h.expected
      const gap = combined - o.threshold
      const over = o.direction !== 'under'
      if ((over && gap >= scale) || (!over && gap <= -scale)) {
        edges.push({ description: `Recent offense against recent defense: ${game.away} has scored ${a.scored.toFixed(1)} per game over its last ${a.n} while ${game.home} has allowed ${h.allowed.toFixed(1)}; ${game.home} scored ${h.scored.toFixed(1)} against ${game.away}'s ${a.allowed.toFixed(1)} allowed — a ${combined.toFixed(1)}-point projection against the ${o.threshold} line`, category: 'recent_form', horizon: 'last7', layer: 'statistical', relevanceScore: Math.min(1, 0.45 + Math.abs(gap) / (scale * 5)), supportingData: 'Last five games for each side', weight: 0.14, ageDays: 5, quality: q(3, 3, 3, a.n >= 5 ? 1 : 0), sample: a.n, smallSample: a.n < 5 ? a.n : undefined })
      } else if ((over && gap <= -scale) || (!over && gap >= scale)) conflicts++
    }
    return { edges, conflicts }
  }
  const team = subjectTeam(o)
  const opp = o.team?.opponent
  if (!team || !opp) return { edges, conflicts }
  const p = proj(team, opp)
  if (p && p.base > 0) {
    const lift = p.expected - p.base
    if (lift >= scale * 0.6 && p.scored >= p.base) {
      edges.push({ description: `${team} has averaged ${p.scored.toFixed(1)} points over its last ${p.n} games against ${opp}'s ${p.allowed.toFixed(1)} allowed over theirs — a favorable scoring environment (${p.expected.toFixed(1)} projected against a ${p.base.toFixed(1)} season average)`, category: 'recent_form', horizon: 'last7', layer: 'statistical', relevanceScore: Math.min(1, 0.45 + lift / (scale * 4)), supportingData: 'Last five games for each side', weight: 0.12, ageDays: 5, quality: q(3, 3, 3, p.n >= 5 ? 1 : 0), sample: p.n, smallSample: p.n < 5 ? p.n : undefined })
    } else if (lift <= -scale * 0.8) conflicts++
  }
  return { edges, conflicts }
}
