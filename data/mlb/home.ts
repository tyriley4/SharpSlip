export interface FeaturedEdge {
  grade: string
  confidence: number
  bet: string
  why: string
  stats: { label: string; value: string; good: boolean }[]
  line: string
}

export const featuredEdge: FeaturedEdge = {
  grade: 'A',
  confidence: 82,
  bet: 'Gerrit Cole Over 8.5 K',
  why: "Cole has cleared 8.5 Ks in 6 of his last 8 starts. Tonight he faces a BOS lineup striking out at 28.1% on the road vs RHP — the highest rate in the AL over the last 14 days.",
  stats: [
    { label: 'Cole K/9', value: '11.4', good: true },
    { label: 'BOS K Rate', value: '28.1%', good: true },
    { label: 'L8 streak', value: '6/8', good: true },
    { label: 'Ump adj', value: '-2.2%', good: false },
  ],
  line: 'Cole K 8.5+ · DK -118',
}

export interface SlateGame {
  id: string
  away: { abbr: string }
  home: { abbr: string }
  time: string
  status: 'Live' | 'Pre'
  edges: number
  total: string
  awayPitcher: string
  homePitcher: string
  winProb: number
}

export const slateGames: SlateGame[] = [
  {
    id: '1',
    away: { abbr: 'BOS' },
    home: { abbr: 'NYY' },
    time: 'LIVE',
    status: 'Live',
    edges: 3,
    total: '8.5',
    awayPitcher: 'Bello',
    homePitcher: 'Cole',
    winProb: 62,
  },
  {
    id: '2',
    away: { abbr: 'LAD' },
    home: { abbr: 'SF' },
    time: '9:45 PM',
    status: 'Pre',
    edges: 2,
    total: '7.5',
    awayPitcher: 'Glasnow',
    homePitcher: 'Webb',
    winProb: 55,
  },
  {
    id: '3',
    away: { abbr: 'HOU' },
    home: { abbr: 'ATL' },
    time: '7:20 PM',
    status: 'Pre',
    edges: 2,
    total: '8.0',
    awayPitcher: 'Valdez',
    homePitcher: 'Strider',
    winProb: 52,
  },
  {
    id: '4',
    away: { abbr: 'TOR' },
    home: { abbr: 'BAL' },
    time: '6:35 PM',
    status: 'Pre',
    edges: 1,
    total: '9.0',
    awayPitcher: 'Gausman',
    homePitcher: 'Means',
    winProb: 48,
  },
  {
    id: '5',
    away: { abbr: 'TEX' },
    home: { abbr: 'TB' },
    time: '6:40 PM',
    status: 'Pre',
    edges: 1,
    total: '7.5',
    awayPitcher: 'Dunning',
    homePitcher: 'McClanahan',
    winProb: 51,
  },
]

