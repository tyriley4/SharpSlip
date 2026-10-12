import type { ReceiverDetail, RecLast3Game, TeamReceiving } from './receivingTypes'

function seed(name: string): number {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 97
  return h
}

interface RawPlayer {
  name: string
  role: string
  hot: boolean
  tgt: number
  rec: number
  yds: number
  td: number
  games: { opp: string; date: string; result: 'W' | 'L' }[]
}

function buildReceiver(p: RawPlayer): ReceiverDetail {
  const s = seed(p.name)
  const last3: RecLast3Game[] = p.games.map((g, i) => {
    const variance = ((s + i * 9) % 15) - 7
    const tgt = Math.max(1, Math.round(p.tgt + variance * 0.3))
    const rec = Math.max(0, Math.min(tgt, Math.round(p.rec + variance * 0.25)))
    const yds = Math.max(0, Math.round(p.yds + variance * 3))
    const td = g.result === 'W' ? (s + i) % 2 : 0
    return { opp: g.opp, date: g.date, tgt, rec, yds, td }
  })

  const base = p.hot ? 67 : p.yds >= 55 ? 57 : 43
  const recBase = p.hot ? 63 : p.rec >= 4.5 ? 55 : 41
  const rec = (v: number) => `${Math.round((v / 100) * 17)}-${17 - Math.round((v / 100) * 17)}`
  const recYdsLine = (Math.round(p.yds) - 4 + 0.5).toFixed(1)
  const receptionsLine = (Math.round(p.rec) - 1 + 0.5).toFixed(1)
  const tdPct = p.td >= 5 ? base + 6 : base - 12

  return {
    name: p.name,
    role: p.role,
    hot: p.hot,
    tgt: p.tgt,
    rec: p.rec,
    yds: p.yds,
    td: p.td,
    ypr: (p.yds / p.rec).toFixed(1),
    last3,
    bet: {
      recYds: { rec: rec(base), pct: base, label: `Over ${recYdsLine} Rec Yds` },
      receptions: { rec: rec(recBase), pct: recBase, label: `Over ${receptionsLine} Receptions` },
      anytimeTd: { rec: rec(tdPct), pct: Math.max(10, tdPct), label: 'Anytime TD' },
    },
  }
}

function buildTeam(targets: number, receptions: number, yds: number, drops: number, rank: number, players: RawPlayer[]): TeamReceiving {
  return {
    summary: { targets, rec: receptions, yds, drops, rank },
    players: players.map(buildReceiver),
  }
}

export const nflReceivingData: Record<string, { away: TeamReceiving; home: TeamReceiving }> = {
  nfl1: {
    away: buildTeam(33.8, 21.2, 268, 4, 12, [
      { name: 'Khalil Shakir', role: 'WR1', hot: true, tgt: 6.4, rec: 4.6, yds: 58.2, td: 4, games: [{ opp: 'MIA', date: 'Jan 5', result: 'W' }, { opp: 'NE', date: 'Dec 29', result: 'W' }, { opp: 'LAC', date: 'Dec 22', result: 'L' }] },
      { name: 'Keon Coleman', role: 'WR2', hot: false, tgt: 5.8, rec: 3.4, yds: 48.6, td: 5, games: [{ opp: 'MIA', date: 'Jan 5', result: 'W' }, { opp: 'NE', date: 'Dec 29', result: 'W' }, { opp: 'LAC', date: 'Dec 22', result: 'L' }] },
      { name: 'Dalton Kincaid', role: 'TE', hot: false, tgt: 6.8, rec: 5.1, yds: 54.8, td: 3, games: [{ opp: 'MIA', date: 'Jan 5', result: 'W' }, { opp: 'NE', date: 'Dec 29', result: 'W' }, { opp: 'LAC', date: 'Dec 22', result: 'L' }] },
      { name: 'James Cook', role: 'RB Rec', hot: false, tgt: 3.2, rec: 2.6, yds: 18.4, td: 2, games: [{ opp: 'MIA', date: 'Jan 5', result: 'W' }, { opp: 'NE', date: 'Dec 29', result: 'W' }, { opp: 'LAC', date: 'Dec 22', result: 'L' }] },
    ]),
    home: buildTeam(37.4, 24.8, 284, 3, 6, [
      { name: 'Rashee Rice', role: 'WR1', hot: true, tgt: 7.2, rec: 5.4, yds: 64.8, td: 6, games: [{ opp: 'LV', date: 'Jan 5', result: 'W' }, { opp: 'CIN', date: 'Dec 29', result: 'W' }, { opp: 'LAC', date: 'Dec 22', result: 'W' }] },
      { name: 'DeAndre Hopkins', role: 'WR2', hot: false, tgt: 5.6, rec: 3.8, yds: 46.2, td: 4, games: [{ opp: 'LV', date: 'Jan 5', result: 'W' }, { opp: 'CIN', date: 'Dec 29', result: 'W' }, { opp: 'LAC', date: 'Dec 22', result: 'W' }] },
      { name: 'Travis Kelce', role: 'TE', hot: true, tgt: 7.8, rec: 5.8, yds: 62.4, td: 5, games: [{ opp: 'LV', date: 'Jan 5', result: 'W' }, { opp: 'CIN', date: 'Dec 29', result: 'W' }, { opp: 'LAC', date: 'Dec 22', result: 'W' }] },
      { name: 'Isiah Pacheco', role: 'RB Rec', hot: false, tgt: 2.4, rec: 1.8, yds: 12.6, td: 1, games: [{ opp: 'LV', date: 'Jan 5', result: 'W' }, { opp: 'CIN', date: 'Dec 29', result: 'W' }, { opp: 'LAC', date: 'Dec 22', result: 'W' }] },
    ]),
  },
  nfl2: {
    away: buildTeam(34.6, 22.4, 258, 3, 4, [
      { name: 'A.J. Brown', role: 'WR1', hot: true, tgt: 8.4, rec: 5.8, yds: 82.6, td: 7, games: [{ opp: 'NYG', date: 'Jan 5', result: 'W' }, { opp: 'ARI', date: 'Dec 29', result: 'W' }, { opp: 'SF', date: 'Dec 22', result: 'L' }] },
      { name: 'DeVonta Smith', role: 'WR2', hot: false, tgt: 6.8, rec: 4.6, yds: 58.4, td: 5, games: [{ opp: 'NYG', date: 'Jan 5', result: 'W' }, { opp: 'ARI', date: 'Dec 29', result: 'W' }, { opp: 'SF', date: 'Dec 22', result: 'L' }] },
      { name: 'Dallas Goedert', role: 'TE', hot: false, tgt: 5.4, rec: 3.9, yds: 42.8, td: 3, games: [{ opp: 'NYG', date: 'Jan 5', result: 'W' }, { opp: 'ARI', date: 'Dec 29', result: 'W' }, { opp: 'SF', date: 'Dec 22', result: 'L' }] },
      { name: 'Saquon Barkley', role: 'RB Rec', hot: false, tgt: 2.8, rec: 2.2, yds: 16.4, td: 1, games: [{ opp: 'NYG', date: 'Jan 5', result: 'W' }, { opp: 'ARI', date: 'Dec 29', result: 'W' }, { opp: 'SF', date: 'Dec 22', result: 'L' }] },
    ]),
    home: buildTeam(35.2, 22.6, 271, 5, 15, [
      { name: 'CeeDee Lamb', role: 'WR1', hot: false, tgt: 9.2, rec: 6.4, yds: 88.4, td: 6, games: [{ opp: 'WAS', date: 'Jan 5', result: 'L' }, { opp: 'DET', date: 'Dec 29', result: 'W' }, { opp: 'MIA', date: 'Dec 22', result: 'L' }] },
      { name: 'Brandin Cooks', role: 'WR2', hot: false, tgt: 5.1, rec: 3.2, yds: 42.6, td: 3, games: [{ opp: 'WAS', date: 'Jan 5', result: 'L' }, { opp: 'DET', date: 'Dec 29', result: 'W' }, { opp: 'MIA', date: 'Dec 22', result: 'L' }] },
      { name: 'Jake Ferguson', role: 'TE', hot: false, tgt: 5.8, rec: 4.1, yds: 38.6, td: 4, games: [{ opp: 'WAS', date: 'Jan 5', result: 'L' }, { opp: 'DET', date: 'Dec 29', result: 'W' }, { opp: 'MIA', date: 'Dec 22', result: 'L' }] },
      { name: 'Rico Dowdle', role: 'RB Rec', hot: false, tgt: 2.6, rec: 2.0, yds: 13.8, td: 1, games: [{ opp: 'WAS', date: 'Jan 5', result: 'L' }, { opp: 'DET', date: 'Dec 29', result: 'W' }, { opp: 'MIA', date: 'Dec 22', result: 'L' }] },
    ]),
  },
  nfl3: {
    away: buildTeam(30.6, 19.6, 249, 3, 8, [
      { name: 'Deebo Samuel', role: 'WR1', hot: false, tgt: 6.8, rec: 4.4, yds: 58.6, td: 5, games: [{ opp: 'ARI', date: 'Jan 5', result: 'W' }, { opp: 'WAS', date: 'Dec 29', result: 'W' }, { opp: 'SEA', date: 'Dec 22', result: 'W' }] },
      { name: 'Brandon Aiyuk', role: 'WR2', hot: true, tgt: 6.2, rec: 4.0, yds: 62.8, td: 4, games: [{ opp: 'ARI', date: 'Jan 5', result: 'W' }, { opp: 'WAS', date: 'Dec 29', result: 'W' }, { opp: 'SEA', date: 'Dec 22', result: 'W' }] },
      { name: 'George Kittle', role: 'TE', hot: true, tgt: 6.4, rec: 4.6, yds: 64.2, td: 6, games: [{ opp: 'ARI', date: 'Jan 5', result: 'W' }, { opp: 'WAS', date: 'Dec 29', result: 'W' }, { opp: 'SEA', date: 'Dec 22', result: 'W' }] },
      { name: 'Christian McCaffrey', role: 'RB Rec', hot: false, tgt: 4.8, rec: 3.8, yds: 28.4, td: 3, games: [{ opp: 'ARI', date: 'Jan 5', result: 'W' }, { opp: 'WAS', date: 'Dec 29', result: 'W' }, { opp: 'SEA', date: 'Dec 22', result: 'W' }] },
    ]),
    home: buildTeam(33.4, 21.4, 262, 6, 10, [
      { name: 'Cooper Kupp', role: 'WR1', hot: false, tgt: 8.1, rec: 5.6, yds: 68.4, td: 5, games: [{ opp: 'SEA', date: 'Jan 5', result: 'L' }, { opp: 'NYG', date: 'Dec 29', result: 'W' }, { opp: 'NO', date: 'Dec 22', result: 'L' }] },
      { name: 'Puka Nacua', role: 'WR2', hot: true, tgt: 8.8, rec: 6.1, yds: 78.6, td: 5, games: [{ opp: 'SEA', date: 'Jan 5', result: 'L' }, { opp: 'NYG', date: 'Dec 29', result: 'W' }, { opp: 'NO', date: 'Dec 22', result: 'L' }] },
      { name: 'Colby Parkinson', role: 'TE', hot: false, tgt: 4.2, rec: 3.1, yds: 32.4, td: 3, games: [{ opp: 'SEA', date: 'Jan 5', result: 'L' }, { opp: 'NYG', date: 'Dec 29', result: 'W' }, { opp: 'NO', date: 'Dec 22', result: 'L' }] },
      { name: 'Kyren Williams', role: 'RB Rec', hot: false, tgt: 2.9, rec: 2.3, yds: 15.6, td: 1, games: [{ opp: 'SEA', date: 'Jan 5', result: 'L' }, { opp: 'NYG', date: 'Dec 29', result: 'W' }, { opp: 'NO', date: 'Dec 22', result: 'L' }] },
    ]),
  },
  nfl4: {
    away: buildTeam(27.8, 18.6, 225, 4, 20, [
      { name: 'Zay Flowers', role: 'WR1', hot: true, tgt: 7.4, rec: 5.1, yds: 62.8, td: 4, games: [{ opp: 'PIT', date: 'Jan 5', result: 'L' }, { opp: 'SF', date: 'Dec 29', result: 'W' }, { opp: 'CLE', date: 'Dec 22', result: 'W' }] },
      { name: 'Rashod Bateman', role: 'WR2', hot: false, tgt: 4.6, rec: 3.0, yds: 38.4, td: 3, games: [{ opp: 'PIT', date: 'Jan 5', result: 'L' }, { opp: 'SF', date: 'Dec 29', result: 'W' }, { opp: 'CLE', date: 'Dec 22', result: 'W' }] },
      { name: 'Mark Andrews', role: 'TE', hot: false, tgt: 6.2, rec: 4.4, yds: 48.6, td: 5, games: [{ opp: 'PIT', date: 'Jan 5', result: 'L' }, { opp: 'SF', date: 'Dec 29', result: 'W' }, { opp: 'CLE', date: 'Dec 22', result: 'W' }] },
      { name: 'Derrick Henry', role: 'RB Rec', hot: false, tgt: 1.8, rec: 1.4, yds: 9.8, td: 1, games: [{ opp: 'PIT', date: 'Jan 5', result: 'L' }, { opp: 'SF', date: 'Dec 29', result: 'W' }, { opp: 'CLE', date: 'Dec 22', result: 'W' }] },
    ]),
    home: buildTeam(35.8, 23.4, 271, 5, 9, [
      { name: "Ja'Marr Chase", role: 'WR1', hot: true, tgt: 9.6, rec: 6.8, yds: 92.4, td: 8, games: [{ opp: 'PIT', date: 'Jan 5', result: 'W' }, { opp: 'DEN', date: 'Dec 29', result: 'L' }, { opp: 'KC', date: 'Dec 22', result: 'L' }] },
      { name: 'Tee Higgins', role: 'WR2', hot: false, tgt: 6.4, rec: 4.2, yds: 58.6, td: 5, games: [{ opp: 'PIT', date: 'Jan 5', result: 'W' }, { opp: 'DEN', date: 'Dec 29', result: 'L' }, { opp: 'KC', date: 'Dec 22', result: 'L' }] },
      { name: 'Mike Gesicki', role: 'TE', hot: false, tgt: 4.4, rec: 3.2, yds: 34.8, td: 2, games: [{ opp: 'PIT', date: 'Jan 5', result: 'W' }, { opp: 'DEN', date: 'Dec 29', result: 'L' }, { opp: 'KC', date: 'Dec 22', result: 'L' }] },
      { name: 'Chase Brown', role: 'RB Rec', hot: false, tgt: 2.6, rec: 2.1, yds: 14.2, td: 1, games: [{ opp: 'PIT', date: 'Jan 5', result: 'W' }, { opp: 'DEN', date: 'Dec 29', result: 'L' }, { opp: 'KC', date: 'Dec 22', result: 'L' }] },
    ]),
  },
  nfl5: {
    away: buildTeam(36.2, 24.6, 278, 4, 5, [
      { name: 'Amon-Ra St. Brown', role: 'WR1', hot: true, tgt: 9.4, rec: 7.1, yds: 84.6, td: 7, games: [{ opp: 'MIN', date: 'Jan 5', result: 'W' }, { opp: 'DAL', date: 'Dec 29', result: 'L' }, { opp: 'CHI', date: 'Dec 22', result: 'W' }] },
      { name: 'Jameson Williams', role: 'WR2', hot: false, tgt: 5.8, rec: 3.6, yds: 56.8, td: 4, games: [{ opp: 'MIN', date: 'Jan 5', result: 'W' }, { opp: 'DAL', date: 'Dec 29', result: 'L' }, { opp: 'CHI', date: 'Dec 22', result: 'W' }] },
      { name: 'Sam LaPorta', role: 'TE', hot: false, tgt: 6.6, rec: 4.8, yds: 52.4, td: 5, games: [{ opp: 'MIN', date: 'Jan 5', result: 'W' }, { opp: 'DAL', date: 'Dec 29', result: 'L' }, { opp: 'CHI', date: 'Dec 22', result: 'W' }] },
      { name: 'Jahmyr Gibbs', role: 'RB Rec', hot: false, tgt: 4.2, rec: 3.4, yds: 24.6, td: 2, games: [{ opp: 'MIN', date: 'Jan 5', result: 'W' }, { opp: 'DAL', date: 'Dec 29', result: 'L' }, { opp: 'CHI', date: 'Dec 22', result: 'W' }] },
    ]),
    home: buildTeam(31.2, 19.8, 245, 5, 17, [
      { name: 'Jayden Reed', role: 'WR1', hot: false, tgt: 6.8, rec: 4.6, yds: 58.4, td: 5, games: [{ opp: 'CHI', date: 'Jan 5', result: 'W' }, { opp: 'MIN', date: 'Dec 29', result: 'L' }, { opp: 'TB', date: 'Dec 22', result: 'W' }] },
      { name: 'Christian Watson', role: 'WR2', hot: false, tgt: 5.2, rec: 3.1, yds: 48.6, td: 4, games: [{ opp: 'CHI', date: 'Jan 5', result: 'W' }, { opp: 'MIN', date: 'Dec 29', result: 'L' }, { opp: 'TB', date: 'Dec 22', result: 'W' }] },
      { name: 'Tucker Kraft', role: 'TE', hot: false, tgt: 4.6, rec: 3.4, yds: 38.2, td: 3, games: [{ opp: 'CHI', date: 'Jan 5', result: 'W' }, { opp: 'MIN', date: 'Dec 29', result: 'L' }, { opp: 'TB', date: 'Dec 22', result: 'W' }] },
      { name: 'Josh Jacobs', role: 'RB Rec', hot: false, tgt: 2.8, rec: 2.2, yds: 15.4, td: 1, games: [{ opp: 'CHI', date: 'Jan 5', result: 'W' }, { opp: 'MIN', date: 'Dec 29', result: 'L' }, { opp: 'TB', date: 'Dec 22', result: 'W' }] },
    ]),
  },
}
