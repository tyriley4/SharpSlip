import type { Edge } from '@/data/breakdown/types'

export interface EdgeQBInput {
  name: string
  team: string
  rating: number
  intRate: number
  cpoe: number | null
}

export interface EdgeTeamInput {
  abbr: string
  pointsPerGame: number
  pointsAllowedPerGame: number
  passYdsPerGame: number
  rushYdsPerGame: number
  passYdsAllowedPerGame: number
  rushYdsAllowedPerGame: number
  turnoversForcedPerGame: number
  homeWinPct: number | null
  awayWinPct: number | null
  last5Wins: number
  last5Losses: number
  secondaryCompPctAllowed: number | null
}

export interface NFLEdgeContext {
  away: EdgeTeamInput
  home: EdgeTeamInput
  awayQB: EdgeQBInput | null
  homeQB: EdgeQBInput | null
}

type DraftEdge = Omit<Edge, 'id' | 'type'>

function clampConf(v: number): number {
  return Math.max(50, Math.min(96, Math.round(v)))
}

function eliteQBMatchup(qb: EdgeQBInput, opp: EdgeTeamInput): DraftEdge | null {
  if (!(qb.rating > 100 && opp.passYdsAllowedPerGame >= 270)) return null
  const grade = qb.rating > 110 ? 'A' : 'B'
  const conf = clampConf(58 + (qb.rating - 100) * 0.5 + (opp.passYdsAllowedPerGame - 270) * 0.3)
  return {
    icon: '🎯',
    bet: `${qb.name} — Elite QB Matchup`,
    team: qb.team,
    typeLabel: 'Passing',
    grade,
    conf,
    supporting: 2,
    line: `${qb.name} rating ${qb.rating.toFixed(1)}`,
    altPlay: `Opponent pass yards allowed ${opp.passYdsAllowedPerGame.toFixed(1)}/g`,
    analysis: `${qb.name} carries a ${qb.rating.toFixed(1)} passer rating into a matchup against ${opp.abbr}, who allow ${opp.passYdsAllowedPerGame.toFixed(1)} pass yards per game.`,
    bullets: [
      `${qb.name} rating ${qb.rating.toFixed(1)} vs ${opp.abbr} allowing ${opp.passYdsAllowedPerGame.toFixed(1)} pass yds/g`,
      'Elite QB play against a vulnerable pass defense',
    ],
  }
}

function turnoverDanger(qb: EdgeQBInput, opp: EdgeTeamInput): DraftEdge | null {
  if (!(qb.intRate > 3 && opp.turnoversForcedPerGame >= 1.5)) return null
  const conf = clampConf(55 + (qb.intRate - 3) * 6 + (opp.turnoversForcedPerGame - 1.5) * 8)
  return {
    icon: '⚠️',
    bet: `${qb.name} — Turnover Danger`,
    team: qb.team,
    typeLabel: 'Passing',
    grade: 'B',
    conf,
    supporting: 2,
    line: `${qb.name} INT rate ${qb.intRate.toFixed(1)}%`,
    altPlay: `${opp.abbr} forces ${opp.turnoversForcedPerGame.toFixed(1)} TOs/g`,
    analysis: `${qb.name} throws interceptions at a ${qb.intRate.toFixed(1)}% clip and faces a ${opp.abbr} defense forcing ${opp.turnoversForcedPerGame.toFixed(1)} turnovers per game — a combination that has historically produced turnover risk.`,
    bullets: [
      `${qb.name} INT rate ${qb.intRate.toFixed(1)}% vs ${opp.abbr} forcing ${opp.turnoversForcedPerGame.toFixed(1)} TOs/g`,
      'Turnover-prone passer facing a ball-hawking defense',
    ],
  }
}

function cpoeAdvantage(qb: EdgeQBInput, opp: EdgeTeamInput): DraftEdge | null {
  if (qb.cpoe === null || opp.secondaryCompPctAllowed === null) return null
  if (!(qb.cpoe > 3 && opp.secondaryCompPctAllowed >= 65)) return null
  const conf = clampConf(55 + (qb.cpoe - 3) * 3 + (opp.secondaryCompPctAllowed - 65) * 1.5)
  return {
    icon: '📈',
    bet: `${qb.name} — CPOE Advantage`,
    team: qb.team,
    typeLabel: 'Passing',
    grade: 'B',
    conf,
    supporting: 2,
    line: `${qb.name} CPOE +${qb.cpoe.toFixed(1)}%`,
    altPlay: `${opp.abbr} allows ${opp.secondaryCompPctAllowed.toFixed(1)}% completions`,
    analysis: `${qb.name} completes passes well above expectation (+${qb.cpoe.toFixed(1)}% CPOE) against a secondary allowing a ${opp.secondaryCompPctAllowed.toFixed(1)}% completion rate.`,
    bullets: [`${qb.name} CPOE +${qb.cpoe.toFixed(1)}% vs opponent allowing ${opp.secondaryCompPctAllowed.toFixed(1)}% comp rate`],
  }
}

function groundGameAdvantage(team: EdgeTeamInput, opp: EdgeTeamInput): DraftEdge | null {
  if (!(team.rushYdsPerGame > 130 && opp.rushYdsAllowedPerGame >= 130)) return null
  const grade = team.rushYdsPerGame > 140 && opp.rushYdsAllowedPerGame > 140 ? 'A' : 'B'
  const conf = clampConf(55 + (team.rushYdsPerGame - 130) * 0.4 + (opp.rushYdsAllowedPerGame - 130) * 0.4)
  return {
    icon: '🏃',
    bet: `${team.abbr} — Ground Game Advantage`,
    team: team.abbr,
    typeLabel: 'Rushing',
    grade,
    conf,
    supporting: 2,
    line: `${team.abbr} rush ${team.rushYdsPerGame.toFixed(1)} yds/g`,
    altPlay: `${opp.abbr} allows ${opp.rushYdsAllowedPerGame.toFixed(1)} rush yds/g`,
    analysis: `${team.abbr} runs for ${team.rushYdsPerGame.toFixed(1)} yards per game against a ${opp.abbr} run defense allowing ${opp.rushYdsAllowedPerGame.toFixed(1)}/g.`,
    bullets: [`${team.abbr} ${team.rushYdsPerGame.toFixed(1)} rush yds/g vs ${opp.abbr} allowing ${opp.rushYdsAllowedPerGame.toFixed(1)}/g`],
  }
}

function runToSetUpPass(team: EdgeTeamInput): DraftEdge | null {
  if (!(team.rushYdsPerGame > 120 && team.passYdsPerGame > 270)) return null
  return {
    icon: '⚖️',
    bet: `${team.abbr} — Run to Set Up Pass`,
    team: team.abbr,
    typeLabel: 'Rushing',
    grade: 'B',
    conf: clampConf(55 + (team.rushYdsPerGame - 120) * 0.2 + (team.passYdsPerGame - 270) * 0.1),
    supporting: 2,
    line: `${team.abbr} rush ${team.rushYdsPerGame.toFixed(1)} / pass ${team.passYdsPerGame.toFixed(1)} yds/g`,
    altPlay: 'Balanced offensive attack',
    analysis: `${team.abbr} is balanced — ${team.rushYdsPerGame.toFixed(1)} rush and ${team.passYdsPerGame.toFixed(1)} pass yards per game — making them hard to defend with one focus.`,
    bullets: [`${team.abbr} averaging ${team.rushYdsPerGame.toFixed(1)} rush + ${team.passYdsPerGame.toFixed(1)} pass yds/g`],
  }
}

function defensiveDominance(team: EdgeTeamInput, opp: EdgeTeamInput): DraftEdge | null {
  if (!(team.pointsAllowedPerGame < 17 && opp.pointsPerGame < 20)) return null
  return {
    icon: '🛡️',
    bet: `${team.abbr} Defense — Defensive Dominance`,
    team: team.abbr,
    typeLabel: 'Defense',
    grade: 'A',
    conf: clampConf(60 + (17 - team.pointsAllowedPerGame) * 2 + (20 - opp.pointsPerGame) * 1.5),
    supporting: 2,
    line: `${team.abbr} allows ${team.pointsAllowedPerGame.toFixed(1)} pts/g`,
    altPlay: `${opp.abbr} scores ${opp.pointsPerGame.toFixed(1)} pts/g`,
    analysis: `${team.abbr}'s defense allows just ${team.pointsAllowedPerGame.toFixed(1)} points per game against a ${opp.abbr} offense scoring ${opp.pointsPerGame.toFixed(1)}/g — historical data favors a lower-scoring game.`,
    bullets: [`${team.abbr} allows ${team.pointsAllowedPerGame.toFixed(1)} pts/g vs ${opp.abbr} scoring ${opp.pointsPerGame.toFixed(1)}/g`],
  }
}

function turnoverMachine(team: EdgeTeamInput, opp: EdgeQBInput | null): DraftEdge | null {
  if (!opp) return null
  if (!(team.turnoversForcedPerGame >= 2 && opp.intRate > 2.5)) return null
  return {
    icon: '🔒',
    bet: `${team.abbr} Defense — Turnover Machine`,
    team: team.abbr,
    typeLabel: 'Defense',
    grade: 'B',
    conf: clampConf(55 + (team.turnoversForcedPerGame - 2) * 6 + (opp.intRate - 2.5) * 5),
    supporting: 2,
    line: `${team.abbr} forces ${team.turnoversForcedPerGame.toFixed(1)} TOs/g`,
    altPlay: `${opp.name} INT rate ${opp.intRate.toFixed(1)}%`,
    analysis: `${team.abbr} forces ${team.turnoversForcedPerGame.toFixed(1)} turnovers per game and faces ${opp.name}, who throws picks at a ${opp.intRate.toFixed(1)}% rate.`,
    bullets: [`${team.abbr} forces ${team.turnoversForcedPerGame.toFixed(1)} TOs/g vs ${opp.name} ${opp.intRate.toFixed(1)}% INT rate`],
  }
}

function homeFieldAdvantage(home: EdgeTeamInput, away: EdgeTeamInput): DraftEdge | null {
  if (home.homeWinPct === null || away.awayWinPct === null) return null
  if (!(home.homeWinPct > 65 && away.awayWinPct < 40)) return null
  return {
    icon: '🏟',
    bet: `${home.abbr} — Home Field Advantage`,
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

function recentForm(team: EdgeTeamInput, opp: EdgeTeamInput): DraftEdge | null {
  if (!(team.last5Wins >= 4 && opp.last5Losses >= 4)) return null
  const grade = team.last5Wins === 5 && opp.last5Losses === 5 ? 'A' : 'B'
  return {
    icon: '📈',
    bet: `${team.abbr} — Recent Form`,
    team: team.abbr,
    typeLabel: 'Situational',
    grade,
    conf: clampConf(55 + (team.last5Wins - 4) * 10 + (opp.last5Losses - 4) * 10),
    supporting: 2,
    line: `${team.abbr} ${team.last5Wins}-${5 - team.last5Wins} L5`,
    altPlay: `${opp.abbr} ${5 - opp.last5Losses}-${opp.last5Losses} L5`,
    analysis: `${team.abbr} enters ${team.last5Wins}-${5 - team.last5Wins} over their last 5 while ${opp.abbr} has gone just ${5 - opp.last5Losses}-${opp.last5Losses}.`,
    bullets: [`${team.abbr} ${team.last5Wins}-${5 - team.last5Wins} L5 vs ${opp.abbr} ${5 - opp.last5Losses}-${opp.last5Losses} L5`],
  }
}

export function generateNFLEdges(ctx: NFLEdgeContext): Edge[] {
  const drafts: DraftEdge[] = []

  if (ctx.awayQB) {
    const a = eliteQBMatchup(ctx.awayQB, ctx.home)
    if (a) drafts.push(a)
    const t = turnoverDanger(ctx.awayQB, ctx.home)
    if (t) drafts.push(t)
    const c = cpoeAdvantage(ctx.awayQB, ctx.home)
    if (c) drafts.push(c)
  }
  if (ctx.homeQB) {
    const a = eliteQBMatchup(ctx.homeQB, ctx.away)
    if (a) drafts.push(a)
    const t = turnoverDanger(ctx.homeQB, ctx.away)
    if (t) drafts.push(t)
    const c = cpoeAdvantage(ctx.homeQB, ctx.away)
    if (c) drafts.push(c)
  }

  const awayGround = groundGameAdvantage(ctx.away, ctx.home)
  if (awayGround) drafts.push(awayGround)
  const homeGround = groundGameAdvantage(ctx.home, ctx.away)
  if (homeGround) drafts.push(homeGround)

  const awayBalanced = runToSetUpPass(ctx.away)
  if (awayBalanced) drafts.push(awayBalanced)
  const homeBalanced = runToSetUpPass(ctx.home)
  if (homeBalanced) drafts.push(homeBalanced)

  const awayDef = defensiveDominance(ctx.away, ctx.home)
  if (awayDef) drafts.push(awayDef)
  const homeDef = defensiveDominance(ctx.home, ctx.away)
  if (homeDef) drafts.push(homeDef)

  const awayTO = turnoverMachine(ctx.away, ctx.homeQB)
  if (awayTO) drafts.push(awayTO)
  const homeTO = turnoverMachine(ctx.home, ctx.awayQB)
  if (homeTO) drafts.push(homeTO)

  const homeField = homeFieldAdvantage(ctx.home, ctx.away)
  if (homeField) drafts.push(homeField)

  const awayForm = recentForm(ctx.away, ctx.home)
  if (awayForm) drafts.push(awayForm)
  const homeForm = recentForm(ctx.home, ctx.away)
  if (homeForm) drafts.push(homeForm)

  const sorted = drafts.sort((a, b) => b.conf - a.conf).slice(0, 6)
  return sorted.map((d, i) => ({ ...d, id: i + 1, type: d.typeLabel.toLowerCase() }))
}
