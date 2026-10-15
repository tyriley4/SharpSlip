'use client'

import { useMemo, useState } from 'react'
import { AnalysisContent } from '@/components/breakdown/AnalysisContent'
import { ANALYSIS_CATEGORIES } from '@/lib/edges/analysisCategories'
import { RecommendedBetsTab } from '@/components/breakdown/RecommendedBetsTab'
import { RealBallparkTab } from '@/components/breakdown/real/RealBallparkTab'
import { RealBattingTab } from '@/components/breakdown/real/RealBattingTab'
import { RealGameLogTab } from '@/components/breakdown/real/RealGameLogTab'
import { RealLiveTab } from '@/components/breakdown/real/RealLiveTab'
import { RealMatchupOverview } from '@/components/breakdown/real/RealMatchupOverview'
import { RealPitchingTab } from '@/components/breakdown/real/RealPitchingTab'
import { RealSummaryTab } from '@/components/breakdown/real/RealSummaryTab'
import { RealTrendsTab } from '@/components/breakdown/real/RealTrendsTab'
import { BreakdownShell, type BreakdownTab } from '@/components/layout/BreakdownShell'
import { MLB_TEAM_COLORS } from '@/data/mlb/teamColors'
import type { RealGameBreakdown } from '@/lib/mlb/gameBreakdown'

const BASE_TABS: BreakdownTab[] = [
  { id: 'Analysis', icon: '🤖' },
  { id: 'Recommended Bets', icon: '🎯' },
  { id: 'Trends', icon: '📊' },
  { id: 'Summary', icon: '📋' },
  { id: 'Batting', icon: '🔥' },
  { id: 'Pitching', icon: '⚾' },
  { id: 'Game Log', icon: '📓' },
  { id: 'Ballpark', icon: '🏟' },
]

const LIVE_TAB: BreakdownTab = { id: 'Live', icon: '🔴' }

const EDGE_CATEGORIES = ANALYSIS_CATEGORIES.mlb

function formatGameTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`
}

export function RealGameBreakdownClient({ backHref, breakdown }: { backHref: string; breakdown: RealGameBreakdown }) {
  const { matchup, pitchers, edges, contextStats, batting, teamHitting, leagueAvg } = breakdown
  const [tab, setTab] = useState(matchup.status === 'Live' ? 'Live' : 'Analysis')


  const tabs = matchup.status === 'Live' ? [LIVE_TAB, ...BASE_TABS] : BASE_TABS

  const statusLine =
    matchup.status === 'Preview'
      ? `Game starts at ${formatGameTime(matchup.gameDate)}`
      : matchup.status === 'Final'
        ? 'Final'
        : matchup.inning
          ? `${matchup.inning.state} ${ordinal(matchup.inning.number)}`
          : matchup.detailedState

  const badge =
    matchup.status === 'Live' ? ({ text: 'LIVE', tone: 'live' } as const) : matchup.status === 'Final' ? ({ text: 'FINAL', tone: 'final' } as const) : undefined

  const rightTop = matchup.status === 'Preview' ? matchup.venue : `${matchup.away.score}-${matchup.home.score}`
  const rightBottom =
    matchup.status === 'Preview' ? (matchup.weather ? `${matchup.weather.condition}, ${matchup.weather.temp}°` : '') : matchup.venue

  return (
    <BreakdownShell
      sport="mlb"
      backHref={backHref}
      awayAbbr={matchup.away.abbr}
      homeAbbr={matchup.home.abbr}
      awayColor={MLB_TEAM_COLORS[matchup.away.abbr] ?? '#4d9fff'}
      homeColor={MLB_TEAM_COLORS[matchup.home.abbr] ?? '#4d9fff'}
      statusLine={statusLine}
      badge={badge}
      rightTop={rightTop}
      rightBottom={rightBottom}
      tabs={tabs}
      activeTab={tab}
      onChangeTab={setTab}
      season={breakdown.season}
    >
      {tab === 'Live' && matchup.status === 'Live' && (
        <RealLiveTab gamePk={matchup.gamePk} awayAbbr={matchup.away.abbr} homeAbbr={matchup.home.abbr} />
      )}

      {tab === 'Analysis' && (
        <AnalysisContent
          edges={edges}
          categories={EDGE_CATEGORIES}
          teamColors={MLB_TEAM_COLORS}
          sport="mlb"
          matchupOverview={
            <RealMatchupOverview
              awayAbbr={matchup.away.abbr}
              homeAbbr={matchup.home.abbr}
              awayPitcher={pitchers.away}
              homePitcher={pitchers.home}
              contextStats={contextStats}
            />
          }
        />
      )}

      {tab === 'Recommended Bets' && (
        <RecommendedBetsTab sport="mlb" gameId={String(matchup.gamePk)} awayAbbr={matchup.away.abbr} homeAbbr={matchup.home.abbr} />
      )}

      {tab === 'Trends' && <RealTrendsTab gamePk={matchup.gamePk} />}

      {tab === 'Summary' && <RealSummaryTab gamePk={matchup.gamePk} />}

      {tab === 'Batting' && (
        <>
          {matchup.status === 'Live' && (
            <div className="mx-3.5 mt-3 rounded-[10px] border border-accent/25 bg-accent/[0.06] px-3 py-2 text-[10px] text-accent md:mx-8">
              Live box score updating every 30 seconds
            </div>
          )}
          <RealBattingTab
            awayAbbr={matchup.away.abbr}
            homeAbbr={matchup.home.abbr}
            batting={batting}
            teamHitting={teamHitting}
            leagueAvg={leagueAvg}
            status={matchup.status}
            awayPitcher={pitchers.away}
            homePitcher={pitchers.home}
          />
        </>
      )}

      {tab === 'Pitching' && <RealPitchingTab gamePk={matchup.gamePk} awayAbbr={matchup.away.abbr} homeAbbr={matchup.home.abbr} />}

      {tab === 'Game Log' && <RealGameLogTab gamePk={matchup.gamePk} awayAbbr={matchup.away.abbr} homeAbbr={matchup.home.abbr} />}

      {tab === 'Ballpark' && <RealBallparkTab gamePk={matchup.gamePk} />}
    </BreakdownShell>
  )
}
