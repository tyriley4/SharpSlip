import { slateGames } from '@/data/mlb/home'
import { nflGames } from '@/data/nfl/games'

export function findGameById(id: string) {
  const mlbGame = slateGames.find((g) => g.id === id)
  if (mlbGame) return { sport: 'mlb' as const, game: mlbGame }

  const nflGame = nflGames.find((g) => g.id === id)
  if (nflGame) return { sport: 'nfl' as const, game: nflGame }

  return null
}
