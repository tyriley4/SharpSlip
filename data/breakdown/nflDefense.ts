import type { DefenseLast3Game, DefenseUnit, KeyDefender, TeamDefense } from './defenseTypes'

function seed(name: string): number {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 97
  return h
}

function rankFor(val: number, low: number, high: number, lowerIsBetter: boolean): number {
  const t = (val - low) / (high - low)
  const r = lowerIsBetter ? t : 1 - t
  return Math.max(1, Math.min(32, Math.round(1 + r * 31)))
}

interface RawDefense {
  abbr: string
  papg: number
  passAllowed: number
  rushAllowed: number
  sacks: number
  thirdDownStop: number
  redZoneDef: number
  turnovers: number
  blitzRate: number
  keyMatchup: string
  defenders: KeyDefender[]
  games: { opp: string; date: string; oppPts: number; result: 'W' | 'L' }[]
}

function buildDefense(d: RawDefense): TeamDefense {
  const s = seed(d.abbr)

  const units: DefenseUnit[] = [
    { label: 'Pts Allowed', value: d.papg.toFixed(1), rank: rankFor(d.papg, 14, 28, true), good: d.papg < 21 },
    { label: 'Pass Yds Allowed', value: String(d.passAllowed), rank: rankFor(d.passAllowed, 180, 260, true), good: d.passAllowed < 220 },
    { label: 'Rush Yds Allowed', value: String(d.rushAllowed), rank: rankFor(d.rushAllowed, 85, 140, true), good: d.rushAllowed < 112 },
    { label: 'Sacks', value: String(d.sacks), rank: rankFor(d.sacks, 30, 58, false), good: d.sacks >= 42 },
    { label: '3rd Down Stop%', value: `${d.thirdDownStop}%`, rank: rankFor(d.thirdDownStop, 48, 70, false), good: d.thirdDownStop >= 58 },
    { label: 'Red Zone Defense%', value: `${d.redZoneDef}%`, rank: rankFor(d.redZoneDef, 44, 65, false), good: d.redZoneDef >= 53 },
    { label: 'Turnovers Forced', value: String(d.turnovers), rank: rankFor(d.turnovers, 14, 32, false), good: d.turnovers >= 22 },
    { label: 'Blitz Rate', value: `${d.blitzRate}%`, rank: rankFor(d.blitzRate, 20, 40, false), good: d.blitzRate >= 28 },
  ]

  const last3: DefenseLast3Game[] = d.games.map((g, i) => {
    const variance = ((s + i * 7) % 13) - 6
    const pass = Math.max(120, Math.round(d.passAllowed / 1 * 0.78 + variance * 3))
    const rush = Math.max(50, Math.round(d.rushAllowed / 1 * 0.78 + variance * 2))
    const sacks = Math.max(0, Math.round(d.sacks / 17 + (variance % 3 === 0 ? 1 : 0)))
    const to = Math.max(0, (s + i) % 3)
    return { opp: g.opp, date: g.date, pts: g.oppPts, pass, rush, sacks, to }
  })

  const base = d.papg < 20 ? 64 : d.papg < 24 ? 52 : 38
  const rec = (v: number) => `${Math.round((v / 100) * 17)}-${17 - Math.round((v / 100) * 17)}`
  const sacksLine = (Math.round(d.sacks / 17) - 1 + 0.5).toFixed(1)
  const ptsLine = (Math.round(d.papg) + 2 - 0.5).toFixed(1)

  return {
    units,
    last3,
    keyMatchup: d.keyMatchup,
    defenders: d.defenders,
    bet: {
      sacks: { rec: rec(d.sacks >= 45 ? base + 8 : base - 8), pct: d.sacks >= 45 ? base + 8 : base - 8, label: `Over ${sacksLine} Team Sacks` },
      ptsAllowed: { rec: rec(base), pct: base, label: `Under ${ptsLine} Pts Allowed` },
      turnovers: { rec: rec(d.turnovers >= 24 ? base + 6 : base - 10), pct: d.turnovers >= 24 ? base + 6 : base - 10, label: 'Over 1.5 TO Forced' },
      ats: { rec: rec(base + 4), pct: base + 4, label: 'ATS This Season' },
    },
  }
}

export const nflDefenseData: Record<string, { away: TeamDefense; home: TeamDefense }> = {
  nfl1: {
    away: buildDefense({
      abbr: 'BUF', papg: 18.2, passAllowed: 218, rushAllowed: 98, sacks: 42, thirdDownStop: 61, redZoneDef: 54, turnovers: 24, blitzRate: 28,
      keyMatchup: "BUF's pass rush (42 sacks) faces a KC OL that has allowed pressure on 24% of Mahomes' dropbacks over the last 4 weeks.",
      defenders: [
        { name: 'Von Miller', pos: 'EDGE', note: 'Coming off a 2-sack game, big matchup vs KC right tackle' },
        { name: 'Matt Milano', pos: 'LB', note: 'Leads the team in tackles, key vs KC screen game' },
        { name: 'Taron Johnson', pos: 'CB', note: 'Draws the slot assignment on KC receivers' },
      ],
      games: [{ opp: 'MIA', date: 'Jan 5', oppPts: 17, result: 'W' }, { opp: 'NE', date: 'Dec 29', oppPts: 14, result: 'W' }, { opp: 'LAC', date: 'Dec 22', oppPts: 23, result: 'L' }],
    }),
    home: buildDefense({
      abbr: 'KC', papg: 19.4, passAllowed: 198, rushAllowed: 118, sacks: 48, thirdDownStop: 64, redZoneDef: 58, turnovers: 27, blitzRate: 31,
      keyMatchup: "KC's secondary (198 pass yds allowed/G) faces a BUF passing attack averaging 268 yds/G with Allen airing it out.",
      defenders: [
        { name: 'Chris Jones', pos: 'DT', note: 'Interior force that collapses the pocket on passing downs' },
        { name: 'Nick Bolton', pos: 'LB', note: 'Run-stopping anchor, key vs Allen designed runs' },
        { name: 'Trent McDuffie', pos: 'CB', note: 'Shadow corner likely to travel with BUF WR1' },
      ],
      games: [{ opp: 'LV', date: 'Jan 5', oppPts: 13, result: 'W' }, { opp: 'CIN', date: 'Dec 29', oppPts: 17, result: 'W' }, { opp: 'LAC', date: 'Dec 22', oppPts: 20, result: 'W' }],
    }),
  },
  nfl2: {
    away: buildDefense({
      abbr: 'PHI', papg: 19.8, passAllowed: 208, rushAllowed: 104, sacks: 45, thirdDownStop: 62, redZoneDef: 56, turnovers: 22, blitzRate: 26,
      keyMatchup: "PHI's front seven vs a DAL OL that has allowed pressure on 30%+ dropbacks, a known trigger for Prescott turnovers.",
      defenders: [
        { name: 'Zack Baun', pos: 'LB', note: 'Breakout tackling season, sideline-to-sideline range' },
        { name: 'Darius Slay', pos: 'CB', note: 'Veteran leadership matched up on DAL WR1' },
        { name: 'Jalen Carter', pos: 'DT', note: 'Disruptive interior presence collapsing the pocket' },
      ],
      games: [{ opp: 'NYG', date: 'Jan 5', oppPts: 10, result: 'W' }, { opp: 'ARI', date: 'Dec 29', oppPts: 24, result: 'W' }, { opp: 'SF', date: 'Dec 22', oppPts: 25, result: 'L' }],
    }),
    home: buildDefense({
      abbr: 'DAL', papg: 24.6, passAllowed: 241, rushAllowed: 124, sacks: 38, thirdDownStop: 56, redZoneDef: 48, turnovers: 18, blitzRate: 24,
      keyMatchup: "DAL's defense (24.6 PAPG over last 4) faces a PHI rushing attack averaging 138 yds/G behind Barkley and Hurts.",
      defenders: [
        { name: 'Micah Parsons', pos: 'EDGE', note: 'Elite pass rusher who can wreck the game plan alone' },
        { name: 'DaRon Bland', pos: 'CB', note: 'Ballhawk corner with pick-six ability' },
        { name: 'Osa Odighizuwa', pos: 'DT', note: 'Steady interior push against the run' },
      ],
      games: [{ opp: 'WAS', date: 'Jan 5', oppPts: 24, result: 'L' }, { opp: 'DET', date: 'Dec 29', oppPts: 20, result: 'W' }, { opp: 'MIA', date: 'Dec 22', oppPts: 22, result: 'L' }],
    }),
  },
  nfl3: {
    away: buildDefense({
      abbr: 'SF', papg: 17.5, passAllowed: 201, rushAllowed: 92, sacks: 51, thirdDownStop: 66, redZoneDef: 61, turnovers: 28, blitzRate: 34,
      keyMatchup: "SF's pass rush (51 sacks, top-3 in the NFL) attacks a LAR OL missing two starters up front.",
      defenders: [
        { name: 'Nick Bosa', pos: 'EDGE', note: 'Double-team magnet who still wins one-on-ones' },
        { name: 'Fred Warner', pos: 'LB', note: 'Top coverage linebacker, erases the middle of the field' },
        { name: 'Charvarius Ward', pos: 'CB', note: 'Lockdown corner drawing LAR WR1' },
      ],
      games: [{ opp: 'ARI', date: 'Jan 5', oppPts: 13, result: 'W' }, { opp: 'WAS', date: 'Dec 29', oppPts: 10, result: 'W' }, { opp: 'SEA', date: 'Dec 22', oppPts: 21, result: 'W' }],
    }),
    home: buildDefense({
      abbr: 'LAR', papg: 23.1, passAllowed: 248, rushAllowed: 128, sacks: 41, thirdDownStop: 57, redZoneDef: 51, turnovers: 19, blitzRate: 27,
      keyMatchup: "LAR's run defense (24th in the NFL) faces a red-hot McCaffrey averaging 108 rush yds/G.",
      defenders: [
        { name: 'Kobie Turner', pos: 'DT', note: 'Emerging interior force generating consistent pressure' },
        { name: 'Jared Verse', pos: 'EDGE', note: 'Rookie standout with disruptive first-step quickness' },
        { name: 'Cobie Durant', pos: 'CB', note: 'Ball skills corner capable of a takeaway' },
      ],
      games: [{ opp: 'SEA', date: 'Jan 5', oppPts: 26, result: 'L' }, { opp: 'NYG', date: 'Dec 29', oppPts: 13, result: 'W' }, { opp: 'NO', date: 'Dec 22', oppPts: 21, result: 'L' }],
    }),
  },
  nfl4: {
    away: buildDefense({
      abbr: 'BAL', papg: 16.8, passAllowed: 198, rushAllowed: 94, sacks: 54, thirdDownStop: 68, redZoneDef: 63, turnovers: 31, blitzRate: 38,
      keyMatchup: "BAL's blitz-heavy scheme (38% blitz rate) tests a CIN OL that has allowed pressure leading to 6 of Burrow's 10 INTs.",
      defenders: [
        { name: 'Roquan Smith', pos: 'LB', note: 'Sideline-to-sideline range, elite run defender' },
        { name: 'Kyle Hamilton', pos: 'S', note: 'Versatile chess piece who can blitz or drop deep' },
        { name: 'Nnamdi Madubuike', pos: 'DT', note: 'Interior disruptor collapsing the pocket' },
      ],
      games: [{ opp: 'PIT', date: 'Jan 5', oppPts: 24, result: 'L' }, { opp: 'SF', date: 'Dec 29', oppPts: 17, result: 'W' }, { opp: 'CLE', date: 'Dec 22', oppPts: 14, result: 'W' }],
    }),
    home: buildDefense({
      abbr: 'CIN', papg: 23.9, passAllowed: 244, rushAllowed: 132, sacks: 36, thirdDownStop: 55, redZoneDef: 47, turnovers: 17, blitzRate: 23,
      keyMatchup: "CIN's run defense (bottom-10 vs mobile QBs) faces a Lamar Jackson averaging 78 rush yds/G with extra rest.",
      defenders: [
        { name: 'Trey Hendrickson', pos: 'EDGE', note: 'Elite pass rush production, league leader in pressures' },
        { name: 'Germaine Pratt', pos: 'LB', note: 'Reliable tackler in run support' },
        { name: 'Cam Taylor-Britt', pos: 'CB', note: 'Physical corner willing to support the run' },
      ],
      games: [{ opp: 'PIT', date: 'Jan 5', oppPts: 24, result: 'W' }, { opp: 'DEN', date: 'Dec 29', oppPts: 24, result: 'L' }, { opp: 'KC', date: 'Dec 22', oppPts: 24, result: 'L' }],
    }),
  },
  nfl5: {
    away: buildDefense({
      abbr: 'DET', papg: 20.2, passAllowed: 221, rushAllowed: 108, sacks: 47, thirdDownStop: 60, redZoneDef: 55, turnovers: 25, blitzRate: 29,
      keyMatchup: "DET's defense forcing 1.8 turnovers/game over the last 6 faces a GB offense that has turned it over 3 times in as many games.",
      defenders: [
        { name: 'Alim McNeill', pos: 'DT', note: 'Interior stalwart holding up against double teams' },
        { name: 'Derrick Barnes', pos: 'LB', note: 'Downhill run defender filling gaps quickly' },
        { name: 'Terrion Arnold', pos: 'CB', note: 'Developing rookie corner tested often' },
      ],
      games: [{ opp: 'MIN', date: 'Jan 5', oppPts: 24, result: 'W' }, { opp: 'DAL', date: 'Dec 29', oppPts: 27, result: 'L' }, { opp: 'CHI', date: 'Dec 22', oppPts: 17, result: 'W' }],
    }),
    home: buildDefense({
      abbr: 'GB', papg: 21.6, passAllowed: 231, rushAllowed: 112, sacks: 43, thirdDownStop: 58, redZoneDef: 52, turnovers: 21, blitzRate: 25,
      keyMatchup: "GB's defense, allowing just 18.4 PPG over the last 3, faces a DET offense averaging 29.4 PPG on the season.",
      defenders: [
        { name: 'Rashan Gary', pos: 'EDGE', note: 'Consistent pressure off the edge, due for a sack' },
        { name: 'Quay Walker', pos: 'LB', note: 'Downhill run defender with sideline range' },
        { name: 'Jaire Alexander', pos: 'CB', note: 'Shutdown corner when healthy, key matchup vs DET WR1' },
      ],
      games: [{ opp: 'CHI', date: 'Jan 5', oppPts: 17, result: 'W' }, { opp: 'MIN', date: 'Dec 29', oppPts: 27, result: 'L' }, { opp: 'TB', date: 'Dec 22', oppPts: 20, result: 'W' }],
    }),
  },
}
