'use client'

import { useState } from 'react'
import { AnalysisContent } from '@/components/breakdown/AnalysisContent'
import { ANALYSIS_CATEGORIES } from '@/lib/edges/analysisCategories'
import { RecommendedBetsTab } from '@/components/breakdown/RecommendedBetsTab'
import { RealCFBStadiumTab } from '@/components/breakdown/real-cfb/RealCFBStadiumTab'
import { RealNFLDefenseTab } from '@/components/breakdown/real-nfl/RealNFLDefenseTab'
import { RealNFLLiveTab } from '@/components/breakdown/real-nfl/RealNFLLiveTab'
import { RealNFLMatchupOverview } from '@/components/breakdown/real-nfl/RealNFLMatchupOverview'
import { RealNFLPassingTab } from '@/components/breakdown/real-nfl/RealNFLPassingTab'
import { RealNFLReceivingTab } from '@/components/breakdown/real-nfl/RealNFLReceivingTab'
import { RealNFLRushingTab } from '@/components/breakdown/real-nfl/RealNFLRushingTab'
import { RealNFLSummaryTab } from '@/components/breakdown/real-nfl/RealNFLSummaryTab'
import { RealNFLTrendsTab } from '@/components/breakdown/real-nfl/RealNFLTrendsTab'
import { BreakdownShell, type BreakdownTab } from '@/components/layout/BreakdownShell'
import type { CfbAnalysisData, CfbSide } from '@/lib/cfb/engine'

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

const EDGE_CATEGORIES = ANALYSIS_CATEGORIES.cfb
const API = '/api/cfb-breakdown'

function kickoff(iso: string | null): string {
  if (!iso) return 'TBD'
  return new Date(iso).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' })
}

function TeamBadge({ side, align }: { side: CfbSide; align: 'left' | 'right' }) {
  return (
    <div className={`flex min-w-0 flex-1 items-center gap-2.5 ${align === 'right' ? 'flex-row-reverse text-right' : ''}`}>
      {side.logo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={side.logo} alt="" width={40} height={40} className="h-10 w-10 shrink-0 object-contain" />
      )}
      <div className="min-w-0">
        <div className="flex items-center gap-1.5" style={{ justifyContent: align === 'right' ? 'flex-end' : 'flex-start' }}>
          {side.rank !== null && <span className="rounded-md bg-accent/15 px-1.5 py-0.5 text-[10px] font-extrabold text-accent">#{side.rank}</span>}
          <span className="truncate text-[13px] font-extrabold text-text">{side.shortName}</span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-muted" style={{ justifyContent: align === 'right' ? 'flex-end' : 'flex-start' }}>
          <span className="rounded-full border border-border px-1.5 py-px font-bold" style={{ color: side.color }}>
            {side.conferenceAbbr || '—'}
          </span>
          {side.record && <span>{side.record}</span>}
        </div>
      </div>
    </div>
  )
}

function CfbOverview({ data }: { data: CfbAnalysisData }) {
  const { matchup } = data
  return (
    <div className="flex flex-col">
      <div className="mb-3 rounded-2xl border border-border bg-card p-3">
        <div className="flex items-center gap-2">
          <TeamBadge side={matchup.away} align="left" />
          <span className="text-[10px] font-bold text-muted">{matchup.neutral ? 'VS' : '@'}</span>
          <TeamBadge side={matchup.home} align="right" />
        </div>
        <div className="mt-2.5 rounded-lg bg-card3 px-2.5 py-1.5 text-center text-[10px] font-semibold text-text2">{matchup.context}</div>
      </div>
      <RealNFLMatchupOverview
        awayAbbr={matchup.away.abbr}
        homeAbbr={matchup.home.abbr}
        awayQB={data.awayQB}
        homeQB={data.homeQB}
        contextStats={data.contextStats}
        teamColors={data.teamColors}
        college
      />
    </div>
  )
}

export function RealCFBGameBreakdownClient({ backHref, data }: { backHref: string; data: CfbAnalysisData }) {
  const { matchup, edges, teamColors } = data
  const [tab, setTab] = useState(matchup.status === 'Live' ? 'Live' : 'Analysis')
  const tabs = matchup.status === 'Live' ? [LIVE_TAB, ...BASE_TABS] : BASE_TABS
  const a = matchup.away.abbr
  const h = matchup.home.abbr
  const gid = matchup.gameId

  const statusLine =
    matchup.status === 'Pregame' ? `${matchup.week ? `Wk ${matchup.week} · ` : ''}${kickoff(matchup.date)}${matchup.network ? ` · ${matchup.network}` : ''}` : matchup.status === 'Final' ? 'Final' : 'Live'
  const badge = matchup.status === 'Live' ? ({ text: 'LIVE', tone: 'live' } as const) : matchup.status === 'Final' ? ({ text: 'FINAL', tone: 'final' } as const) : undefined
  const rightTop = matchup.status === 'Pregame' ? matchup.venue.stadium : `${matchup.away.score ?? '—'}-${matchup.home.score ?? '—'}`
  const rightBottom =
    matchup.homeSpread !== null ? `${h} ${matchup.homeSpread > 0 ? '+' : ''}${matchup.homeSpread} · O/U ${matchup.totalLine ?? '—'}` : matchup.venue.stadium

  return (
    <BreakdownShell
      sport="cfb"
      backHref={backHref}
      awayAbbr={a}
      homeAbbr={h}
      awayRank={matchup.away.rank}
      homeRank={matchup.home.rank}
      awayColor={matchup.away.color}
      homeColor={matchup.home.color}
      statusLine={statusLine}
      badge={badge}
      rightTop={rightTop}
      rightBottom={rightBottom}
      tabs={tabs}
      activeTab={tab}
      onChangeTab={setTab}
      season={data.season}
    >
      {tab === 'Live' && matchup.status === 'Live' && <RealNFLLiveTab awayAbbr={a} homeAbbr={h} url={`${API}/live?gameId=${encodeURIComponent(gid)}`} />}

      {tab === 'Analysis' && (
        <AnalysisContent edges={edges} categories={EDGE_CATEGORIES} teamColors={teamColors} sport="cfb" matchupOverview={<CfbOverview data={data} />} />
      )}

      {tab === 'Recommended Bets' && <RecommendedBetsTab sport="cfb" gameId={gid} awayAbbr={a} homeAbbr={h} />}
      {tab === 'Trends' && <RealNFLTrendsTab gameId={gid} apiBase={API} />}
      {tab === 'Summary' && <RealNFLSummaryTab gameId={gid} apiBase={API} teamColors={teamColors} />}
      {tab === 'Passing' && <RealNFLPassingTab gameId={gid} awayAbbr={a} homeAbbr={h} apiBase={API} teamColors={teamColors} college />}
      {tab === 'Rushing' && <RealNFLRushingTab gameId={gid} awayAbbr={a} homeAbbr={h} apiBase={API} teamColors={teamColors} college />}
      {tab === 'Receiving' && <RealNFLReceivingTab gameId={gid} awayAbbr={a} homeAbbr={h} apiBase={API} teamColors={teamColors} college />}
      {tab === 'Defense' && <RealNFLDefenseTab gameId={gid} awayAbbr={a} homeAbbr={h} apiBase={API} teamColors={teamColors} college />}
      {tab === 'Stadium' && <RealCFBStadiumTab gameId={gid} />}
    </BreakdownShell>
  )
}
