export type League = 'MLB' | 'NFL'

export interface Game {
  id: string
  league: League
  homeTeam: string
  awayTeam: string
  startTime: string
}

export const games: Game[] = []
