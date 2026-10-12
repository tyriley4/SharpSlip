export interface PendingBet {
  bet: string
  type: string
  stake: number
  odds: string
}

export interface HistoryBet {
  id: number
  bet: string
  date: string
  type: string
  odds: string
  stake: number
  result: 'W' | 'L' | 'P'
  profit: number
}

export const pendingBets: PendingBet[] = [
  { bet: 'KC -3 Cover', type: 'Spread', stake: 50, odds: '-110' },
  { bet: 'Kelce Rec Yds Over 54.5', type: 'Player Prop', stake: 25, odds: '-118' },
  { bet: 'Cole K8.5+ / Under 8.5', type: 'Parlay', stake: 25, odds: '+245' },
]

export const betHistory: HistoryBet[] = [
  { id: 1, bet: 'KC -3 Cover', date: 'Jan 5', type: 'Spread', odds: '-110', stake: 50, result: 'W', profit: 45 },
  { id: 2, bet: 'Kelce Over 54.5 Rec Yds', date: 'Jan 5', type: 'Player Prop', odds: '-115', stake: 30, result: 'W', profit: 26 },
  { id: 3, bet: 'BUF/KC Under 47.5', date: 'Jan 5', type: 'Total', odds: '-108', stake: 40, result: 'W', profit: 37 },
  { id: 4, bet: 'Josh Allen Pass Yds O284.5', date: 'Jan 5', type: 'Player Prop', odds: '-112', stake: 25, result: 'L', profit: -25 },
  { id: 5, bet: 'Cole Over 8.5 K', date: 'Jun 21', type: 'Player Prop', odds: '-118', stake: 50, result: 'W', profit: 42 },
  { id: 6, bet: 'NYY/BOS Under 8.5', date: 'Jun 21', type: 'Total', odds: '-110', stake: 30, result: 'W', profit: 27 },
  { id: 7, bet: 'LAD ML', date: 'Jun 20', type: 'ML', odds: '-145', stake: 50, result: 'L', profit: -50 },
]

export const betStats = {
  winRate: 69,
  streak: { type: 'W', count: 2 },
  units: 7.8,
}

export interface FavoriteBetType {
  type: string
  count: number
  hitRate: number
  icon: string
}

export const favoriteBetTypes: FavoriteBetType[] = [
  { type: 'Player Props', count: 18, hitRate: 72, icon: '🎯' },
  { type: 'Spreads', count: 8, hitRate: 63, icon: '📈' },
  { type: 'Totals', count: 10, hitRate: 60, icon: '📋' },
  { type: 'Parlays', count: 4, hitRate: 25, icon: '🏦' },
]

export interface FavoriteTeam {
  abbr: string
  name: string
  bets: number
  mlRecord: string
  atsRecord: string
  hot: boolean
}

export const favoriteTeams: FavoriteTeam[] = [
  { abbr: 'KC', name: 'Kansas City Chiefs', bets: 8, mlRecord: '6-2', atsRecord: '5-3', hot: true },
  { abbr: 'NYY', name: 'New York Yankees', bets: 8, mlRecord: '5-3', atsRecord: '6-2', hot: true },
  { abbr: 'BUF', name: 'Buffalo Bills', bets: 5, mlRecord: '3-2', atsRecord: '4-1', hot: false },
  { abbr: 'LAD', name: 'Los Angeles Dodgers', bets: 5, mlRecord: '3-2', atsRecord: '2-3', hot: false },
]

export interface FavoritePlayer {
  name: string
  prop: string
  bets: number
  hitRate: number
  streak: string
  hot: boolean
}

export const favoritePlayers: FavoritePlayer[] = [
  { name: 'Travis Kelce', prop: 'Over 54.5 Rec Yds', bets: 4, hitRate: 77, streak: 'W3', hot: true },
  { name: 'Gerrit Cole', prop: 'Over 8.5 K', bets: 4, hitRate: 75, streak: 'W3', hot: true },
  { name: 'Patrick Mahomes', prop: 'Pass Yds O284.5', bets: 3, hitRate: 73, streak: 'W2', hot: true },
  { name: 'Juan Soto', prop: 'Anytime Hit', bets: 3, hitRate: 100, streak: 'W3', hot: true },
]
