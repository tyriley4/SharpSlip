'use client'

import { useMemo, useState } from 'react'
import { AnalysisContent } from '@/components/breakdown/AnalysisContent'
import { ANALYSIS_CATEGORIES } from '@/lib/edges/analysisCategories'
import { RecommendedBetsTab } from '@/components/breakdown/RecommendedBetsTab'
import { RealNFLDefenseTab } from '@/components/breakdown/real-nfl/RealNFLDefenseTab'
import { RealNFLLiveTab } from '@/components/breakdown/real-nfl/RealNFLLiveTab'
import { lensLabel, NflLensBar, NflLensPanel, type NflLens } from '@/components/breakdown/real-nfl/NflWindowLens'
import { RealNFLMatchupOverview } from '@/components/breakdown/real-nfl/RealNFLMatchupOverview'
import { RealNFLPassingTab } from '@/components/breakdown/real-nfl/RealNFLPassingTab'
import { RealNFLReceivingTab } from '@/components/breakdown/real-nfl/RealNFLReceivingTab'
import { RealNFLRushingTab } from '@/components/breakdown/real-nfl/RealNFLRushingTab'
import { RealNFLStadiumTab } from '@/components/breakdown/real-nfl/RealNFLStadiumTab'
import { RealNFLSummaryTab } from '@/components/breakdown/real-nfl/RealNFLSummaryTab'
import { RealNFLTrendsTab } from '@/components/breakdown/real-nfl/RealNFLTrendsTab'
import { BreakdownShell, type BreakdownTab } from '@/components/layout/BreakdownShell'
import { NflSeasonNote } from '@/components/ui/NflSeasonNote'
import { NFL_TEAM_COLORS } from '@/data/nfl/teamColors'
import type { NFLAnalysisData } from '@/lib/nfl/gameBreakdown'

const BASE_TABS: BreakdownTab[] = [
  { id: 'Analysis', icon: '🤖' },
  { id: 'Recommended Bets', icon: '🎯' },
  { id: 'Trends', icon: '📊' },
  { id: 'Summary', icon: '📋' },
  { id: 'Passing', icon: '🏈' },
  { id: 'Rushing', icon: '🏃' },
  { id: 'Receiving', icon: '🎯' },
  { id: 'Defense', icon: '🛡' },
  { id: 'Stadium', icon: '🏟' },
]

const LIVE_TAB: BreakdownTab = { id: 'Live', icon: '🔴' }

const EDGE_CATEGORIES = ANALYSIS_CATEGORIES.nfl

function formatKickoff(gameday: string, gametime: string): string {
  if (!gameday) return 'TBD'
  const dt = new Date(`${gameday}T${gametime || '13:00'}:00`)
  return dt.toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' })
}

export function RealNFLGameBreakdownClient({ backHref, data }: { backHref: string; data: NFLAnalysisData }) {
  const { matchup, awayQB, homeQB, edges, contextStats } = data
  const [tab, setTab] = useState(matchup.status === 'Live' ? 'Live' : 'Analysis')
  const [lens, setLens] = useState<NflLens>('season')
  const lensTab = ({ Passing: 'passing', Rushing: 'rushing', Receiving: 'receiving', Defense: 'defense' } as const)[tab as 'Passing']


  const tabs = matchup.status === 'Live' ? [LIVE_TAB, ...BASE_TABS] : BASE_TABS

  const statusLine =
    matchup.status === 'Pregame'
      ? `Wk ${matchup.week} · ${formatKickoff(matchup.gameday, matchup.gametime)}`
      : matchup.status === 'Final'
        ? 'Final'
        : 'Live'

  const badge =
    matchup.status === 'Live' ? ({ text: 'LIVE', tone: 'live' } as const) : matchup.status === 'Final' ? ({ text: 'FINAL', tone: 'final' } as const) : undefined

  const rightTop = matchup.status === 'Pregame' ? matchup.venue.stadium : `${matchup.away.score ?? '—'}-${matchup.home.score ?? '—'}`
  const rightBottom = matchup.spreadLine !== null ? `${matchup.home.abbr} ${-matchup.spreadLine > 0 ? '+' : ''}${-matchup.spreadLine} · O/U ${matchup.totalLine ?? '—'}` : matchup.venue.stadium

  return (
    <BreakdownShell
      sport="nfl"
      backHref={backHref}
      awayAbbr={matchup.away.abbr}
      homeAbbr={matchup.home.abbr}
      awayColor={NFL_TEAM_COLORS[matchup.away.abbr] ?? '#4d9fff'}
      homeColor={NFL_TEAM_COLORS[matchup.home.abbr] ?? '#4d9fff'}
      statusLine={statusLine}
      badge={badge}
      rightTop={rightTop}
      rightBottom={rightBottom}
      tabs={tabs}
      activeTab={tab}
      onChangeTab={setTab}
      season={data.season}
    >
      {data.statsSeason !== matchup.season && (
        <NflSeasonNote season={data.statsSeason ?? matchup.season - 1} updating className="mx-3.5 mt-3 md:mx-8" />
      )}

      {tab === 'Live' && matchup.status === 'Live' && <RealNFLLiveTab awayAbbr={matchup.away.abbr} homeAbbr={matchup.home.abbr} />}

      {lensTab && (
        <>
          <NflLensBar lens={lens} onChange={setLens} />
          <NflLensPanel gameId={matchup.gameId} tab={lensTab} lens={lens} />
        </>
      )}

      {tab === 'Analysis' && lens !== 'season' && (
        <p className="mx-3.5 mt-3 rounded-xl border border-accent/30 bg-accent/10 px-3 py-2 text-[11px] text-text2 md:mx-8">
          Viewing matchup through {lensLabel(lens)} lens. The Passing, Rushing, Receiving and Defense tabs show that window; the edge grades below still blend the full season with recent form.
        </p>
      )}

      {tab === 'Analysis' && (
        <AnalysisContent
          edges={edges}
          categories={EDGE_CATEGORIES}
          teamColors={NFL_TEAM_COLORS}
          sport="nfl"
          matchupOverview={
            <RealNFLMatchupOverview awayAbbr={matchup.away.abbr} homeAbbr={matchup.home.abbr} awayQB={awayQB} homeQB={homeQB} contextStats={contextStats} />
          }
        />
      )}

      {tab === 'Recommended Bets' && (
        <RecommendedBetsTab sport="nfl" gameId={matchup.gameId} awayAbbr={matchup.away.abbr} homeAbbr={matchup.home.abbr} />
      )}

      {tab === 'Trends' && <RealNFLTrendsTab gameId={matchup.gameId} />}
      {tab === 'Summary' && <RealNFLSummaryTab gameId={matchup.gameId} />}
      {tab === 'Passing' && <RealNFLPassingTab gameId={matchup.gameId} awayAbbr={matchup.away.abbr} homeAbbr={matchup.home.abbr} />}
      {tab === 'Rushing' && <RealNFLRushingTab gameId={matchup.gameId} awayAbbr={matchup.away.abbr} homeAbbr={matchup.home.abbr} />}
      {tab === 'Receiving' && <RealNFLReceivingTab gameId={matchup.gameId} awayAbbr={matchup.away.abbr} homeAbbr={matchup.home.abbr} />}
      {tab === 'Defense' && <RealNFLDefenseTab gameId={matchup.gameId} awayAbbr={matchup.away.abbr} homeAbbr={matchup.home.abbr} />}
      {tab === 'Stadium' && <RealNFLStadiumTab gameId={matchup.gameId} />}
    </BreakdownShell>
  )
}
