import type { Sport } from '@/lib/sport/SportContext'

/** Bet-market labels the Analysis filter pills use (client-safe). */
export const ANALYSIS_CATEGORIES: Record<Sport, string[]> = {
  mlb: ['Moneyline', 'Run Line', 'Total', 'Player Props'],
  nhl: ['Moneyline', 'Puck Line', 'Total', 'Player Props'],
  nfl: ['Moneyline', 'Spread', 'Total', 'Player Props'],
  cfb: ['Moneyline', 'Spread', 'Total', 'Player Props'],
  nba: ['Moneyline', 'Spread', 'Total', 'Player Props'],
  cbb: ['Moneyline', 'Spread', 'Total', 'Player Props'],
}
