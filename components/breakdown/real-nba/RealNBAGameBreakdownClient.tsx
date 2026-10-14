'use client'

import { useMemo, useState } from 'react'
import { AnalysisContent } from '@/components/breakdown/AnalysisContent'
import { ANALYSIS_CATEGORIES } from '@/lib/edges/analysisCategories'
import { RecommendedBetsTab } from '@/components/breakdown/RecommendedBetsTab'
import { RealNBAAssistsTab } from '@/components/breakdown/real-nba/RealNBAAssistsTab'
import { RealNBADefenseStadiumTab } from '@/components/breakdown/real-nba/RealNBADefenseStadiumTab'
import { RealNBAMatchupOverview } from '@/components/breakdown/real-nba/RealNBAMatchupOverview'
import { RealNBAReboundingTab } from '@/components/breakdown/real-nba/RealNBAReboundingTab'
import { RealNBAScoringTab } from '@/components/breakdown/real-nba/RealNBAScoringTab'
import { RealNBASummaryTab } from '@/components/breakdown/real-nba/RealNBASummaryTab'
import { RealNBATrendsTab } from '@/components/breakdown/real-nba/RealNBATrendsTab'
import { BreakdownShell, type BreakdownTab } from '@/components/layout/BreakdownShell'
import { NBA_TEAM_COLORS } from '@/data/nba/teamColors'
import type { NBAAnalysisData } from '@/lib/nba/gameBreakdown'

const TABS: BreakdownTab[] = [
  { id: 'Analysis', icon: '🤖' },
  { id: 'Recommended Bets', icon: '🎯' },
  { id: 'Trends', icon: '📊' },
  { id: 'Summary', icon: '📋' },
  { id: 'Scoring', icon: '🏀' },
  { id: 'Rebounding', icon: '🔁' },
  { id: 'Assists', icon: '🎯' },
  { id: 'Defense', icon: '🛡' },
]

const EDGE_CATEGORIES = ANALYSIS_CATEGORIES.nba

function formatTipoff(iso: string): string {
  return new Date(iso).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' })
}

export function RealNBAGameBreakdownClient({ backHref, data }: { backHref: string; data: NBAAnalysisData }) {
  const { matchup, awayLineup, homeLineup, edges, contextStats } = data
  const [tab, setTab] = useState('Analysis')

  const statusLine =
    matchup.status === 'Pregame' ? formatTipoff(matchup.gameDate) : matchup.status === 'Final' ? 'Final' : matchup.statusText

  const badge =
    matchup.status === 'Live' ? ({ text: 'LIVE', tone: 'live' } as const) : matchup.status === 'Final' ? ({ text: 'FINAL', tone: 'final' } as const) : undefined

  const rightTop = matchup.status === 'Pregame' ? matchup.arena : `${matchup.away.score ?? '—'}-${matchup.home.score ?? '—'}`
  const rightBottom = matchup.network ?? matchup.arena

  return (
    <BreakdownShell
      sport="nba"
      backHref={backHref}
      awayAbbr={matchup.away.abbr}
      homeAbbr={matchup.home.abbr}
      awayColor={NBA_TEAM_COLORS[matchup.away.abbr] ?? '#4d9fff'}
      homeColor={NBA_TEAM_COLORS[matchup.home.abbr] ?? '#4d9fff'}
      statusLine={statusLine}
      badge={badge}
      rightTop={rightTop}
      rightBottom={rightBottom}
      tabs={TABS}
      activeTab={tab}
      onChangeTab={setTab}
    >
      {tab === 'Analysis' && (
        <AnalysisContent
          edges={edges}
          categories={EDGE_CATEGORIES}
          teamColors={NBA_TEAM_COLORS}
          sport="nba"
          matchupOverview={
            <RealNBAMatchupOverview awayAbbr={matchup.away.abbr} homeAbbr={matchup.home.abbr} awayLineup={awayLineup} homeLineup={homeLineup} contextStats={contextStats} />
          }
        />
      )}

      {tab === 'Recommended Bets' && (
        <RecommendedBetsTab sport="nba" gameId={matchup.gameId} awayAbbr={matchup.away.abbr} homeAbbr={matchup.home.abbr} />
      )}

      {tab === 'Trends' && <RealNBATrendsTab gameId={matchup.gameId} />}
      {tab === 'Summary' && <RealNBASummaryTab gameId={matchup.gameId} />}
      {tab === 'Scoring' && <RealNBAScoringTab gameId={matchup.gameId} awayAbbr={matchup.away.abbr} homeAbbr={matchup.home.abbr} />}
      {tab === 'Rebounding' && <RealNBAReboundingTab gameId={matchup.gameId} awayAbbr={matchup.away.abbr} homeAbbr={matchup.home.abbr} />}
      {tab === 'Assists' && <RealNBAAssistsTab gameId={matchup.gameId} awayAbbr={matchup.away.abbr} homeAbbr={matchup.home.abbr} />}
      {tab === 'Defense' && <RealNBADefenseStadiumTab gameId={matchup.gameId} awayAbbr={matchup.away.abbr} homeAbbr={matchup.home.abbr} />}
    </BreakdownShell>
  )
}
