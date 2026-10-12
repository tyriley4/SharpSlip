import type { Edge } from '@/data/breakdown/types'

export interface EdgeNbaTeamInput {
  abbr: string
  pts: number
  oppPts: number
  fg3Pct: number
  tov: number
  oppTov: number
  homeWinPct: number | null
  awayWinPct: number | null
  last10Wins: number
  last10Losses: number
  daysRest: number | null
  backToBack: boolean
}

export interface NBAEdgeContext {
  away: EdgeNbaTeamInput
  home: EdgeNbaTeamInput
}

type DraftEdge = Omit<Edge, 'id' | 'type'>

function clampConf(v: number): number {
  return Math.max(50, Math.min(96, Math.round(v)))
}

function scoringAdvantage(team: EdgeNbaTeamInput, opp: EdgeNbaTeamInput): DraftEdge | null {
  if (!(team.pts > 118 && opp.oppPts >= 115)) return null
  const grade = team.pts >= 120 && opp.oppPts >= 117 ? 'A' : 'B'
  return {
    icon: '🔥',
    bet: `${team.abbr} — Scoring Advantage`,
    team: team.abbr,
    typeLabel: 'Offense',
    grade,
    conf: clampConf(55 + (team.pts - 118) * 1.5 + (opp.oppPts - 115) * 1.5),
    supporting: 2,
    line: `${team.abbr} ${team.pts.toFixed(1)} PPG`,
    altPlay: `${opp.abbr} allows ${opp.oppPts.toFixed(1)} PPG`,
    analysis: `${team.abbr} averages ${team.pts.toFixed(1)} points per game against a ${opp.abbr} defense allowing ${opp.oppPts.toFixed(1)}/g.`,
    bullets: [`${team.abbr} ${team.pts.toFixed(1)} PPG vs ${opp.abbr} allowing ${opp.oppPts.toFixed(1)} PPG`],
  }
}

function defensiveWall(team: EdgeNbaTeamInput, opp: EdgeNbaTeamInput): DraftEdge | null {
  if (!(team.oppPts < 108 && opp.pts < 112)) return null
  const grade = team.oppPts < 105 && opp.pts < 105 ? 'A' : 'B'
  return {
    icon: '🛡️',
    bet: `${team.abbr} — Defensive Wall`,
    team: team.abbr,
    typeLabel: 'Defense',
    grade,
    conf: clampConf(55 + (108 - team.oppPts) * 1.5 + (112 - opp.pts) * 1.5),
    supporting: 2,
    line: `${team.abbr} allows ${team.oppPts.toFixed(1)} PPG`,
    altPlay: `${opp.abbr} scores ${opp.pts.toFixed(1)} PPG`,
    analysis: `${team.abbr} allows just ${team.oppPts.toFixed(1)} points per game against a ${opp.abbr} offense scoring ${opp.pts.toFixed(1)}/g — historical data favors a lower-scoring game.`,
    bullets: [`${team.abbr} allows ${team.oppPts.toFixed(1)} PPG vs ${opp.abbr} scoring ${opp.pts.toFixed(1)} PPG`],
  }
}

function turnoverFactory(team: EdgeNbaTeamInput, opp: EdgeNbaTeamInput): DraftEdge | null {
  if (!(team.oppTov >= 16 && opp.tov >= 15)) return null
  return {
    icon: '🔒',
    bet: `${team.abbr} — Turnover Factory`,
    team: team.abbr,
    typeLabel: 'Defense',
    grade: 'B',
    conf: clampConf(55 + (team.oppTov - 16) * 3 + (opp.tov - 15) * 3),
    supporting: 2,
    line: `${team.abbr} forces ${team.oppTov.toFixed(1)} TOs/g`,
    altPlay: `${opp.abbr} averages ${opp.tov.toFixed(1)} TOs/g`,
    analysis: `${team.abbr} forces ${team.oppTov.toFixed(1)} turnovers per game and faces a ${opp.abbr} offense that gives it away ${opp.tov.toFixed(1)} times/g.`,
    bullets: [`${team.abbr} forces ${team.oppTov.toFixed(1)} TOs/g vs ${opp.abbr} averaging ${opp.tov.toFixed(1)} TOs/g`],
  }
}

function restAdvantage(team: EdgeNbaTeamInput, opp: EdgeNbaTeamInput): DraftEdge | null {
  if (!(team.daysRest !== null && team.daysRest >= 2 && opp.backToBack)) return null
  return {
    icon: '😴',
    bet: `${team.abbr} — Rest Advantage`,
    team: team.abbr,
    typeLabel: 'Situational',
    grade: 'A',
    conf: clampConf(65 + (team.daysRest ?? 2) * 3),
    supporting: 2,
    line: `${team.abbr} on ${team.daysRest}+ days rest`,
    altPlay: `${opp.abbr} on a back-to-back`,
    analysis: `${team.abbr} enters well-rested while ${opp.abbr} is playing the second night of a back-to-back — a significant physical edge.`,
    bullets: [`${team.abbr} rested ${team.daysRest}+ days vs ${opp.abbr} on zero days rest`],
  }
}

function homeCourt(home: EdgeNbaTeamInput, away: EdgeNbaTeamInput): DraftEdge | null {
  if (home.homeWinPct === null || away.awayWinPct === null) return null
  if (!(home.homeWinPct > 65 && away.awayWinPct < 40)) return null
  return {
    icon: '🏟',
    bet: `${home.abbr} — Home Court`,
    team: home.abbr,
    typeLabel: 'Situational',
    grade: 'B',
    conf: clampConf(55 + (home.homeWinPct - 65) * 1.2 + (40 - away.awayWinPct) * 1.2),
    supporting: 2,
    line: `${home.abbr} home win% ${home.homeWinPct.toFixed(0)}%`,
    altPlay: `${away.abbr} road win% ${away.awayWinPct.toFixed(0)}%`,
    analysis: `${home.abbr} wins ${home.homeWinPct.toFixed(0)}% at home while ${away.abbr} has struggled on the road at ${away.awayWinPct.toFixed(0)}%.`,
    bullets: [`${home.abbr} home win% ${home.homeWinPct.toFixed(0)}% vs ${away.abbr} road win% ${away.awayWinPct.toFixed(0)}%`],
  }
}

function recentForm(team: EdgeNbaTeamInput, opp: EdgeNbaTeamInput): DraftEdge | null {
  if (!(team.last10Wins >= 7 && opp.last10Losses >= 7)) return null
  const grade = team.last10Wins >= 8 && opp.last10Losses >= 8 ? 'A' : 'B'
  return {
    icon: '📈',
    bet: `${team.abbr} — Recent Form`,
    team: team.abbr,
    typeLabel: 'Situational',
    grade,
    conf: clampConf(55 + (team.last10Wins - 7) * 8 + (opp.last10Losses - 7) * 8),
    supporting: 2,
    line: `${team.abbr} ${team.last10Wins}-${10 - team.last10Wins} L10`,
    altPlay: `${opp.abbr} ${10 - opp.last10Losses}-${opp.last10Losses} L10`,
    analysis: `${team.abbr} is ${team.last10Wins}-${10 - team.last10Wins} over their last 10 while ${opp.abbr} has gone just ${10 - opp.last10Losses}-${opp.last10Losses}.`,
    bullets: [`${team.abbr} ${team.last10Wins}-${10 - team.last10Wins} L10 vs ${opp.abbr} ${10 - opp.last10Losses}-${opp.last10Losses} L10`],
  }
}

/** Generates real-stat-driven NBA edges (max 6, sorted by confidence). Omits pace/points-in-paint-based rules that need play-by-play-derived stats not in the base/advanced team stat endpoints. */
export function generateNBAEdges(ctx: NBAEdgeContext): Edge[] {
  const drafts: DraftEdge[] = []

  const awayScoring = scoringAdvantage(ctx.away, ctx.home)
  if (awayScoring) drafts.push(awayScoring)
  const homeScoring = scoringAdvantage(ctx.home, ctx.away)
  if (homeScoring) drafts.push(homeScoring)

  const awayDef = defensiveWall(ctx.away, ctx.home)
  if (awayDef) drafts.push(awayDef)
  const homeDef = defensiveWall(ctx.home, ctx.away)
  if (homeDef) drafts.push(homeDef)

  const awayTO = turnoverFactory(ctx.away, ctx.home)
  if (awayTO) drafts.push(awayTO)
  const homeTO = turnoverFactory(ctx.home, ctx.away)
  if (homeTO) drafts.push(homeTO)

  const awayRest = restAdvantage(ctx.away, ctx.home)
  if (awayRest) drafts.push(awayRest)
  const homeRest = restAdvantage(ctx.home, ctx.away)
  if (homeRest) drafts.push(homeRest)

  const hc = homeCourt(ctx.home, ctx.away)
  if (hc) drafts.push(hc)

  const awayForm = recentForm(ctx.away, ctx.home)
  if (awayForm) drafts.push(awayForm)
  const homeForm = recentForm(ctx.home, ctx.away)
  if (homeForm) drafts.push(homeForm)

  const sorted = drafts.sort((a, b) => b.conf - a.conf).slice(0, 6)
  return sorted.map((d, i) => ({ ...d, id: i + 1, type: d.typeLabel.toLowerCase() }))
}

export function hasAnyEdge(ctx: NBAEdgeContext): boolean {
  return generateNBAEdges(ctx).length > 0
}
