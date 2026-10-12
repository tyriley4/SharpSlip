import type { Edge } from '@/data/breakdown/types'

export interface EdgePitcherInput {
  id: number
  name: string
  team: string
  era: number
  fip: number
  k9: number
}

export interface EdgeTeamInput {
  abbr: string
  battingAvg: number
  kPct: number
  runsPerGame: number
  pitchingEra: number
  bullpenEra: number | null
  homeWinPct: number | null
  awayWinPct: number | null
  last10Wins: number
  last10Losses: number
  isHome: boolean
}

export interface EdgeContext {
  away: EdgeTeamInput
  home: EdgeTeamInput
  awayPitcher: EdgePitcherInput | null
  homePitcher: EdgePitcherInput | null
}

type DraftEdge = Omit<Edge, 'id' | 'type'>

function clampConf(n: number): number {
  return Math.max(50, Math.min(96, Math.round(n)))
}

function fmtAvg(n: number): string {
  return n.toFixed(3).replace(/^0/, '')
}

function aceAdvantage(pitcher: EdgePitcherInput, opp: EdgeTeamInput): DraftEdge | null {
  if (!(pitcher.era < 3.0 && opp.battingAvg > 0.26)) return null
  const grade = pitcher.era < 2.5 ? 'A' : 'B'
  const gapPts = Math.round((opp.battingAvg - 0.26) * 1000)
  const conf = clampConf(60 + (3.0 - pitcher.era) * 16 + gapPts * 0.7)
  return {
    icon: '🎯',
    bet: `${pitcher.name} — Ace Advantage`,
    team: pitcher.team,
    typeLabel: 'Pitching',
    grade,
    conf,
    supporting: 2,
    line: `${pitcher.name} ERA ${pitcher.era.toFixed(2)}`,
    altPlay: `Opponent team AVG ${fmtAvg(opp.battingAvg)}`,
    analysis: `${pitcher.name} carries a ${pitcher.era.toFixed(2)} ERA into a matchup against ${opp.abbr}, a lineup hitting ${fmtAvg(opp.battingAvg)} as a team this season.`,
    bullets: [
      `${pitcher.name} ERA ${pitcher.era.toFixed(2)} vs opponent ${fmtAvg(opp.battingAvg)} team AVG — ${gapPts} point gap; historical data favors the pitcher`,
      `Sub-3.00 ERA starter facing a lineup hitting above league-average contact rate`,
    ],
  }
}

function strikeoutSpot(pitcher: EdgePitcherInput, opp: EdgeTeamInput): DraftEdge | null {
  if (!(pitcher.k9 > 9.5 && opp.kPct > 24)) return null
  const grade = pitcher.k9 > 11 ? 'A' : 'B'
  const conf = clampConf(58 + (pitcher.k9 - 9.5) * 8 + (opp.kPct - 24) * 2.5)
  return {
    icon: '🔥',
    bet: `${pitcher.name} — Strikeout Spot`,
    team: pitcher.team,
    typeLabel: 'Pitching',
    grade,
    conf,
    supporting: 2,
    line: `${pitcher.name} K/9 ${pitcher.k9.toFixed(1)}`,
    altPlay: `Opponent team K% ${opp.kPct.toFixed(1)}%`,
    analysis: `${pitcher.name} misses bats at a ${pitcher.k9.toFixed(1)} K/9 clip against a ${opp.abbr} lineup that strikes out in ${opp.kPct.toFixed(1)}% of plate appearances.`,
    bullets: [
      `${pitcher.name} K/9 ${pitcher.k9.toFixed(1)} vs opponent ${opp.kPct.toFixed(1)}% team K-rate`,
      `Key trend: the pitcher's whiff rate and the lineup's strikeout tendency point the same direction`,
    ],
  }
}

function pitcherRegressionRisk(pitcher: EdgePitcherInput): DraftEdge | null {
  if (!(pitcher.era > 4.5 && pitcher.fip < 3.5)) return null
  const conf = clampConf(55 + (pitcher.era - 4.5) * 10 + (3.5 - pitcher.fip) * 10)
  return {
    icon: '📉',
    bet: `${pitcher.name} — Regression Risk`,
    team: pitcher.team,
    typeLabel: 'Pitching',
    grade: 'B',
    conf,
    supporting: 2,
    line: `${pitcher.name} ERA ${pitcher.era.toFixed(2)}`,
    altPlay: `FIP ${pitcher.fip.toFixed(2)}`,
    analysis: `${pitcher.name}'s ${pitcher.era.toFixed(2)} ERA is well above his ${pitcher.fip.toFixed(2)} FIP, suggesting he's pitched better than his results — regression toward the FIP is a trend worth monitoring.`,
    bullets: [
      `ERA ${pitcher.era.toFixed(2)} vs FIP ${pitcher.fip.toFixed(2)} — a ${(pitcher.era - pitcher.fip).toFixed(2)} gap between results and peripherals`,
      `Underlying strikeout, walk, and home-run rates outperform the surface ERA`,
    ],
  }
}

function offensiveFirepower(offense: EdgeTeamInput, oppPitchingEra: number, oppAbbr: string): DraftEdge | null {
  if (!(offense.runsPerGame >= 5.0 && oppPitchingEra > 4.2)) return null
  const grade = offense.runsPerGame >= 5.5 ? 'A' : 'B'
  const conf = clampConf(55 + (offense.runsPerGame - 5.0) * 20 + (oppPitchingEra - 4.2) * 12)
  return {
    icon: '💥',
    bet: `${offense.abbr} — Offensive Firepower`,
    team: offense.abbr,
    typeLabel: 'Offense',
    grade,
    conf,
    supporting: 2,
    line: `${offense.abbr} ${offense.runsPerGame.toFixed(1)} R/G`,
    altPlay: `${oppAbbr} team ERA ${oppPitchingEra.toFixed(2)}`,
    analysis: `${offense.abbr} is scoring ${offense.runsPerGame.toFixed(1)} runs per game against a ${oppAbbr} pitching staff carrying a ${oppPitchingEra.toFixed(2)} team ERA.`,
    bullets: [
      `${offense.abbr} averaging ${offense.runsPerGame.toFixed(1)} runs/game vs a ${oppPitchingEra.toFixed(2)} opponent team ERA`,
      `A high-scoring offense facing a staff that's allowed runs at an above-average rate`,
    ],
  }
}

function bullpenAdvantage(team: EdgeTeamInput, opp: EdgeTeamInput): DraftEdge | null {
  if (team.bullpenEra === null || opp.bullpenEra === null) return null
  if (!(team.bullpenEra < 3.2 && opp.bullpenEra > 4.5)) return null
  const conf = clampConf(55 + (3.2 - team.bullpenEra) * 12 + (opp.bullpenEra - 4.5) * 10)
  return {
    icon: '🔒',
    bet: `${team.abbr} — Bullpen Advantage`,
    team: team.abbr,
    typeLabel: 'Bullpen',
    grade: 'B',
    conf,
    supporting: 2,
    line: `${team.abbr} bullpen ERA ${team.bullpenEra.toFixed(2)}`,
    altPlay: `${opp.abbr} bullpen ERA ${opp.bullpenEra.toFixed(2)}`,
    analysis: `${team.abbr}'s ${team.bullpenEra.toFixed(2)} bullpen ERA is a clear edge over ${opp.abbr}'s ${opp.bullpenEra.toFixed(2)} — a late-game trend worth monitoring if this one is close.`,
    bullets: [
      `${team.abbr} bullpen ERA ${team.bullpenEra.toFixed(2)} vs ${opp.abbr} bullpen ERA ${opp.bullpenEra.toFixed(2)}`,
      `Supporting insight: relief pitching matters most in one-run, late-inning situations`,
    ],
  }
}

function homeFieldEdge(home: EdgeTeamInput, away: EdgeTeamInput): DraftEdge | null {
  if (home.homeWinPct === null || away.awayWinPct === null) return null
  if (!(home.homeWinPct > 60 && away.awayWinPct < 45)) return null
  const conf = clampConf(55 + (home.homeWinPct - 60) * 1.2 + (45 - away.awayWinPct) * 1.2)
  return {
    icon: '🏟',
    bet: `${home.abbr} — Home Field Edge`,
    team: home.abbr,
    typeLabel: 'Situational',
    grade: 'B',
    conf,
    supporting: 2,
    line: `${home.abbr} home win% ${home.homeWinPct.toFixed(1)}%`,
    altPlay: `${away.abbr} road win% ${away.awayWinPct.toFixed(1)}%`,
    analysis: `${home.abbr} wins at a ${home.homeWinPct.toFixed(1)}% clip at home this season, while ${away.abbr} has struggled on the road at ${away.awayWinPct.toFixed(1)}%.`,
    bullets: [
      `${home.abbr} home win% ${home.homeWinPct.toFixed(1)}% vs ${away.abbr} road win% ${away.awayWinPct.toFixed(1)}%`,
      `Home/road split favors the home side more than their overall record alone suggests`,
    ],
  }
}

function recentForm(team: EdgeTeamInput, opp: EdgeTeamInput): DraftEdge | null {
  const oppLosses = opp.last10Losses
  if (!(team.last10Wins >= 7 && oppLosses >= 7)) return null
  const grade = team.last10Wins >= 8 && oppLosses >= 8 ? 'A' : 'B'
  const conf = clampConf(55 + (team.last10Wins - 7) * 8 + (oppLosses - 7) * 8)
  return {
    icon: '📈',
    bet: `${team.abbr} — Recent Form`,
    team: team.abbr,
    typeLabel: 'Situational',
    grade,
    conf,
    supporting: 2,
    line: `${team.abbr} ${team.last10Wins}-${10 - team.last10Wins} L10`,
    altPlay: `${opp.abbr} ${10 - oppLosses}-${oppLosses} L10`,
    analysis: `${team.abbr} enters on a ${team.last10Wins}-${10 - team.last10Wins} run over their last 10, while ${opp.abbr} has gone just ${10 - oppLosses}-${oppLosses} in the same span.`,
    bullets: [
      `${team.abbr} ${team.last10Wins}-${10 - team.last10Wins} in last 10 vs ${opp.abbr} ${10 - oppLosses}-${oppLosses} in last 10`,
      `Supporting insight: recent momentum favors the hotter club heading into this matchup`,
    ],
  }
}

/**
 * Generates real-stat-driven insights (statistical trends, not bet recommendations) for a game. Deliberately omits any rule that would
 * require betting lines/odds (e.g. "Run Line Value") since the free MLB Stats API has no odds
 * feed — every edge here is backed by real season/recent stats, never fabricated numbers.
 */
export function generateEdges(ctx: EdgeContext): Edge[] {
  const drafts: DraftEdge[] = []

  if (ctx.awayPitcher) {
    const a = aceAdvantage(ctx.awayPitcher, ctx.home)
    if (a) drafts.push(a)
    const s = strikeoutSpot(ctx.awayPitcher, ctx.home)
    if (s) drafts.push(s)
    const r = pitcherRegressionRisk(ctx.awayPitcher)
    if (r) drafts.push(r)
  }
  if (ctx.homePitcher) {
    const a = aceAdvantage(ctx.homePitcher, ctx.away)
    if (a) drafts.push(a)
    const s = strikeoutSpot(ctx.homePitcher, ctx.away)
    if (s) drafts.push(s)
    const r = pitcherRegressionRisk(ctx.homePitcher)
    if (r) drafts.push(r)
  }

  const awayOff = offensiveFirepower(ctx.away, ctx.home.pitchingEra, ctx.home.abbr)
  if (awayOff) drafts.push(awayOff)
  const homeOff = offensiveFirepower(ctx.home, ctx.away.pitchingEra, ctx.away.abbr)
  if (homeOff) drafts.push(homeOff)

  const awayBullpen = bullpenAdvantage(ctx.away, ctx.home)
  if (awayBullpen) drafts.push(awayBullpen)
  const homeBullpen = bullpenAdvantage(ctx.home, ctx.away)
  if (homeBullpen) drafts.push(homeBullpen)

  const homeField = homeFieldEdge(ctx.home, ctx.away)
  if (homeField) drafts.push(homeField)

  const awayForm = recentForm(ctx.away, ctx.home)
  if (awayForm) drafts.push(awayForm)
  const homeForm = recentForm(ctx.home, ctx.away)
  if (homeForm) drafts.push(homeForm)

  const sorted = drafts.sort((a, b) => b.conf - a.conf).slice(0, 6)

  return sorted.map((d, i) => ({
    ...d,
    id: i + 1,
    type: d.typeLabel.toLowerCase(),
  }))
}
