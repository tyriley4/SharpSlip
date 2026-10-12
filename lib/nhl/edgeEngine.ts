import type { Edge } from '@/data/breakdown/types'

export interface EdgeNhlTeamInput {
  abbr: string
  goalsForPerGame: number
  shootingPct: number // fraction, e.g. 0.11 for 11%
  ppPct: number // fraction, e.g. 0.24 for 24%
  pkPct: number // fraction
  homeWinPct: number | null // 0-100
  awayWinPct: number | null // 0-100
  last10Wins: number
  last10Losses: number
  daysRest: number | null
  backToBack: boolean
  goalieSavePct: number | null // fraction, e.g. 0.920
  goalieGaa: number | null
}

export interface NHLEdgeContext {
  away: EdgeNhlTeamInput
  home: EdgeNhlTeamInput
}

type DraftEdge = Omit<Edge, 'id' | 'type'>

function clampConf(v: number): number {
  return Math.max(50, Math.min(96, Math.round(v)))
}

function pct(v: number): string {
  return `${(v * 100).toFixed(1)}%`
}

function eliteGoalieAdvantage(team: EdgeNhlTeamInput, opp: EdgeNhlTeamInput): DraftEdge | null {
  if (team.goalieSavePct === null) return null
  if (!(team.goalieSavePct > 0.92 && opp.shootingPct > 0.11)) return null
  const grade = team.goalieSavePct > 0.93 ? 'A' : 'B'
  return {
    icon: '🥅',
    bet: `${team.abbr} — Elite Goalie Advantage`,
    team: team.abbr,
    typeLabel: 'Goalie',
    grade,
    conf: clampConf(55 + (team.goalieSavePct - 0.92) * 500 + (opp.shootingPct - 0.11) * 300),
    supporting: 2,
    line: `${team.abbr} goalie ${pct(team.goalieSavePct)} SV%`,
    altPlay: `${opp.abbr} shooting ${pct(opp.shootingPct)}`,
    analysis: `${team.abbr}'s goalie is stopping ${pct(team.goalieSavePct)} of shots against a ${opp.abbr} attack shooting ${pct(opp.shootingPct)} — a matchup that has historically supported the goalie's side.`,
    bullets: [`${team.abbr} goalie ${pct(team.goalieSavePct)} SV% vs ${opp.abbr} shooting ${pct(opp.shootingPct)}`],
  }
}

function strugglingNetminder(team: EdgeNhlTeamInput, opp: EdgeNhlTeamInput): DraftEdge | null {
  if (team.goalieGaa === null) return null
  if (!(team.goalieGaa > 3.2 && opp.goalsForPerGame >= 3.5)) return null
  return {
    icon: '🚨',
    bet: `${opp.abbr} — Struggling Netminder`,
    team: opp.abbr,
    typeLabel: 'Goalie',
    grade: 'B',
    conf: clampConf(55 + (team.goalieGaa - 3.2) * 15 + (opp.goalsForPerGame - 3.5) * 8),
    supporting: 2,
    line: `${team.abbr} goalie ${team.goalieGaa.toFixed(2)} GAA`,
    altPlay: `${opp.abbr} scores ${opp.goalsForPerGame.toFixed(1)} GPG`,
    analysis: `${team.abbr}'s goalie is allowing ${team.goalieGaa.toFixed(2)} goals per game against a ${opp.abbr} offense averaging ${opp.goalsForPerGame.toFixed(1)}/g — this trend supports the case for the offense.`,
    bullets: [`${team.abbr} goalie ${team.goalieGaa.toFixed(2)} GAA vs ${opp.abbr} scoring ${opp.goalsForPerGame.toFixed(1)} GPG`],
  }
}

function powerPlayAdvantage(team: EdgeNhlTeamInput, opp: EdgeNhlTeamInput): DraftEdge | null {
  if (!(team.ppPct > 0.24 && opp.pkPct < 0.76)) return null
  const grade = team.ppPct > 0.27 ? 'A' : 'B'
  return {
    icon: '⚡',
    bet: `${team.abbr} — Power Play Advantage`,
    team: team.abbr,
    typeLabel: 'Special Teams',
    grade,
    conf: clampConf(55 + (team.ppPct - 0.24) * 300 + (0.76 - opp.pkPct) * 200),
    supporting: 2,
    line: `${team.abbr} PP ${pct(team.ppPct)}`,
    altPlay: `${opp.abbr} PK ${pct(opp.pkPct)}`,
    analysis: `${team.abbr}'s power play converts at ${pct(team.ppPct)} against a ${opp.abbr} penalty kill allowing goals at ${pct(1 - opp.pkPct)}.`,
    bullets: [`${team.abbr} PP ${pct(team.ppPct)} vs ${opp.abbr} PK ${pct(opp.pkPct)}`],
  }
}

function highEventGame(away: EdgeNhlTeamInput, home: EdgeNhlTeamInput): DraftEdge | null {
  if (!(away.goalsForPerGame >= 3.5 && home.goalsForPerGame >= 3.5 && away.ppPct > 0.2 && home.ppPct > 0.2)) return null
  return {
    icon: '🎆',
    bet: 'High Event Game',
    team: `${away.abbr}/${home.abbr}`,
    typeLabel: 'Totals',
    grade: 'B',
    conf: clampConf(55 + (away.goalsForPerGame - 3.5) * 8 + (home.goalsForPerGame - 3.5) * 8),
    supporting: 2,
    line: `${away.abbr} ${away.goalsForPerGame.toFixed(1)} GPG / ${home.abbr} ${home.goalsForPerGame.toFixed(1)} GPG`,
    altPlay: 'Key trend: high-scoring pace',
    analysis: `Both ${away.abbr} (${away.goalsForPerGame.toFixed(1)} GPG) and ${home.abbr} (${home.goalsForPerGame.toFixed(1)} GPG) score at a high clip with strong power plays — matchups like this have produced higher-scoring games.`,
    bullets: [`${away.abbr} ${away.goalsForPerGame.toFixed(1)} GPG vs ${home.abbr} ${home.goalsForPerGame.toFixed(1)} GPG, both PP% above 20%`],
  }
}

function restAdvantage(team: EdgeNhlTeamInput, opp: EdgeNhlTeamInput): DraftEdge | null {
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
    analysis: `${team.abbr} enters well-rested while ${opp.abbr} is playing the second night of a back-to-back.`,
    bullets: [`${team.abbr} rested ${team.daysRest}+ days vs ${opp.abbr} on a back-to-back`],
  }
}

function homeIce(home: EdgeNhlTeamInput, away: EdgeNhlTeamInput): DraftEdge | null {
  if (home.homeWinPct === null || away.awayWinPct === null) return null
  if (!(home.homeWinPct > 60 && away.awayWinPct < 40)) return null
  return {
    icon: '🏟',
    bet: `${home.abbr} — Home Ice`,
    team: home.abbr,
    typeLabel: 'Situational',
    grade: 'B',
    conf: clampConf(55 + (home.homeWinPct - 60) * 1.2 + (40 - away.awayWinPct) * 1.2),
    supporting: 2,
    line: `${home.abbr} home win% ${home.homeWinPct.toFixed(0)}%`,
    altPlay: `${away.abbr} road win% ${away.awayWinPct.toFixed(0)}%`,
    analysis: `${home.abbr} wins ${home.homeWinPct.toFixed(0)}% at home while ${away.abbr} has struggled on the road at ${away.awayWinPct.toFixed(0)}%.`,
    bullets: [`${home.abbr} home win% ${home.homeWinPct.toFixed(0)}% vs ${away.abbr} road win% ${away.awayWinPct.toFixed(0)}%`],
  }
}

function recentForm(team: EdgeNhlTeamInput, opp: EdgeNhlTeamInput): DraftEdge | null {
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

/** Generates real-stat-driven NHL edges (max 6, sorted by confidence). */
export function generateNHLEdges(ctx: NHLEdgeContext): Edge[] {
  const drafts: DraftEdge[] = []

  const awayGoalie = eliteGoalieAdvantage(ctx.away, ctx.home)
  if (awayGoalie) drafts.push(awayGoalie)
  const homeGoalie = eliteGoalieAdvantage(ctx.home, ctx.away)
  if (homeGoalie) drafts.push(homeGoalie)

  const awayStruggling = strugglingNetminder(ctx.away, ctx.home)
  if (awayStruggling) drafts.push(awayStruggling)
  const homeStruggling = strugglingNetminder(ctx.home, ctx.away)
  if (homeStruggling) drafts.push(homeStruggling)

  const awayPP = powerPlayAdvantage(ctx.away, ctx.home)
  if (awayPP) drafts.push(awayPP)
  const homePP = powerPlayAdvantage(ctx.home, ctx.away)
  if (homePP) drafts.push(homePP)

  const highEvent = highEventGame(ctx.away, ctx.home)
  if (highEvent) drafts.push(highEvent)

  const awayRest = restAdvantage(ctx.away, ctx.home)
  if (awayRest) drafts.push(awayRest)
  const homeRest = restAdvantage(ctx.home, ctx.away)
  if (homeRest) drafts.push(homeRest)

  const hi = homeIce(ctx.home, ctx.away)
  if (hi) drafts.push(hi)

  const awayForm = recentForm(ctx.away, ctx.home)
  if (awayForm) drafts.push(awayForm)
  const homeForm = recentForm(ctx.home, ctx.away)
  if (homeForm) drafts.push(homeForm)

  const sorted = drafts.sort((a, b) => b.conf - a.conf).slice(0, 6)
  return sorted.map((d, i) => ({ ...d, id: i + 1, type: d.typeLabel.toLowerCase() }))
}

export function hasAnyNHLEdge(ctx: NHLEdgeContext): boolean {
  return generateNHLEdges(ctx).length > 0
}
