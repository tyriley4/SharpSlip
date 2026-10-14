'use client'

import { useState } from 'react'
import { CbbSeasonCard } from '@/components/home/CbbSeasonCard'
import { CfbScores } from '@/components/home/CfbScores'
import { FeaturedArticles } from '@/components/home/FeaturedArticles'
import { FeaturedEdgeStats } from '@/components/home/FeaturedEdgeStats'
import { InjuryReport } from '@/components/home/InjuryReport'
import { MoversCondensed } from '@/components/home/MoversCondensed'
import { ParlayTeaser } from '@/components/home/ParlayTeaser'
import { SportFilterPills } from '@/components/home/SportFilterPills'
import { TopEdgesToday } from '@/components/home/TopEdgesToday'
import { TopGames } from '@/components/home/TopGames'
import { WeatherWatch } from '@/components/home/WeatherWatch'
import { AppShell } from '@/components/layout/AppShell'
import type { Article } from '@/lib/articles/types'
import type { CfbCard } from '@/lib/espn/live'
import type { CbbHomeInfo } from '@/lib/home/cbbHome'
import type { TodayBet } from '@/lib/edges/todaysBets'
import type { Injury } from '@/lib/home/injuries'
import type { CondensedMover } from '@/lib/home/movers'
import type { TopEdgeResult } from '@/lib/home/topEdges'
import type { TopGame } from '@/lib/home/topGames'
import type { WeatherWatchCard } from '@/lib/home/weather'
import type { Sport } from '@/lib/sport/SportContext'

export function HomePageClient({
  topEdges,
  allEdges,
  topGames,
  weatherCards,
  injuries,
  todayBets,
  cfb,
  articles,
  movers,
  cbbInfo,
}: {
  topEdges: TopEdgeResult[]
  allEdges: TopEdgeResult[]
  topGames: TopGame[]
  weatherCards: WeatherWatchCard[]
  injuries: Injury[]
  todayBets: TodayBet[]
  cfb: CfbCard[]
  articles: Article[]
  movers: { hot: CondensedMover[]; cold: CondensedMover[] }
  cbbInfo: CbbHomeInfo
}) {
  const [sportFilter, setSportFilter] = useState<Sport | 'all'>('all')

  return (
    <AppShell>
      <SportFilterPills value={sportFilter} onChange={setSportFilter} />

      <div className="flex flex-col gap-6 px-3.5 pt-3 md:gap-8 md:px-0 md:pt-0">
        <CbbSeasonCard info={cbbInfo} sportFilter={sportFilter} />

        <FeaturedEdgeStats allEdges={allEdges} injuries={injuries} todayBets={todayBets} sportFilter={sportFilter} />

        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-5">
          <div className="lg:w-[65%]">
            <TopGames topGames={topGames} sportFilter={sportFilter} />
          </div>
          <div className="lg:w-[35%]">
            <TopEdgesToday edges={topEdges} sportFilter={sportFilter} />
          </div>
        </div>

        <CfbScores initial={cfb} sportFilter={sportFilter} />

        <InjuryReport injuries={injuries} sportFilter={sportFilter} />

        <WeatherWatch cards={weatherCards} sportFilter={sportFilter} />

        <MoversCondensed initialData={movers} sportFilter={sportFilter} />

        <FeaturedArticles articles={articles} sportFilter={sportFilter} />

        <div className="lg:hidden">
          <ParlayTeaser />
        </div>
      </div>
    </AppShell>
  )
}
