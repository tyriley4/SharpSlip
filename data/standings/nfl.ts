import type { StandingsData } from './types'

export const nflDivisions = [
  'AFC East',
  'AFC North',
  'AFC South',
  'AFC West',
  'NFC East',
  'NFC North',
  'NFC South',
  'NFC West',
]

export const nflStandings: StandingsData = {
  'AFC East': [
    { abbr: 'BUF', w: 11, l: 6, pct: '.647', gb: '—', hot: true },
    { abbr: 'MIA', w: 9, l: 8, pct: '.529', gb: '2' },
    { abbr: 'NYJ', w: 7, l: 10, pct: '.412', gb: '4' },
    { abbr: 'NE', w: 4, l: 13, pct: '.235', gb: '7' },
  ],
  'AFC North': [
    { abbr: 'BAL', w: 13, l: 4, pct: '.765', gb: '—', hot: true },
    { abbr: 'CLE', w: 11, l: 6, pct: '.647', gb: '2' },
    { abbr: 'PIT', w: 10, l: 7, pct: '.588', gb: '3' },
    { abbr: 'CIN', w: 9, l: 8, pct: '.529', gb: '4' },
  ],
  'AFC South': [
    { abbr: 'HOU', w: 10, l: 7, pct: '.588', gb: '—', hot: true },
    { abbr: 'IND', w: 9, l: 8, pct: '.529', gb: '1' },
    { abbr: 'JAX', w: 9, l: 8, pct: '.529', gb: '1' },
    { abbr: 'TEN', w: 6, l: 11, pct: '.353', gb: '4' },
  ],
  'AFC West': [
    { abbr: 'KC', w: 11, l: 6, pct: '.647', gb: '—', hot: true },
    { abbr: 'LV', w: 8, l: 9, pct: '.471', gb: '3' },
    { abbr: 'DEN', w: 8, l: 9, pct: '.471', gb: '3' },
    { abbr: 'LAC', w: 5, l: 12, pct: '.294', gb: '6' },
  ],
  'NFC East': [
    { abbr: 'PHI', w: 11, l: 6, pct: '.647', gb: '—', hot: true },
    { abbr: 'DAL', w: 8, l: 9, pct: '.471', gb: '3' },
    { abbr: 'WAS', w: 7, l: 10, pct: '.412', gb: '4' },
    { abbr: 'NYG', w: 5, l: 12, pct: '.294', gb: '6' },
  ],
  'NFC North': [
    { abbr: 'DET', w: 12, l: 5, pct: '.706', gb: '—', hot: true },
    { abbr: 'GB', w: 10, l: 7, pct: '.588', gb: '2' },
    { abbr: 'MIN', w: 9, l: 8, pct: '.529', gb: '3' },
    { abbr: 'CHI', w: 6, l: 11, pct: '.353', gb: '6' },
  ],
  'NFC South': [
    { abbr: 'TB', w: 9, l: 8, pct: '.529', gb: '—' },
    { abbr: 'ATL', w: 8, l: 9, pct: '.471', gb: '1' },
    { abbr: 'NO', w: 7, l: 10, pct: '.412', gb: '2' },
    { abbr: 'CAR', w: 4, l: 13, pct: '.235', gb: '5' },
  ],
  'NFC West': [
    { abbr: 'SF', w: 10, l: 7, pct: '.588', gb: '—', hot: true },
    { abbr: 'LAR', w: 9, l: 8, pct: '.529', gb: '1' },
    { abbr: 'SEA', w: 8, l: 9, pct: '.471', gb: '2' },
    { abbr: 'ARI', w: 7, l: 10, pct: '.412', gb: '3' },
  ],
}
