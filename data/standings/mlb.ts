import type { StandingsData } from './types'

export const mlbDivisions = ['AL East', 'AL Central', 'AL West', 'NL East', 'NL Central', 'NL West']

export const mlbStandings: StandingsData = {
  'AL East': [
    { abbr: 'NYY', w: 24, l: 10, pct: '.706', gb: '—', hot: true },
    { abbr: 'BOS', w: 20, l: 14, pct: '.588', gb: '4' },
    { abbr: 'TB', w: 18, l: 16, pct: '.529', gb: '6' },
    { abbr: 'TOR', w: 16, l: 18, pct: '.471', gb: '8' },
  ],
  'AL Central': [
    { abbr: 'CLE', w: 21, l: 13, pct: '.618', gb: '—', hot: true },
    { abbr: 'MIN', w: 19, l: 15, pct: '.559', gb: '2' },
    { abbr: 'CWS', w: 15, l: 19, pct: '.441', gb: '6' },
    { abbr: 'DET', w: 14, l: 20, pct: '.412', gb: '7' },
  ],
  'AL West': [
    { abbr: 'HOU', w: 19, l: 15, pct: '.559', gb: '—', hot: true },
    { abbr: 'TEX', w: 18, l: 16, pct: '.529', gb: '1' },
    { abbr: 'SEA', w: 17, l: 17, pct: '.500', gb: '2' },
    { abbr: 'LAA', w: 13, l: 21, pct: '.382', gb: '6' },
  ],
  'NL East': [
    { abbr: 'PHI', w: 22, l: 12, pct: '.647', gb: '—', hot: true },
    { abbr: 'NYM', w: 20, l: 14, pct: '.588', gb: '2' },
    { abbr: 'ATL', w: 18, l: 16, pct: '.529', gb: '4' },
    { abbr: 'MIA', w: 12, l: 22, pct: '.353', gb: '10' },
  ],
  'NL Central': [
    { abbr: 'STL', w: 19, l: 15, pct: '.559', gb: '—' },
    { abbr: 'CHC', w: 18, l: 16, pct: '.529', gb: '1' },
    { abbr: 'MIL', w: 17, l: 17, pct: '.500', gb: '2' },
    { abbr: 'CIN', w: 15, l: 19, pct: '.441', gb: '4' },
  ],
  'NL West': [
    { abbr: 'LAD', w: 23, l: 11, pct: '.676', gb: '—', hot: true },
    { abbr: 'SD', w: 20, l: 14, pct: '.588', gb: '3' },
    { abbr: 'SF', w: 17, l: 17, pct: '.500', gb: '6' },
    { abbr: 'ARI', w: 16, l: 18, pct: '.471', gb: '7' },
  ],
}
