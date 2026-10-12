import type { RushLast3Game, RusherDetail, TeamRushing } from './rushingTypes'

function seed(name: string): number {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 97
  return h
}

interface RawPlayer {
  name: string
  role: string
  hot: boolean
  att: number
  yds: number
  td: number
  long: number
  games: { opp: string; date: string; result: 'W' | 'L' }[]
}

function buildRusher(p: RawPlayer): RusherDetail {
  const s = seed(p.name)
  const last3: RushLast3Game[] = p.games.map((g, i) => {
    const variance = ((s + i * 11) % 17) - 8
    const att = Math.max(1, Math.round(p.att + variance * 0.3))
    const yds = Math.max(0, Math.round(p.yds + variance * 4))
    const td = g.result === 'W' ? (s + i) % 2 : 0
    return { opp: g.opp, date: g.date, att, yds, ypc: (yds / att).toFixed(1), td }
  })

  const base = p.hot ? 66 : p.role.includes('QB') ? 50 : p.yds >= 80 ? 58 : 44
  const rec = (v: number) => `${Math.round((v / 100) * 17)}-${17 - Math.round((v / 100) * 17)}`
  const rushYdsLine = (Math.round(p.yds) - 4 + 0.5).toFixed(1)
  const tdPct = p.td >= 8 ? base + 8 : base - 14

  return {
    name: p.name,
    role: p.role,
    hot: p.hot,
    att: p.att,
    yds: p.yds,
    ypc: (p.yds / p.att).toFixed(1),
    td: p.td,
    long: p.long,
    last3,
    bet: {
      rushYds: { rec: rec(base), pct: base, label: `Over ${rushYdsLine} Rush Yds` },
      anytimeTd: { rec: rec(tdPct), pct: Math.max(10, tdPct), label: 'Anytime TD' },
    },
  }
}

function buildTeam(att: number, yds: number, td: number, rank: number, players: RawPlayer[]): TeamRushing {
  return {
    summary: { att, yds, ypc: (yds / att).toFixed(1), td, rank },
    players: players.map(buildRusher),
  }
}

export const nflRushingData: Record<string, { away: TeamRushing; home: TeamRushing }> = {
  nfl1: {
    away: buildTeam(25.4, 112, 16, 14, [
      { name: 'James Cook', role: 'RB1', hot: true, att: 14.2, yds: 68.4, td: 8, long: 32, games: [{ opp: 'MIA', date: 'Jan 5', result: 'W' }, { opp: 'NE', date: 'Dec 29', result: 'W' }, { opp: 'LAC', date: 'Dec 22', result: 'L' }] },
      { name: 'Josh Allen', role: 'QB Rush', hot: false, att: 6.8, yds: 52.3, td: 7, long: 21, games: [{ opp: 'MIA', date: 'Jan 5', result: 'W' }, { opp: 'NE', date: 'Dec 29', result: 'W' }, { opp: 'LAC', date: 'Dec 22', result: 'L' }] },
      { name: 'Ty Johnson', role: 'RB2', hot: false, att: 3.1, yds: 14.8, td: 2, long: 11, games: [{ opp: 'MIA', date: 'Jan 5', result: 'W' }, { opp: 'NE', date: 'Dec 29', result: 'W' }, { opp: 'LAC', date: 'Dec 22', result: 'L' }] },
    ]),
    home: buildTeam(23.1, 98, 14, 22, [
      { name: 'Isiah Pacheco', role: 'RB1', hot: false, att: 15.8, yds: 71.2, td: 8, long: 28, games: [{ opp: 'LV', date: 'Jan 5', result: 'W' }, { opp: 'CIN', date: 'Dec 29', result: 'W' }, { opp: 'LAC', date: 'Dec 22', result: 'W' }] },
      { name: 'Patrick Mahomes', role: 'QB Rush', hot: true, att: 4.2, yds: 38.1, td: 3, long: 19, games: [{ opp: 'LV', date: 'Jan 5', result: 'W' }, { opp: 'CIN', date: 'Dec 29', result: 'W' }, { opp: 'LAC', date: 'Dec 22', result: 'W' }] },
      { name: 'Kareem Hunt', role: 'RB2', hot: false, att: 4.6, yds: 18.4, td: 3, long: 12, games: [{ opp: 'LV', date: 'Jan 5', result: 'W' }, { opp: 'CIN', date: 'Dec 29', result: 'W' }, { opp: 'LAC', date: 'Dec 22', result: 'W' }] },
    ]),
  },
  nfl2: {
    away: buildTeam(30.7, 138, 24, 3, [
      { name: 'Saquon Barkley', role: 'RB1', hot: true, att: 19.4, yds: 98.6, td: 12, long: 45, games: [{ opp: 'NYG', date: 'Jan 5', result: 'W' }, { opp: 'ARI', date: 'Dec 29', result: 'W' }, { opp: 'SF', date: 'Dec 22', result: 'L' }] },
      { name: 'Jalen Hurts', role: 'QB Rush', hot: true, att: 8.1, yds: 58.4, td: 10, long: 24, games: [{ opp: 'NYG', date: 'Jan 5', result: 'W' }, { opp: 'ARI', date: 'Dec 29', result: 'W' }, { opp: 'SF', date: 'Dec 22', result: 'L' }] },
      { name: 'Kenneth Gainwell', role: 'RB2', hot: false, att: 3.2, yds: 14.1, td: 2, long: 13, games: [{ opp: 'NYG', date: 'Jan 5', result: 'W' }, { opp: 'ARI', date: 'Dec 29', result: 'W' }, { opp: 'SF', date: 'Dec 22', result: 'L' }] },
    ]),
    home: buildTeam(22.8, 92, 12, 25, [
      { name: 'Rico Dowdle', role: 'RB1', hot: false, att: 14.6, yds: 62.8, td: 5, long: 26, games: [{ opp: 'WAS', date: 'Jan 5', result: 'L' }, { opp: 'DET', date: 'Dec 29', result: 'W' }, { opp: 'MIA', date: 'Dec 22', result: 'L' }] },
      { name: 'Ezekiel Elliott', role: 'RB2', hot: false, att: 6.2, yds: 22.4, td: 5, long: 11, games: [{ opp: 'WAS', date: 'Jan 5', result: 'L' }, { opp: 'DET', date: 'Dec 29', result: 'W' }, { opp: 'MIA', date: 'Dec 22', result: 'L' }] },
      { name: 'Dak Prescott', role: 'QB Rush', hot: false, att: 2.8, yds: 14.2, td: 2, long: 9, games: [{ opp: 'WAS', date: 'Jan 5', result: 'L' }, { opp: 'DET', date: 'Dec 29', result: 'W' }, { opp: 'MIA', date: 'Dec 22', result: 'L' }] },
    ]),
  },
  nfl3: {
    away: buildTeam(28.3, 142, 20, 2, [
      { name: 'Christian McCaffrey', role: 'RB1', hot: true, att: 20.8, yds: 108.4, td: 15, long: 38, games: [{ opp: 'ARI', date: 'Jan 5', result: 'W' }, { opp: 'WAS', date: 'Dec 29', result: 'W' }, { opp: 'SEA', date: 'Dec 22', result: 'W' }] },
      { name: 'Brock Purdy', role: 'QB Rush', hot: true, att: 3.4, yds: 22.1, td: 3, long: 14, games: [{ opp: 'ARI', date: 'Jan 5', result: 'W' }, { opp: 'WAS', date: 'Dec 29', result: 'W' }, { opp: 'SEA', date: 'Dec 22', result: 'W' }] },
      { name: 'Jordan Mason', role: 'RB2', hot: false, att: 4.1, yds: 16.8, td: 2, long: 10, games: [{ opp: 'ARI', date: 'Jan 5', result: 'W' }, { opp: 'WAS', date: 'Dec 29', result: 'W' }, { opp: 'SEA', date: 'Dec 22', result: 'W' }] },
    ]),
    home: buildTeam(22.4, 98, 12, 21, [
      { name: 'Kyren Williams', role: 'RB1', hot: false, att: 18.2, yds: 84.6, td: 10, long: 31, games: [{ opp: 'SEA', date: 'Jan 5', result: 'L' }, { opp: 'NYG', date: 'Dec 29', result: 'W' }, { opp: 'NO', date: 'Dec 22', result: 'L' }] },
      { name: 'Ronnie Rivers', role: 'RB2', hot: false, att: 2.8, yds: 11.2, td: 1, long: 9, games: [{ opp: 'SEA', date: 'Jan 5', result: 'L' }, { opp: 'NYG', date: 'Dec 29', result: 'W' }, { opp: 'NO', date: 'Dec 22', result: 'L' }] },
      { name: 'Matthew Stafford', role: 'QB Rush', hot: false, att: 1.4, yds: 4.8, td: 1, long: 6, games: [{ opp: 'SEA', date: 'Jan 5', result: 'L' }, { opp: 'NYG', date: 'Dec 29', result: 'W' }, { opp: 'NO', date: 'Dec 22', result: 'L' }] },
    ]),
  },
  nfl4: {
    away: buildTeam(31.2, 162, 26, 1, [
      { name: 'Derrick Henry', role: 'RB1', hot: true, att: 20.4, yds: 112.8, td: 16, long: 52, games: [{ opp: 'PIT', date: 'Jan 5', result: 'L' }, { opp: 'SF', date: 'Dec 29', result: 'W' }, { opp: 'CLE', date: 'Dec 22', result: 'W' }] },
      { name: 'Lamar Jackson', role: 'QB Rush', hot: true, att: 9.8, yds: 78.4, td: 8, long: 27, games: [{ opp: 'PIT', date: 'Jan 5', result: 'L' }, { opp: 'SF', date: 'Dec 29', result: 'W' }, { opp: 'CLE', date: 'Dec 22', result: 'W' }] },
      { name: 'Justice Hill', role: 'RB2', hot: false, att: 3.6, yds: 16.2, td: 2, long: 14, games: [{ opp: 'PIT', date: 'Jan 5', result: 'L' }, { opp: 'SF', date: 'Dec 29', result: 'W' }, { opp: 'CLE', date: 'Dec 22', result: 'W' }] },
    ]),
    home: buildTeam(21.3, 88, 9, 27, [
      { name: 'Chase Brown', role: 'RB1', hot: false, att: 14.8, yds: 66.2, td: 6, long: 24, games: [{ opp: 'PIT', date: 'Jan 5', result: 'W' }, { opp: 'DEN', date: 'Dec 29', result: 'L' }, { opp: 'KC', date: 'Dec 22', result: 'L' }] },
      { name: 'Zack Moss', role: 'RB2', hot: false, att: 3.9, yds: 15.4, td: 3, long: 10, games: [{ opp: 'PIT', date: 'Jan 5', result: 'W' }, { opp: 'DEN', date: 'Dec 29', result: 'L' }, { opp: 'KC', date: 'Dec 22', result: 'L' }] },
      { name: 'Joe Burrow', role: 'QB Rush', hot: false, att: 2.6, yds: 18.6, td: 2, long: 12, games: [{ opp: 'PIT', date: 'Jan 5', result: 'W' }, { opp: 'DEN', date: 'Dec 29', result: 'L' }, { opp: 'KC', date: 'Dec 22', result: 'L' }] },
    ]),
  },
  nfl5: {
    away: buildTeam(28.1, 128, 21, 6, [
      { name: 'Jahmyr Gibbs', role: 'RB1', hot: true, att: 15.2, yds: 78.4, td: 11, long: 34, games: [{ opp: 'MIN', date: 'Jan 5', result: 'W' }, { opp: 'DAL', date: 'Dec 29', result: 'L' }, { opp: 'CHI', date: 'Dec 22', result: 'W' }] },
      { name: 'David Montgomery', role: 'RB2', hot: false, att: 12.6, yds: 52.8, td: 10, long: 22, games: [{ opp: 'MIN', date: 'Jan 5', result: 'W' }, { opp: 'DAL', date: 'Dec 29', result: 'L' }, { opp: 'CHI', date: 'Dec 22', result: 'W' }] },
      { name: 'Jared Goff', role: 'QB Rush', hot: false, att: 1.2, yds: 4.1, td: 0, long: 5, games: [{ opp: 'MIN', date: 'Jan 5', result: 'W' }, { opp: 'DAL', date: 'Dec 29', result: 'L' }, { opp: 'CHI', date: 'Dec 22', result: 'W' }] },
    ]),
    home: buildTeam(26.6, 118, 15, 11, [
      { name: 'Josh Jacobs', role: 'RB1', hot: true, att: 18.6, yds: 88.4, td: 12, long: 29, games: [{ opp: 'CHI', date: 'Jan 5', result: 'W' }, { opp: 'MIN', date: 'Dec 29', result: 'L' }, { opp: 'TB', date: 'Dec 22', result: 'W' }] },
      { name: 'Jordan Love', role: 'QB Rush', hot: false, att: 3.8, yds: 21.8, td: 3, long: 15, games: [{ opp: 'CHI', date: 'Jan 5', result: 'W' }, { opp: 'MIN', date: 'Dec 29', result: 'L' }, { opp: 'TB', date: 'Dec 22', result: 'W' }] },
      { name: 'Emanuel Wilson', role: 'RB2', hot: false, att: 4.2, yds: 18.6, td: 2, long: 12, games: [{ opp: 'CHI', date: 'Jan 5', result: 'W' }, { opp: 'MIN', date: 'Dec 29', result: 'L' }, { opp: 'TB', date: 'Dec 22', result: 'W' }] },
    ]),
  },
}
