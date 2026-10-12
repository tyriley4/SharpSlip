export interface NFLGame {
  id: string
  away: { abbr: string }
  home: { abbr: string }
  time: string
  network: string
  spread: string
  total: string
  awayML: string
  homeML: string
  winProb: number
  edge: string
  edgeConf: number
  edgeCount: number
}

export const nflGames: NFLGame[] = [
  {
    id: 'nfl1',
    away: { abbr: 'BUF' },
    home: { abbr: 'KC' },
    time: 'Sun 4:25 PM',
    network: 'CBS',
    spread: 'KC -3',
    total: '47.5',
    awayML: '+135',
    homeML: '-155',
    winProb: 62,
    edge: 'KC -3 Cover',
    edgeConf: 88,
    edgeCount: 3,
  },
  {
    id: 'nfl2',
    away: { abbr: 'PHI' },
    home: { abbr: 'DAL' },
    time: 'Sun 8:20 PM',
    network: 'NBC',
    spread: 'PHI -4.5',
    total: '44.5',
    awayML: '-195',
    homeML: '+165',
    winProb: 66,
    edge: 'Under 44.5',
    edgeConf: 82,
    edgeCount: 3,
  },
  {
    id: 'nfl3',
    away: { abbr: 'SF' },
    home: { abbr: 'LAR' },
    time: 'Mon 8:15 PM',
    network: 'ESPN',
    spread: 'SF -6',
    total: '46.0',
    awayML: '-245',
    homeML: '+205',
    winProb: 70,
    edge: 'SF -6 Cover',
    edgeConf: 79,
    edgeCount: 3,
  },
  {
    id: 'nfl4',
    away: { abbr: 'BAL' },
    home: { abbr: 'CIN' },
    time: 'Thu 8:15 PM',
    network: 'Prime',
    spread: 'BAL -2.5',
    total: '49.5',
    awayML: '-135',
    homeML: '+115',
    winProb: 58,
    edge: 'Over 49.5',
    edgeConf: 76,
    edgeCount: 3,
  },
  {
    id: 'nfl5',
    away: { abbr: 'DET' },
    home: { abbr: 'GB' },
    time: 'Sun 1:00 PM',
    network: 'FOX',
    spread: 'DET -1.5',
    total: '45.0',
    awayML: '-120',
    homeML: '+101',
    winProb: 54,
    edge: 'DET ML',
    edgeConf: 72,
    edgeCount: 3,
  },
]
