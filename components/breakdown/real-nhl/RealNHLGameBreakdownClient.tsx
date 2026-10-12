'use client'

import { useMemo, useState } from 'react'
import { AnalysisContent } from '@/components/breakdown/AnalysisContent'
import { LinesTab } from '@/components/breakdown/LinesTab'
import { RealNHLDefenseArenaTab } from '@/components/breakdown/real-nhl/RealNHLDefenseArenaTab'
import { RealNHLGoalieTab } from '@/components/breakdown/real-nhl/RealNHLGoalieTab'
import { RealNHLMatchupOverview } from '@/components/breakdown/real-nhl/RealNHLMatchupOverview'
import { RealNHLScoringTab } from '@/components/breakdown/real-nhl/RealNHLScoringTab'
import { RealNHLSpecialTeamsTab } from '@/components/breakdown/real-nhl/RealNHLSpecialTeamsTab'
import { RealNHLSummaryTab } from '@/components/breakdown/real-nhl/RealNHLSummaryTab'
import { RealNHLTrendsTab } from '@/components/breakdown/real-nhl/RealNHLTrendsTab'
import { BreakdownShell, type BreakdownTab } from '@/components/layout/BreakdownShell'
import { NHL_TEAM_COLORS } from '@/data/nhl/teamColors'
import type { NHLAnalysisData } from '@/lib/nhl/gameBreakdown'

const TABS: BreakdownTab[] = [
  { id: 'Analysis', icon: '🤖' },
  { id: 'Lines', icon: '💲' },
  { id: 'Trends', icon: '📊' },
  { id: 'Summary', icon: '📋' },
  { id: 'Scoring', icon: '🏒' },
  { id: 'Goalie', icon: '🥅' },
  { id: 'Special Teams', icon: '⚡' },
  { id: 'Defense', icon: '🛡' },
]

const EDGE_CATEGORIES = ['Puck Line', 'Totals', 'Player Props', 'Goalie', 'Offense', 'Special Teams', 'Situational']

function formatPuckDrop(iso: string): string {
  return new Date(iso).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' })
}

export function RealNHLGameBreakdownClient({ backHref, data }: { backHref: string; data: NHLAnalysisData }) {
  const { matchup, awayGoalie, homeGoalie, awayTopSkaters, homeTopSkaters, edges, contextStats } = data
  const [tab, setTab] = useState('Analysis')

  const statusLine = matchup.status === 'Pregame' ? formatPuckDrop(matchup.startTimeUTC) : matchup.status === 'Final' ? 'Final' : matchup.statusText

  const badge =
    matchup.status === 'Live' ? ({ text: 'LIVE', tone: 'live' } as const) : matchup.status === 'Final' ? ({ text: 'FINAL', tone: 'final' } as const) : undefined

  const rightTop = matchup.status === 'Pregame' ? matchup.venue : `${matchup.away.score ?? '—'}-${matchup.home.score ?? '—'}`
  const rightBottom = matchup.network ?? matchup.venue

  return (
    <BreakdownShell
      sport="nhl"
      backHref={backHref}
      awayAbbr={matchup.away.abbr}
      homeAbbr={matchup.home.abbr}
      awayColor={NHL_TEAM_COLORS[matchup.away.abbr] ?? '#4d9fff'}
      homeColor={NHL_TEAM_COLORS[matchup.home.abbr] ?? '#4d9fff'}
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
          teamColors={NHL_TEAM_COLORS}
          sport="nhl"
          matchupOverview={
            <RealNHLMatchupOverview
              awayAbbr={matchup.away.abbr}
              homeAbbr={matchup.home.abbr}
              awayGoalie={awayGoalie}
              homeGoalie={homeGoalie}
              awayTopSkaters={awayTopSkaters}
              homeTopSkaters={homeTopSkaters}
              contextStats={contextStats}
            />
          }
        />
      )}

      {tab === 'Lines' && (
        <LinesTab sport="nhl" gameId={matchup.gameId} awayAbbr={matchup.away.abbr} homeAbbr={matchup.home.abbr} />
      )}

      {tab === 'Trends' && <RealNHLTrendsTab gameId={matchup.gameId} />}
      {tab === 'Summary' && <RealNHLSummaryTab gameId={matchup.gameId} />}
      {tab === 'Scoring' && <RealNHLScoringTab gameId={matchup.gameId} awayAbbr={matchup.away.abbr} homeAbbr={matchup.home.abbr} />}
      {tab === 'Goalie' && <RealNHLGoalieTab gameId={matchup.gameId} awayAbbr={matchup.away.abbr} homeAbbr={matchup.home.abbr} />}
      {tab === 'Special Teams' && <RealNHLSpecialTeamsTab gameId={matchup.gameId} awayAbbr={matchup.away.abbr} homeAbbr={matchup.home.abbr} />}
      {tab === 'Defense' && <RealNHLDefenseArenaTab gameId={matchup.gameId} awayAbbr={matchup.away.abbr} homeAbbr={matchup.home.abbr} />}
    </BreakdownShell>
  )
}
