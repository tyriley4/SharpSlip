import type { BatterStats } from './battingTypes'
import { mlbBattingData } from './mlbBatting'
import type { Reliever, StarterDetail, TeamBullpen } from './pitchingTypes'

type RawStarter = Omit<StarterDetail, 'vsLineup'>

function bullpen(
  health: number,
  status: string,
  teamStats: TeamBullpen['teamStats'],
  last5: TeamBullpen['last5'],
  pitchers: Reliever[]
): TeamBullpen {
  return { health, status, teamStats, last5, pitchers }
}

function seed(name: string): number {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 97
  return h
}

function vsLineupFrom(lineup: BatterStats[]): StarterDetail['vsLineup'] {
  return lineup.map((b) => {
    const s = seed(b.name)
    const ab = 14 + (s % 8)
    const avgNum = parseFloat(b.std.avg)
    const h = Math.max(0, Math.min(ab, Math.round(avgNum * ab + ((s % 3) - 1))))
    const hr = s % 11 === 0 ? 1 : 0
    const k = Math.max(1, Math.round((b.adv.kpct / 100) * ab))
    return {
      name: b.name.split(',')[0],
      pos: b.pos,
      avg: (h / ab).toFixed(3).replace(/^0/, ''),
      ab,
      h,
      hr,
      k,
    }
  })
}

const mlbPitchingRaw: Record<
  string,
  { starters: { away: RawStarter; home: RawStarter }; bullpen: { away: TeamBullpen; home: TeamBullpen } }
> = {
  '1': {
    starters: {
      away: {
        name: 'Brayan Bello', hot: false, avgIP: '5.4', qsPct: '52%',
        era: '3.84', fip: '4.18', xfip: '4.61', siera: '4.44',
        k9: '8.4', bb9: '3.2', whip: '1.28', csw: '27.4%', kbb: '12.8%',
        arsenal: { FB: '52.1%', SL: '24.8%', CH: '14.4%', CB: '8.7%' },
        contact: { hardHit: '42.8%', barrel: '9.4%', exitVelo: '91.8 mph', gb: '42.1%', strand: '68.4%' },
        splits: { vsLHH: { era: '3.24', avg: '.241' }, vsRHH: { era: '4.44', avg: '.298' }, homeEra: '3.41', awayEra: '4.28' },
        last3: [
          { opp: 'TB', date: 'Start 3', ip: '5.2', er: 2, k: 6, bb: 2, result: 'W' },
          { opp: 'BAL', date: 'Start 2', ip: '4.1', er: 5, k: 4, bb: 3, result: 'L' },
          { opp: 'NYY', date: 'Start 1', ip: '5.0', er: 3, k: 7, bb: 2, result: 'L' },
        ],
        bet: {
          kOver: { rec: '14-8', pct: 64, line: 'Over 7.5 K' },
          kUnder: { rec: '8-14', pct: 36, line: 'Under 7.5 K' },
          win: { rec: '8-14', pct: 36, line: 'Win prop -145' },
          nrfi: { rec: '12-10', pct: 55, line: 'NRFI -118' },
          outs: { rec: '11-11', pct: 50, line: 'Over 15.5 outs' },
        },
      },
      home: {
        name: 'Gerrit Cole', hot: true, avgIP: '6.8', qsPct: '74%',
        era: '2.91', fip: '2.44', xfip: '2.88', siera: '2.76',
        k9: '11.4', bb9: '1.8', whip: '0.97', csw: '34.1%', kbb: '22.8%',
        arsenal: { FF: '54.2%', SL: '21.3%', CH: '15.8%', CU: '8.7%' },
        contact: { hardHit: '28.2%', barrel: '4.1%', exitVelo: '87.3 mph', gb: '38.4%', strand: '82.1%' },
        splits: { vsLHH: { era: '2.44', avg: '.198' }, vsRHH: { era: '3.28', avg: '.241' }, homeEra: '2.11', awayEra: '3.44' },
        last3: [
          { opp: 'BOS', date: 'Start 3', ip: '7.0', er: 2, k: 11, bb: 1, result: 'W' },
          { opp: 'TB', date: 'Start 2', ip: '6.1', er: 1, k: 9, bb: 2, result: 'W' },
          { opp: 'BOS', date: 'Start 1', ip: '7.2', er: 2, k: 10, bb: 0, result: 'W' },
        ],
        bet: {
          kOver: { rec: '19-6', pct: 76, line: 'Over 8.5 K' },
          kUnder: { rec: '6-19', pct: 24, line: 'Under 8.5 K' },
          win: { rec: '12-6', pct: 67, line: 'Win prop -165' },
          nrfi: { rec: '14-8', pct: 64, line: 'NRFI -135' },
          outs: { rec: '16-8', pct: 67, line: 'Over 17.5 outs' },
        },
      },
    },
    bullpen: {
      away: bullpen(62, 'Taxed', { era: '4.21', eraRank: 22, whip: '1.38', whipRank: 24, k9: '9.1', k9Rank: 14, sv: '14', hold: '28', blowSv: '6', oppAvg: '.248' }, ['W', 'W', 'L', 'L', 'W'], [
        { name: 'Chris Martin', role: 'CL', hand: 'RHP', status: 'taxed', lastUsed: 'Yesterday', rest: '1d rest', era: '2.14', whip: '0.98', k9: '10.2', bb9: '2.1', hold: '88%', last5: ['W', 'W', 'L', 'L', 'W'], trend: 'up' },
        { name: 'Josh Winckowski', role: 'SU', hand: 'RHP', status: 'taxed', lastUsed: 'Yesterday', rest: '1d rest', era: '3.44', whip: '1.12', k9: '8.4', bb9: '3.1', hold: '72%', last5: ['W', 'L', 'W', 'L', 'W'], trend: 'down' },
        { name: 'Kaleb Ort', role: 'MR', hand: 'RHP', status: 'rested', lastUsed: '3 days ago', rest: '3d rest', era: '4.21', whip: '1.31', k9: '7.8', bb9: '3.4', hold: '58%', last5: ['L', 'W', 'W', 'L', 'W'], trend: 'neutral' },
      ]),
      home: bullpen(84, 'Fresh', { era: '2.88', eraRank: 4, whip: '1.08', whipRank: 5, k9: '10.4', k9Rank: 6, sv: '18', hold: '34', blowSv: '3', oppAvg: '.218' }, ['W', 'W', 'W', 'L', 'W'], [
        { name: 'Clay Holmes', role: 'CL', hand: 'RHP', status: 'rested', lastUsed: '2 days ago', rest: '2d rest', era: '1.84', whip: '0.88', k9: '11.2', bb9: '1.8', hold: '91%', last5: ['W', 'W', 'W', 'W', 'W'], trend: 'up' },
        { name: 'Tommy Kahnle', role: 'SU', hand: 'RHP', status: 'used', lastUsed: 'Yesterday', rest: '1d rest', era: '2.44', whip: '0.94', k9: '12.1', bb9: '2.1', hold: '84%', last5: ['W', 'W', 'W', 'L', 'W'], trend: 'up' },
        { name: 'Ian Hamilton', role: 'MR', hand: 'RHP', status: 'used', lastUsed: '2 days ago', rest: '2d rest', era: '3.28', whip: '1.06', k9: '9.8', bb9: '2.6', hold: '74%', last5: ['W', 'W', 'W', 'W', 'L'], trend: 'up' },
      ]),
    },
  },

  '2': {
    starters: {
      away: {
        name: 'Tyler Glasnow', hot: true, avgIP: '6.1', qsPct: '68%',
        era: '3.05', fip: '2.98', xfip: '3.10', siera: '2.95',
        k9: '12.1', bb9: '2.4', whip: '1.05', csw: '33.2%', kbb: '25.4%',
        arsenal: { FB: '48.4%', CV: '28.1%', SL: '14.8%', CH: '8.7%' },
        contact: { hardHit: '35.4%', barrel: '6.8%', exitVelo: '89.1 mph', gb: '41.4%', strand: '78.1%' },
        splits: { vsLHH: { era: '2.88', avg: '.211' }, vsRHH: { era: '3.21', avg: '.238' }, homeEra: '3.41', awayEra: '2.81' },
        last3: [
          { opp: 'SD', date: 'Start 3', ip: '6.0', er: 2, k: 9, bb: 1, result: 'W' },
          { opp: 'ARI', date: 'Start 2', ip: '6.2', er: 1, k: 11, bb: 2, result: 'W' },
          { opp: 'SF', date: 'Start 1', ip: '5.1', er: 3, k: 8, bb: 3, result: 'L' },
        ],
        bet: {
          kOver: { rec: '16-7', pct: 70, line: 'Over 9.5 K' },
          kUnder: { rec: '7-16', pct: 30, line: 'Under 9.5 K' },
          win: { rec: '11-8', pct: 58, line: 'Win prop -130' },
          nrfi: { rec: '13-9', pct: 59, line: 'NRFI -125' },
          outs: { rec: '13-9', pct: 59, line: 'Over 17.5 outs' },
        },
      },
      home: {
        name: 'Logan Webb', hot: false, avgIP: '6.4', qsPct: '61%',
        era: '3.15', fip: '3.40', xfip: '3.55', siera: '3.48',
        k9: '8.2', bb9: '2.1', whip: '1.12', csw: '29.8%', kbb: '15.1%',
        arsenal: { SI: '44.8%', SL: '24.1%', CH: '18.4%', CV: '12.7%' },
        contact: { hardHit: '38.1%', barrel: '7.4%', exitVelo: '90.4 mph', gb: '54.8%', strand: '73.4%' },
        splits: { vsLHH: { era: '3.44', avg: '.258' }, vsRHH: { era: '2.91', avg: '.228' }, homeEra: '2.84', awayEra: '3.51' },
        last3: [
          { opp: 'ARI', date: 'Start 3', ip: '6.2', er: 2, k: 6, bb: 1, result: 'W' },
          { opp: 'COL', date: 'Start 2', ip: '7.0', er: 1, k: 8, bb: 0, result: 'W' },
          { opp: 'LAD', date: 'Start 1', ip: '5.1', er: 4, k: 5, bb: 2, result: 'L' },
        ],
        bet: {
          kOver: { rec: '9-14', pct: 39, line: 'Over 6.5 K' },
          kUnder: { rec: '14-9', pct: 61, line: 'Under 6.5 K' },
          win: { rec: '10-11', pct: 48, line: 'Win prop -110' },
          nrfi: { rec: '15-8', pct: 65, line: 'NRFI -140' },
          outs: { rec: '14-9', pct: 61, line: 'Over 18.5 outs' },
        },
      },
    },
    bullpen: {
      away: bullpen(76, 'Fresh', { era: '3.24', eraRank: 9, whip: '1.14', whipRank: 8, k9: '9.8', k9Rank: 9, sv: '16', hold: '31', blowSv: '4', oppAvg: '.231' }, ['W', 'W', 'L', 'W', 'W'], [
        { name: 'Blake Treinen', role: 'CL', hand: 'RHP', status: 'rested', lastUsed: '2 days ago', rest: '2d rest', era: '2.44', whip: '1.01', k9: '10.8', bb9: '3.1', hold: '84%', last5: ['W', 'W', 'W', 'L', 'W'], trend: 'up' },
        { name: 'Evan Phillips', role: 'SU', hand: 'RHP', status: 'used', lastUsed: 'Yesterday', rest: '1d rest', era: '2.81', whip: '0.98', k9: '11.4', bb9: '2.8', hold: '81%', last5: ['W', 'W', 'L', 'W', 'W'], trend: 'up' },
        { name: 'Alex Vesia', role: 'SU', hand: 'LHP', status: 'rested', lastUsed: '3 days ago', rest: '3d rest', era: '3.18', whip: '1.11', k9: '10.1', bb9: '3.4', hold: '71%', last5: ['L', 'W', 'W', 'W', 'L'], trend: 'neutral' },
      ]),
      home: bullpen(58, 'Taxed', { era: '4.05', eraRank: 19, whip: '1.34', whipRank: 21, k9: '8.8', k9Rank: 18, sv: '13', hold: '26', blowSv: '5', oppAvg: '.254' }, ['L', 'W', 'L', 'W', 'L'], [
        { name: 'Camilo Doval', role: 'CL', hand: 'RHP', status: 'taxed', lastUsed: 'Yesterday', rest: '1d rest', era: '3.14', whip: '1.24', k9: '10.4', bb9: '4.1', hold: '76%', last5: ['L', 'W', 'L', 'W', 'L'], trend: 'down' },
        { name: 'Tyler Rogers', role: 'SU', hand: 'RHP', status: 'used', lastUsed: 'Yesterday', rest: '1d rest', era: '3.41', whip: '1.18', k9: '7.4', bb9: '2.4', hold: '69%', last5: ['W', 'L', 'W', 'L', 'W'], trend: 'neutral' },
        { name: 'Taylor Rogers', role: 'MR', hand: 'LHP', status: 'rested', lastUsed: '4 days ago', rest: '4d rest', era: '4.28', whip: '1.38', k9: '8.8', bb9: '3.8', hold: '54%', last5: ['L', 'L', 'W', 'L', 'W'], trend: 'down' },
      ]),
    },
  },

  '3': {
    starters: {
      away: {
        name: 'Framber Valdez', hot: true, avgIP: '6.6', qsPct: '71%',
        era: '3.20', fip: '3.35', xfip: '3.42', siera: '3.31',
        k9: '8.9', bb9: '2.8', whip: '1.18', csw: '30.1%', kbb: '15.8%',
        arsenal: { SI: '52.4%', CV: '24.1%', CH: '14.8%', CB: '8.7%' },
        contact: { hardHit: '36.8%', barrel: '6.4%', exitVelo: '89.8 mph', gb: '61.4%', strand: '76.8%' },
        splits: { vsLHH: { era: '2.98', avg: '.221' }, vsRHH: { era: '3.44', avg: '.264' }, homeEra: '2.91', awayEra: '3.48' },
        last3: [
          { opp: 'SEA', date: 'Start 3', ip: '6.1', er: 2, k: 7, bb: 2, result: 'W' },
          { opp: 'TEX', date: 'Start 2', ip: '7.0', er: 1, k: 8, bb: 1, result: 'W' },
          { opp: 'TEX', date: 'Start 1', ip: '5.2', er: 4, k: 6, bb: 3, result: 'L' },
        ],
        bet: {
          kOver: { rec: '10-13', pct: 43, line: 'Over 7.5 K' },
          kUnder: { rec: '13-10', pct: 57, line: 'Under 7.5 K' },
          win: { rec: '13-10', pct: 57, line: 'Win prop -125' },
          nrfi: { rec: '14-9', pct: 61, line: 'NRFI -130' },
          outs: { rec: '15-8', pct: 65, line: 'Over 18.5 outs' },
        },
      },
      home: {
        name: 'Spencer Strider', hot: true, avgIP: '6.0', qsPct: '69%',
        era: '3.25', fip: '2.85', xfip: '2.95', siera: '2.81',
        k9: '13.2', bb9: '2.9', whip: '1.08', csw: '35.4%', kbb: '27.1%',
        arsenal: { FF: '58.1%', SL: '38.4%', CH: '3.5%' },
        contact: { hardHit: '33.8%', barrel: '6.1%', exitVelo: '88.4 mph', gb: '36.4%', strand: '79.8%' },
        splits: { vsLHH: { era: '3.44', avg: '.234' }, vsRHH: { era: '2.98', avg: '.198' }, homeEra: '2.71', awayEra: '3.68' },
        last3: [
          { opp: 'MIA', date: 'Start 3', ip: '6.0', er: 3, k: 12, bb: 2, result: 'W' },
          { opp: 'MIA', date: 'Start 2', ip: '6.1', er: 1, k: 13, bb: 1, result: 'W' },
          { opp: 'NYM', date: 'Start 1', ip: '5.2', er: 4, k: 10, bb: 3, result: 'L' },
        ],
        bet: {
          kOver: { rec: '18-7', pct: 72, line: 'Over 10.5 K' },
          kUnder: { rec: '7-18', pct: 28, line: 'Under 10.5 K' },
          win: { rec: '14-7', pct: 67, line: 'Win prop -150' },
          nrfi: { rec: '15-10', pct: 60, line: 'NRFI -128' },
          outs: { rec: '13-10', pct: 57, line: 'Over 16.5 outs' },
        },
      },
    },
    bullpen: {
      away: bullpen(70, 'Fresh', { era: '3.68', eraRank: 13, whip: '1.24', whipRank: 15, k9: '9.4', k9Rank: 12, sv: '15', hold: '29', blowSv: '5', oppAvg: '.238' }, ['W', 'L', 'W', 'W', 'L'], [
        { name: 'Josh Hader', role: 'CL', hand: 'LHP', status: 'rested', lastUsed: '2 days ago', rest: '2d rest', era: '2.61', whip: '1.04', k9: '13.1', bb9: '3.8', hold: '86%', last5: ['W', 'W', 'W', 'L', 'W'], trend: 'up' },
        { name: 'Bryan Abreu', role: 'SU', hand: 'RHP', status: 'used', lastUsed: 'Yesterday', rest: '1d rest', era: '3.04', whip: '1.14', k9: '12.8', bb9: '4.1', hold: '78%', last5: ['W', 'L', 'W', 'W', 'W'], trend: 'up' },
        { name: 'Ryan Pressly', role: 'SU', hand: 'RHP', status: 'rested', lastUsed: '3 days ago', rest: '3d rest', era: '3.81', whip: '1.21', k9: '9.4', bb9: '2.8', hold: '68%', last5: ['L', 'W', 'L', 'W', 'L'], trend: 'neutral' },
      ]),
      home: bullpen(81, 'Fresh', { era: '3.11', eraRank: 7, whip: '1.11', whipRank: 6, k9: '10.8', k9Rank: 5, sv: '17', hold: '33', blowSv: '3', oppAvg: '.224' }, ['W', 'W', 'W', 'W', 'L'], [
        { name: 'Raisel Iglesias', role: 'CL', hand: 'RHP', status: 'rested', lastUsed: '2 days ago', rest: '2d rest', era: '2.34', whip: '0.94', k9: '11.4', bb9: '2.1', hold: '89%', last5: ['W', 'W', 'W', 'W', 'W'], trend: 'up' },
        { name: 'Pierce Johnson', role: 'SU', hand: 'RHP', status: 'used', lastUsed: 'Yesterday', rest: '1d rest', era: '2.98', whip: '1.02', k9: '11.8', bb9: '2.9', hold: '81%', last5: ['W', 'W', 'L', 'W', 'W'], trend: 'up' },
        { name: 'A.J. Minter', role: 'SU', hand: 'LHP', status: 'rested', lastUsed: '3 days ago', rest: '3d rest', era: '3.28', whip: '1.18', k9: '10.4', bb9: '3.4', hold: '74%', last5: ['W', 'L', 'W', 'W', 'L'], trend: 'neutral' },
      ]),
    },
  },

  '4': {
    starters: {
      away: {
        name: 'Kevin Gausman', hot: false, avgIP: '5.9', qsPct: '55%',
        era: '3.55', fip: '3.48', xfip: '3.51', siera: '3.44',
        k9: '10.2', bb9: '2.2', whip: '1.15', csw: '31.2%', kbb: '21.4%',
        arsenal: { SP: '38.4%', FF: '34.1%', SL: '18.4%', SI: '9.1%' },
        contact: { hardHit: '39.4%', barrel: '8.1%', exitVelo: '90.1 mph', gb: '39.8%', strand: '71.4%' },
        splits: { vsLHH: { era: '3.28', avg: '.238' }, vsRHH: { era: '3.81', avg: '.271' }, homeEra: '3.68', awayEra: '3.41' },
        last3: [
          { opp: 'BAL', date: 'Start 3', ip: '5.2', er: 3, k: 7, bb: 1, result: 'L' },
          { opp: 'NYY', date: 'Start 2', ip: '6.1', er: 2, k: 8, bb: 2, result: 'W' },
          { opp: 'BOS', date: 'Start 1', ip: '5.0', er: 4, k: 6, bb: 3, result: 'L' },
        ],
        bet: {
          kOver: { rec: '15-8', pct: 65, line: 'Over 6.5 K' },
          kUnder: { rec: '8-15', pct: 35, line: 'Under 6.5 K' },
          win: { rec: '9-14', pct: 39, line: 'Win prop +105' },
          nrfi: { rec: '11-12', pct: 48, line: 'NRFI -105' },
          outs: { rec: '10-13', pct: 43, line: 'Over 16.5 outs' },
        },
      },
      home: {
        name: 'John Means', hot: false, avgIP: '5.2', qsPct: '44%',
        era: '4.05', fip: '4.21', xfip: '4.18', siera: '4.11',
        k9: '7.8', bb9: '2.9', whip: '1.28', csw: '26.9%', kbb: '13.8%',
        arsenal: { FF: '44.8%', CH: '28.1%', CV: '18.4%', SL: '8.7%' },
        contact: { hardHit: '41.8%', barrel: '9.4%', exitVelo: '90.8 mph', gb: '37.4%', strand: '68.1%' },
        splits: { vsLHH: { era: '3.88', avg: '.254' }, vsRHH: { era: '4.14', avg: '.278' }, homeEra: '3.74', awayEra: '4.38' },
        last3: [
          { opp: 'TOR', date: 'Start 3', ip: '5.0', er: 3, k: 5, bb: 2, result: 'W' },
          { opp: 'BOS', date: 'Start 2', ip: '4.1', er: 5, k: 4, bb: 3, result: 'L' },
          { opp: 'TB', date: 'Start 1', ip: '6.0', er: 2, k: 6, bb: 1, result: 'W' },
        ],
        bet: {
          kOver: { rec: '8-15', pct: 35, line: 'Over 5.5 K' },
          kUnder: { rec: '15-8', pct: 65, line: 'Under 5.5 K' },
          win: { rec: '10-13', pct: 43, line: 'Win prop -110' },
          nrfi: { rec: '10-13', pct: 43, line: 'NRFI -108' },
          outs: { rec: '9-14', pct: 39, line: 'Over 15.5 outs' },
        },
      },
    },
    bullpen: {
      away: bullpen(66, 'Taxed', { era: '3.94', eraRank: 17, whip: '1.28', whipRank: 18, k9: '9.1', k9Rank: 15, sv: '15', hold: '27', blowSv: '5', oppAvg: '.244' }, ['L', 'W', 'W', 'L', 'W'], [
        { name: 'Jordan Romano', role: 'CL', hand: 'RHP', status: 'taxed', lastUsed: 'Yesterday', rest: '1d rest', era: '3.14', whip: '1.18', k9: '10.4', bb9: '3.4', hold: '79%', last5: ['L', 'W', 'W', 'L', 'W'], trend: 'neutral' },
        { name: 'Erik Swanson', role: 'SU', hand: 'RHP', status: 'used', lastUsed: 'Yesterday', rest: '1d rest', era: '3.41', whip: '1.11', k9: '10.8', bb9: '2.8', hold: '76%', last5: ['W', 'L', 'W', 'W', 'L'], trend: 'neutral' },
        { name: 'Génesis Cabrera', role: 'MR', hand: 'LHP', status: 'rested', lastUsed: '3 days ago', rest: '3d rest', era: '4.11', whip: '1.34', k9: '9.4', bb9: '4.1', hold: '58%', last5: ['L', 'L', 'W', 'L', 'W'], trend: 'down' },
      ]),
      home: bullpen(72, 'Fresh', { era: '3.71', eraRank: 14, whip: '1.22', whipRank: 13, k9: '9.8', k9Rank: 10, sv: '16', hold: '29', blowSv: '4', oppAvg: '.236' }, ['W', 'W', 'L', 'W', 'W'], [
        { name: 'Craig Kimbrel', role: 'CL', hand: 'RHP', status: 'rested', lastUsed: '2 days ago', rest: '2d rest', era: '2.98', whip: '1.14', k9: '12.4', bb9: '4.4', hold: '81%', last5: ['W', 'W', 'W', 'W', 'L'], trend: 'up' },
        { name: 'Yennier Cano', role: 'SU', hand: 'RHP', status: 'used', lastUsed: 'Yesterday', rest: '1d rest', era: '3.21', whip: '1.08', k9: '9.1', bb9: '2.4', hold: '78%', last5: ['W', 'L', 'W', 'W', 'W'], trend: 'up' },
        { name: 'Danny Coulombe', role: 'MR', hand: 'LHP', status: 'rested', lastUsed: '4 days ago', rest: '4d rest', era: '3.44', whip: '1.16', k9: '9.8', bb9: '2.8', hold: '71%', last5: ['W', 'W', 'L', 'W', 'W'], trend: 'up' },
      ]),
    },
  },

  '5': {
    starters: {
      away: {
        name: 'Dane Dunning', hot: false, avgIP: '5.6', qsPct: '48%',
        era: '3.98', fip: '4.05', xfip: '4.11', siera: '4.02',
        k9: '7.4', bb9: '2.6', whip: '1.24', csw: '27.8%', kbb: '14.1%',
        arsenal: { SI: '48.4%', SL: '28.1%', CH: '14.8%', CB: '8.7%' },
        contact: { hardHit: '40.1%', barrel: '8.4%', exitVelo: '90.4 mph', gb: '48.8%', strand: '70.1%' },
        splits: { vsLHH: { era: '3.71', avg: '.248' }, vsRHH: { era: '4.18', avg: '.271' }, homeEra: '3.84', awayEra: '4.11' },
        last3: [
          { opp: 'HOU', date: 'Start 3', ip: '5.0', er: 3, k: 4, bb: 2, result: 'L' },
          { opp: 'HOU', date: 'Start 2', ip: '6.0', er: 2, k: 6, bb: 1, result: 'W' },
          { opp: 'SEA', date: 'Start 1', ip: '5.1', er: 3, k: 5, bb: 3, result: 'L' },
        ],
        bet: {
          kOver: { rec: '9-14', pct: 39, line: 'Over 5.5 K' },
          kUnder: { rec: '14-9', pct: 61, line: 'Under 5.5 K' },
          win: { rec: '9-14', pct: 39, line: 'Win prop +110' },
          nrfi: { rec: '11-12', pct: 48, line: 'NRFI -102' },
          outs: { rec: '10-13', pct: 43, line: 'Over 15.5 outs' },
        },
      },
      home: {
        name: 'Shane McClanahan', hot: true, avgIP: '6.4', qsPct: '73%',
        era: '2.78', fip: '2.65', xfip: '2.70', siera: '2.61',
        k9: '11.8', bb9: '2.0', whip: '0.99', csw: '33.8%', kbb: '24.8%',
        arsenal: { FF: '48.1%', CH: '24.4%', CV: '18.7%', SL: '8.8%' },
        contact: { hardHit: '31.4%', barrel: '5.1%', exitVelo: '87.8 mph', gb: '41.8%', strand: '81.4%' },
        splits: { vsLHH: { era: '2.44', avg: '.208' }, vsRHH: { era: '2.94', avg: '.231' }, homeEra: '2.41', awayEra: '3.14' },
        last3: [
          { opp: 'TEX', date: 'Start 3', ip: '6.1', er: 2, k: 10, bb: 1, result: 'W' },
          { opp: 'HOU', date: 'Start 2', ip: '5.2', er: 3, k: 8, bb: 2, result: 'L' },
          { opp: 'KC', date: 'Start 1', ip: '7.0', er: 1, k: 11, bb: 1, result: 'W' },
        ],
        bet: {
          kOver: { rec: '17-8', pct: 68, line: 'Over 8.5 K' },
          kUnder: { rec: '8-17', pct: 32, line: 'Under 8.5 K' },
          win: { rec: '15-8', pct: 65, line: 'Win prop -140' },
          nrfi: { rec: '16-9', pct: 64, line: 'NRFI -132' },
          outs: { rec: '15-10', pct: 60, line: 'Over 18.5 outs' },
        },
      },
    },
    bullpen: {
      away: bullpen(64, 'Taxed', { era: '4.14', eraRank: 20, whip: '1.31', whipRank: 20, k9: '8.8', k9Rank: 17, sv: '13', hold: '25', blowSv: '6', oppAvg: '.251' }, ['L', 'L', 'W', 'W', 'L'], [
        { name: 'Kirby Yates', role: 'CL', hand: 'RHP', status: 'taxed', lastUsed: 'Yesterday', rest: '1d rest', era: '3.04', whip: '1.09', k9: '11.8', bb9: '3.1', hold: '82%', last5: ['L', 'W', 'W', 'L', 'W'], trend: 'neutral' },
        { name: 'Josh Sborz', role: 'SU', hand: 'RHP', status: 'used', lastUsed: 'Yesterday', rest: '1d rest', era: '3.61', whip: '1.24', k9: '9.8', bb9: '3.8', hold: '71%', last5: ['L', 'L', 'W', 'W', 'L'], trend: 'down' },
        { name: 'Cody Bradford', role: 'MR', hand: 'LHP', status: 'rested', lastUsed: '4 days ago', rest: '4d rest', era: '4.41', whip: '1.38', k9: '8.1', bb9: '3.4', hold: '54%', last5: ['L', 'W', 'L', 'L', 'W'], trend: 'down' },
      ]),
      home: bullpen(88, 'Fresh', { era: '2.94', eraRank: 3, whip: '1.06', whipRank: 4, k9: '10.9', k9Rank: 4, sv: '19', hold: '36', blowSv: '2', oppAvg: '.214' }, ['W', 'W', 'W', 'W', 'W'], [
        { name: 'Pete Fairbanks', role: 'CL', hand: 'RHP', status: 'rested', lastUsed: '2 days ago', rest: '2d rest', era: '2.11', whip: '0.91', k9: '12.8', bb9: '2.4', hold: '92%', last5: ['W', 'W', 'W', 'W', 'W'], trend: 'up' },
        { name: 'Jason Adam', role: 'SU', hand: 'RHP', status: 'rested', lastUsed: '3 days ago', rest: '3d rest', era: '2.68', whip: '0.98', k9: '11.4', bb9: '2.8', hold: '84%', last5: ['W', 'W', 'L', 'W', 'W'], trend: 'up' },
        { name: 'Garrett Cleavinger', role: 'MR', hand: 'LHP', status: 'rested', lastUsed: '3 days ago', rest: '3d rest', era: '3.01', whip: '1.08', k9: '10.4', bb9: '3.1', hold: '76%', last5: ['W', 'W', 'W', 'L', 'W'], trend: 'up' },
      ]),
    },
  },
}

export const mlbPitchingData: Record<
  string,
  { starters: { away: StarterDetail; home: StarterDetail }; bullpen: { away: TeamBullpen; home: TeamBullpen } }
> = Object.fromEntries(
  Object.entries(mlbPitchingRaw).map(([id, game]) => [
    id,
    {
      starters: {
        away: { ...game.starters.away, vsLineup: vsLineupFrom(mlbBattingData[id].home.lineup) },
        home: { ...game.starters.home, vsLineup: vsLineupFrom(mlbBattingData[id].away.lineup) },
      },
      bullpen: game.bullpen,
    },
  ])
)
