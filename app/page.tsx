import { HomePageClient } from '@/components/home/HomePageClient'
import { getFeaturedArticles } from '@/lib/articles/getArticles'
import { getTodaysGameBreakdowns } from '@/lib/home/gameBreakdowns'
import { getCondensedMovers } from '@/lib/home/movers'
import { deriveAllEdges, deriveTopEdges } from '@/lib/home/topEdges'
import { deriveTopGames } from '@/lib/home/topGames'
import { getCfbForHome } from '@/lib/espn/live'
import { getTodaysBets } from '@/lib/edges/todaysBets'
import { getCbbHomeInfo } from '@/lib/home/cbbHome'
import { getHomeInjuries } from '@/lib/home/injuries'
import { getWeatherWatchCards } from '@/lib/home/weather'

export const revalidate = 3600

export default async function Home() {
  const [breakdowns, weatherCards, injuries, cfb, articles, movers, cbbInfo] = await Promise.all([
    getTodaysGameBreakdowns(),
    getWeatherWatchCards(),
    getHomeInjuries().catch(() => []),
    getCfbForHome().catch(() => []),
    getFeaturedArticles(6),
    getCondensedMovers('7D'),
    getCbbHomeInfo().catch(() => ({ preseason: false, opens: null, lastSeasonLabel: null, pollName: null, pollUpdated: null, top: [] })),
  ])

  const topEdges = deriveTopEdges(breakdowns)
  const allEdges = deriveAllEdges(breakdowns)
  const todayBets = await getTodaysBets().catch((err) => {
    console.error('[home] best bets failed', err)
    return []
  })
  const topGames = deriveTopGames(breakdowns)

  return (
    <HomePageClient
      topEdges={topEdges}
      allEdges={allEdges}
      topGames={topGames}
      weatherCards={weatherCards}
      injuries={injuries}
      todayBets={todayBets}
      cfb={cfb}
      articles={articles}
      movers={movers}
      cbbInfo={cbbInfo}
    />
  )
}
