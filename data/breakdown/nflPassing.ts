import type { QBLast3Game, QBPassingDetail } from './passingTypes'

function seed(name: string): number {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 97
  return h
}

function passerRating(comp: number, att: number, yds: number, td: number, int: number): number {
  const a = Math.max(0, Math.min(2.375, ((comp / att) - 0.3) * 5))
  const b = Math.max(0, Math.min(2.375, ((yds / att) - 3) * 0.25))
  const c = Math.max(0, Math.min(2.375, (td / att) * 20))
  const d = Math.max(0, Math.min(2.375, 2.375 - (int / att) * 25))
  return ((a + b + c + d) / 6) * 100
}

interface RawQB {
  name: string
  hot: boolean
  rating: number
  passYds: number
  compPct: number
  tdSeason: number
  intSeason: number
  sacksSeason: number
  games: { opp: string; date: string; result: 'W' | 'L' }[]
}

function buildQB(q: RawQB): QBPassingDetail {
  const s = seed(q.name)

  const aDot = (6.4 + (s % 25) / 10).toFixed(1)
  const airYardsPerG = q.passYds * (0.5 + (s % 20) / 100)
  const yac = Math.max(60, q.passYds - airYardsPerG)
  const pressurePct = Math.min(42, 20 + (q.sacksSeason / 34) * 15 + (s % 8))
  const cpoe = (q.rating - 92) * 0.16
  const badThrowPct = Math.max(8, 20 - (q.rating - 88) * 0.14 + (s % 4))

  const last3: QBLast3Game[] = q.games.map((g, i) => {
    const variance = ((s + i * 13) % 21) - 10
    const yds = Math.max(140, Math.round(q.passYds + variance * 3))
    const compPctGame = Math.max(45, Math.min(85, Math.round(q.compPct + variance * 0.4)))
    const att = Math.max(20, Math.round(yds / 8.2))
    const comp = Math.round((att * compPctGame) / 100)
    const td = g.result === 'W' ? 1 + ((s + i) % 3) : (s + i) % 2
    const int = g.result === 'L' ? (s + i) % 2 : (s + i + 1) % 3 === 0 ? 1 : 0
    return {
      opp: g.opp,
      date: g.date,
      comp: `${comp}/${att}`,
      yds,
      td,
      int,
      rating: passerRating(comp, att, yds, td, int).toFixed(1),
      result: g.result,
    }
  })

  const base = q.hot ? 66 : q.rating >= 100 ? 60 : q.rating >= 92 ? 51 : 40
  const rec = (v: number) => `${Math.round((v / 100) * 17)}-${17 - Math.round((v / 100) * 17)}`
  const passYdsLine = (Math.round(q.passYds) - 3 + 0.5).toFixed(1)
  const compLine = (Math.round((q.passYds / 8.1) * (q.compPct / 100)) - 1 + 0.5).toFixed(1)
  const tdPerG = q.tdSeason / 17
  const intPerG = q.intSeason / 17

  return {
    name: q.name,
    hot: q.hot,
    overview: {
      passYds: q.passYds.toFixed(1),
      td: String(q.tdSeason),
      int: String(q.intSeason),
      compPct: `${q.compPct.toFixed(1)}%`,
      rating: q.rating.toFixed(1),
      sacks: String(q.sacksSeason),
    },
    advanced: {
      airYards: airYardsPerG.toFixed(1),
      yac: yac.toFixed(1),
      aDot,
      pressurePct: `${pressurePct.toFixed(1)}%`,
      cpoe: `${cpoe >= 0 ? '+' : ''}${cpoe.toFixed(1)}%`,
      badThrowPct: `${badThrowPct.toFixed(1)}%`,
    },
    last3,
    bet: {
      passYds: { rec: rec(base), pct: base, label: `Over ${passYdsLine} Pass Yds` },
      completions: { rec: rec(base - 4), pct: base - 4, label: `Over ${compLine} Completions` },
      tdOver: { rec: rec(tdPerG >= 1.6 ? base + 5 : base - 8), pct: tdPerG >= 1.6 ? base + 5 : base - 8, label: 'Over 1.5 Pass TDs' },
      interceptions: { rec: rec(intPerG <= 0.5 ? base + 10 : base - 10), pct: intPerG <= 0.5 ? base + 10 : base - 10, label: 'Under 0.5 INT' },
    },
  }
}

export const nflPassingData: Record<string, { away: QBPassingDetail; home: QBPassingDetail }> = {
  nfl1: {
    away: buildQB({
      name: 'Josh Allen', hot: false, rating: 94.8, passYds: 265.4, compPct: 63.1, tdSeason: 24, intSeason: 9, sacksSeason: 22,
      games: [{ opp: 'MIA', date: 'Jan 5', result: 'W' }, { opp: 'NE', date: 'Dec 29', result: 'W' }, { opp: 'LAC', date: 'Dec 22', result: 'L' }],
    }),
    home: buildQB({
      name: 'Patrick Mahomes', hot: true, rating: 108.4, passYds: 312.4, compPct: 68.9, tdSeason: 31, intSeason: 6, sacksSeason: 18,
      games: [{ opp: 'LV', date: 'Jan 5', result: 'W' }, { opp: 'CIN', date: 'Dec 29', result: 'W' }, { opp: 'LAC', date: 'Dec 22', result: 'W' }],
    }),
  },
  nfl2: {
    away: buildQB({
      name: 'Jalen Hurts', hot: true, rating: 101.2, passYds: 241.8, compPct: 66.4, tdSeason: 22, intSeason: 7, sacksSeason: 28,
      games: [{ opp: 'NYG', date: 'Jan 5', result: 'W' }, { opp: 'ARI', date: 'Dec 29', result: 'W' }, { opp: 'SF', date: 'Dec 22', result: 'L' }],
    }),
    home: buildQB({
      name: 'Dak Prescott', hot: false, rating: 92.5, passYds: 258.2, compPct: 64.8, tdSeason: 19, intSeason: 10, sacksSeason: 24,
      games: [{ opp: 'WAS', date: 'Jan 5', result: 'L' }, { opp: 'DET', date: 'Dec 29', result: 'W' }, { opp: 'MIA', date: 'Dec 22', result: 'L' }],
    }),
  },
  nfl3: {
    away: buildQB({
      name: 'Brock Purdy', hot: true, rating: 105.8, passYds: 248.6, compPct: 69.4, tdSeason: 26, intSeason: 8, sacksSeason: 20,
      games: [{ opp: 'ARI', date: 'Jan 5', result: 'W' }, { opp: 'WAS', date: 'Dec 29', result: 'W' }, { opp: 'SEA', date: 'Dec 22', result: 'W' }],
    }),
    home: buildQB({
      name: 'Matthew Stafford', hot: false, rating: 94.1, passYds: 262.4, compPct: 64.2, tdSeason: 21, intSeason: 11, sacksSeason: 32,
      games: [{ opp: 'SEA', date: 'Jan 5', result: 'L' }, { opp: 'NYG', date: 'Dec 29', result: 'W' }, { opp: 'NO', date: 'Dec 22', result: 'L' }],
    }),
  },
  nfl4: {
    away: buildQB({
      name: 'Lamar Jackson', hot: true, rating: 104.5, passYds: 224.6, compPct: 66.8, tdSeason: 28, intSeason: 6, sacksSeason: 24,
      games: [{ opp: 'PIT', date: 'Jan 5', result: 'L' }, { opp: 'SF', date: 'Dec 29', result: 'W' }, { opp: 'CLE', date: 'Dec 22', result: 'W' }],
    }),
    home: buildQB({
      name: 'Joe Burrow', hot: false, rating: 96.2, passYds: 271.2, compPct: 65.1, tdSeason: 24, intSeason: 9, sacksSeason: 30,
      games: [{ opp: 'PIT', date: 'Jan 5', result: 'W' }, { opp: 'DEN', date: 'Dec 29', result: 'L' }, { opp: 'KC', date: 'Dec 22', result: 'L' }],
    }),
  },
  nfl5: {
    away: buildQB({
      name: 'Jared Goff', hot: true, rating: 106.3, passYds: 278.4, compPct: 68.2, tdSeason: 29, intSeason: 7, sacksSeason: 26,
      games: [{ opp: 'MIN', date: 'Jan 5', result: 'W' }, { opp: 'DAL', date: 'Dec 29', result: 'L' }, { opp: 'CHI', date: 'Dec 22', result: 'W' }],
    }),
    home: buildQB({
      name: 'Jordan Love', hot: false, rating: 91.8, passYds: 245.1, compPct: 62.4, tdSeason: 20, intSeason: 11, sacksSeason: 34,
      games: [{ opp: 'CHI', date: 'Jan 5', result: 'W' }, { opp: 'MIN', date: 'Dec 29', result: 'L' }, { opp: 'TB', date: 'Dec 22', result: 'W' }],
    }),
  },
}
