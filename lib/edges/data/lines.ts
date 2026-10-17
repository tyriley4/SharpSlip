import { NFL_TEAM_DIVISIONS } from '@/lib/nfl/divisions'
import { getTeamLinedGames, type LinedGame } from '@/lib/odds/history'
import type { Sport } from '@/lib/sport/SportContext'

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

export type RoleKey = 'homeFav' | 'homeDog' | 'roadFav' | 'roadDog'

export interface TeamLineFacts {
  team: string
  lined: number
  ats: Rec
  su: Rec
  roles: Record<RoleKey, { ats: Rec; su: Rec }>
  vsStrong: { ats: Rec; su: Rec }
  vsWeak: { ats: Rec; su: Rec }
  /** College: games against opponents from the same conference. */
  conf: { ats: Rec; su: Rec }
  ou: { over: number; under: number; push: number }
  /** NFL schedule spots. */
  spots: { offBye: { ats: Rec; su: Rec }; shortWeek: { ats: Rec; su: Rec }; divisional: { ats: Rec; su: Rec } }
}

export interface LineFacts {
  away: TeamLineFacts | null
  home: TeamLineFacts | null
}

const MAX_NEW: Record<Sport, number> = { nfl: 18, mlb: 12, nba: 12, nhl: 12, cfb: 6, cbb: 6 }

function build(abbr: string, sport: Sport, list: LinedGame[], leaguePct: Record<string, number>, confOf: Record<string, string>): TeamLineFacts | null {
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
    conf: { ats: blank(), su: blank() },
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
    if (confOf[abbr] && confOf[abbr] === confOf[opp]) rec(out.conf)
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

export async function loadLineFacts(sport: Sport, away: string, home: string, season: number, leaguePct: Record<string, number>, confOf: Record<string, string> = {}): Promise<LineFacts> {
  const [a, h] = await Promise.all([getTeamLinedGames(sport, away, season, MAX_NEW[sport]).catch(() => null), getTeamLinedGames(sport, home, season, MAX_NEW[sport]).catch(() => null)])
  return { away: a ? build(away, sport, a, leaguePct, confOf) : null, home: h ? build(home, sport, h, leaguePct, confOf) : null }
}
