import { ParlayPageClient } from '@/components/parlay/ParlayPageClient'
import { getParlayGames } from '@/lib/parlay/todayGames'

export const revalidate = 3600

export default async function ParlayPage() {
  let games: Awaited<ReturnType<typeof getParlayGames>> = []
  try {
    games = await getParlayGames()
  } catch (err) {
    console.error('[ParlayPage] failed to load today\'s games:', err)
  }
  return <ParlayPageClient games={games} />
}
