'use client'

import { useState } from 'react'
import { AnalysisContent } from '@/components/breakdown/AnalysisContent'
import { BallparkContent } from '@/components/breakdown/ballpark/BallparkContent'
import { BattingContent } from '@/components/breakdown/batting/BattingContent'
import { DefenseContent } from '@/components/breakdown/defense/DefenseContent'
import { GameLogContent } from '@/components/breakdown/gamelog/GameLogContent'
import { MLBMatchupOverview } from '@/components/breakdown/MLBMatchupOverview'
import { NFLMatchupOverview } from '@/components/breakdown/NFLMatchupOverview'
import { PassingContent } from '@/components/breakdown/passing/PassingContent'
import { PitchingContent } from '@/components/breakdown/pitching/PitchingContent'
import { ReceivingContent } from '@/components/breakdown/receiving/ReceivingContent'
import { RushingContent } from '@/components/breakdown/rushing/RushingContent'
import { StadiumContent } from '@/components/breakdown/stadium/StadiumContent'
import { SummaryContent } from '@/components/breakdown/SummaryContent'
import { TabPlaceholder } from '@/components/breakdown/TabPlaceholder'
import { TrendsContent } from '@/components/breakdown/TrendsContent'
import { BreakdownShell, type BreakdownTab } from '@/components/layout/BreakdownShell'
import { mlbGameBreakdowns, mlbTrendTags } from '@/data/breakdown/mlbGames'
import { nflGameBreakdowns, nflTrendTags } from '@/data/breakdown/nflGames'
import { MLB_TEAM_COLORS } from '@/data/mlb/teamColors'
import { NFL_TEAM_COLORS } from '@/data/nfl/teamColors'
import type { SlateGame } from '@/data/mlb/home'
import type { NFLGame } from '@/data/nfl/games'

const MLB_TABS: BreakdownTab[] = [
  { id: 'Analysis', icon: '🤖' },
  { id: 'Trends', icon: '📊' },
  { id: 'Summary', icon: '📋' },
  { id: 'Batting', icon: '🔥' },
  { id: 'Pitching', icon: '⚾' },
  { id: 'Game Log', icon: '📓' },
  { id: 'Ballpark', icon: '🏟' },
]

const NFL_TABS: BreakdownTab[] = [
  { id: 'Analysis', icon: '🤖' },
  { id: 'Trends', icon: '📊' },
  { id: 'Summary', icon: '📋' },
  { id: 'Passing', icon: '🏈' },
  { id: 'Rushing', icon: '🏃' },
  { id: 'Receiving', icon: '🎯' },
  { id: 'Defense', icon: '🛡' },
  { id: 'Stadium', icon: '🏟' },
]

export function GameBreakdownClient({
  result,
}: {
  result: { sport: 'mlb'; game: SlateGame } | { sport: 'nfl'; game: NFLGame }
}) {
  const [tab, setTab] = useState('Analysis')
  const { sport, game } = result

  if (sport === 'mlb') {
    const isLive = game.status === 'Live'
    const breakdown = mlbGameBreakdowns[game.id]

    return (
      <BreakdownShell
        backHref="/games"
        awayAbbr={game.away.abbr}
        homeAbbr={game.home.abbr}
        awayColor={MLB_TEAM_COLORS[game.away.abbr] ?? '#4d9fff'}
        homeColor={MLB_TEAM_COLORS[game.home.abbr] ?? '#4d9fff'}
        statusLine={isLive ? 'Live' : game.time}
        rightTop={`O/U ${game.total}`}
        rightBottom={`Win Prob: ${game.home.abbr} ${game.winProb}%`}
        tabs={MLB_TABS}
        activeTab={tab}
        onChangeTab={setTab}
      >
        {!breakdown && <TabPlaceholder label="Full breakdown" />}
        {breakdown && tab === 'Analysis' && (
          <AnalysisContent
            edges={breakdown.edges}
            categories={['Game Lines', 'Totals', 'Player Props']}
            teamColors={MLB_TEAM_COLORS}
            matchupOverview={
              <MLBMatchupOverview
                awayAbbr={game.away.abbr}
                homeAbbr={game.home.abbr}
                away={breakdown.pitcherMatchup.away}
                home={breakdown.pitcherMatchup.home}
                contextStats={breakdown.contextStats}
              />
            }
          />
        )}
        {breakdown && tab === 'Trends' && (
          <TrendsContent tags={mlbTrendTags} trends={breakdown.trends} teamColors={MLB_TEAM_COLORS} />
        )}
        {breakdown && tab === 'Summary' && (
          <SummaryContent
            away={breakdown.summary.away}
            home={breakdown.summary.home}
            teamColors={MLB_TEAM_COLORS}
          />
        )}
        {breakdown && tab === 'Batting' && (
          <BattingContent
            awayAbbr={game.away.abbr}
            homeAbbr={game.home.abbr}
            away={breakdown.batting.away}
            home={breakdown.batting.home}
            awayPitcher={breakdown.pitcherMatchup.away}
            homePitcher={breakdown.pitcherMatchup.home}
            teamColors={MLB_TEAM_COLORS}
          />
        )}
        {breakdown && tab === 'Pitching' && (
          <PitchingContent
            awayAbbr={game.away.abbr}
            homeAbbr={game.home.abbr}
            starters={breakdown.starters}
            bullpen={breakdown.bullpen}
            teamColors={MLB_TEAM_COLORS}
          />
        )}
        {breakdown && tab === 'Game Log' && (
          <GameLogContent
            away={breakdown.summary.away}
            home={breakdown.summary.home}
            teamColors={MLB_TEAM_COLORS}
          />
        )}
        {breakdown && tab === 'Ballpark' && <BallparkContent bp={breakdown.ballpark} />}
        {breakdown &&
          tab !== 'Analysis' &&
          tab !== 'Trends' &&
          tab !== 'Summary' &&
          tab !== 'Batting' &&
          tab !== 'Pitching' &&
          tab !== 'Game Log' &&
          tab !== 'Ballpark' && <TabPlaceholder label={tab} />}
      </BreakdownShell>
    )
  }

  const breakdown = nflGameBreakdowns[game.id]

  return (
    <BreakdownShell
      backHref="/games"
      awayAbbr={game.away.abbr}
      homeAbbr={game.home.abbr}
      awayColor={NFL_TEAM_COLORS[game.away.abbr] ?? '#4d9fff'}
      homeColor={NFL_TEAM_COLORS[game.home.abbr] ?? '#4d9fff'}
      statusLine={`${game.time} · ${game.network}`}
      rightTop={`${game.spread} · O/U ${game.total}`}
      rightBottom={`Win Prob: ${game.home.abbr} ${game.winProb}%`}
      tabs={NFL_TABS}
      activeTab={tab}
      onChangeTab={setTab}
    >
      {!breakdown && <TabPlaceholder label="Full breakdown" />}
      {breakdown && tab === 'Analysis' && (
        <AnalysisContent
          edges={breakdown.edges}
          categories={['Spread/ML', 'Totals', 'Player Props']}
          teamColors={NFL_TEAM_COLORS}
          matchupOverview={
            <NFLMatchupOverview
              awayAbbr={game.away.abbr}
              homeAbbr={game.home.abbr}
              away={breakdown.qbMatchup.away}
              home={breakdown.qbMatchup.home}
              contextStats={breakdown.contextStats}
            />
          }
        />
      )}
      {breakdown && tab === 'Trends' && (
        <TrendsContent tags={nflTrendTags} trends={breakdown.trends} teamColors={NFL_TEAM_COLORS} />
      )}
      {breakdown && tab === 'Summary' && (
        <SummaryContent
          away={breakdown.summary.away}
          home={breakdown.summary.home}
          teamColors={NFL_TEAM_COLORS}
        />
      )}
      {breakdown && tab === 'Passing' && (
        <PassingContent
          awayAbbr={game.away.abbr}
          homeAbbr={game.home.abbr}
          passing={breakdown.passing}
          teamColors={NFL_TEAM_COLORS}
        />
      )}
      {breakdown && tab === 'Rushing' && (
        <RushingContent
          awayAbbr={game.away.abbr}
          homeAbbr={game.home.abbr}
          rushing={breakdown.rushing}
          teamColors={NFL_TEAM_COLORS}
        />
      )}
      {breakdown && tab === 'Receiving' && (
        <ReceivingContent
          awayAbbr={game.away.abbr}
          homeAbbr={game.home.abbr}
          receiving={breakdown.receiving}
          teamColors={NFL_TEAM_COLORS}
        />
      )}
      {breakdown && tab === 'Defense' && (
        <DefenseContent
          awayAbbr={game.away.abbr}
          homeAbbr={game.home.abbr}
          defense={breakdown.defense}
          teamColors={NFL_TEAM_COLORS}
        />
      )}
      {breakdown && tab === 'Stadium' && <StadiumContent stadium={breakdown.stadium} />}
      {breakdown &&
        tab !== 'Analysis' &&
        tab !== 'Trends' &&
        tab !== 'Summary' &&
        tab !== 'Passing' &&
        tab !== 'Rushing' &&
        tab !== 'Receiving' &&
        tab !== 'Defense' &&
        tab !== 'Stadium' && <TabPlaceholder label={tab} />}
    </BreakdownShell>
  )
}
