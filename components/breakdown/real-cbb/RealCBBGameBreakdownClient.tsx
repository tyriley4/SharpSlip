'use client'

import { useState } from 'react'
import { AnalysisContent } from '@/components/breakdown/AnalysisContent'
import { ANALYSIS_CATEGORIES } from '@/lib/edges/analysisCategories'
import { ContextStats } from '@/components/breakdown/ContextStats'
import { RecommendedBetsTab } from '@/components/breakdown/RecommendedBetsTab'
import { RealCBBArenaTab, RealCBBDefenseTab, RealCBBScoringTab, RealCBBSummaryTab } from '@/components/breakdown/real-cbb/RealCBBTabs'
import { RealNFLLiveTab } from '@/components/breakdown/real-nfl/RealNFLLiveTab'
import { RealNFLTrendsTab } from '@/components/breakdown/real-nfl/RealNFLTrendsTab'
import { BreakdownShell, type BreakdownTab } from '@/components/layout/BreakdownShell'
import type { CbbAnalysisData, CbbSide } from '@/lib/cbb/engine'

const BASE_TABS: BreakdownTab[] = [
  { id: 'Analysis', icon: '🤖' },
  { id: 'Recommended Bets', icon: '🎯' },
  { id: 'Trends', icon: '📊' },
  { id: 'Summary', icon: '📋' },
  { id: 'Scoring', icon: '🏀' },
  { id: 'Defense', icon: '🛡' },
  { id: 'Arena', icon: '🏟' },
]
const LIVE_TAB: BreakdownTab = { id: 'Live', icon: '🔴' }

const EDGE_CATEGORIES = ANALYSIS_CATEGORIES.cbb
const API = '/api/cbb-breakdown'

function when(iso: string | null): string {
  if (!iso) return 'TBD'
  return new Date(iso).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function TeamBadge({ side, align }: { side: CbbSide; align: 'left' | 'right' }) {
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

function Overview({ data }: { data: CbbAnalysisData }) {
  const { matchup, awaySeason, homeSeason } = data
  const topA = awaySeason.players[0]
  const topH = homeSeason.players[0]
  return (
    <div className="mb-3 flex flex-col gap-3">
      <div className="rounded-2xl border border-border bg-card p-3">
        <div className="flex items-center gap-2">
          <TeamBadge side={matchup.away} align="left" />
          <span className="text-[10px] font-bold text-muted">{matchup.neutral ? 'VS' : '@'}</span>
          <TeamBadge side={matchup.home} align="right" />
        </div>
        <div className="mt-2.5 rounded-lg bg-card3 px-2.5 py-1.5 text-center text-[10px] font-semibold text-text2">{matchup.context}</div>
      </div>
      {data.priorSeasonNote && <div className="rounded-xl border border-warning/25 bg-warning/[0.07] px-3.5 py-2.5 text-[11px] text-text2">{data.priorSeasonNote}</div>}
      <div className="rounded-2xl border border-border bg-card p-3">
        <div className="mb-2.5 flex items-center gap-1.5">
          <span className="text-[10px]">🤖</span>
          <span className="text-[9px] font-extrabold tracking-[0.1em] text-muted">MATCHUP OVERVIEW</span>
        </div>
        <div className="mb-2.5 flex flex-col gap-2 md:flex-row">
          {[
            { abbr: matchup.away.abbr, p: topA },
            { abbr: matchup.home.abbr, p: topH },
          ].map(({ abbr, p }) => (
            <div key={abbr} className="flex-1 rounded-xl bg-card3 p-2.5" style={{ border: `2px solid ${(data.teamColors[abbr] ?? '#FF9F1C')}44` }}>
              <div className="mb-1 text-[9px] text-muted">{abbr} leading scorer</div>
              {p ? (
                <>
                  <div className="mb-1.5 flex items-center gap-1.5 text-xs font-extrabold text-text">
                    {p.name} {p.hot && <span title="Last 5 games well above season average">🔥</span>}
                  </div>
                  <div className="grid grid-cols-4 gap-1.5 text-center">
                    {[
                      ['PPG', p.ppg.toFixed(1)],
                      ['RPG', p.rpg.toFixed(1)],
                      ['APG', p.apg.toFixed(1)],
                      ['FG%', p.fgPct.toFixed(0)],
                    ].map(([k, v]) => (
                      <div key={k} className="rounded-lg bg-card py-1">
                        <div className="text-[11px] font-extrabold text-text">{v}</div>
                        <div className="text-[8px] text-muted">{k}</div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="py-4 text-center text-xs text-muted">No games on record yet</div>
              )}
            </div>
          ))}
        </div>
        <ContextStats stats={data.contextStats} />
      </div>
    </div>
  )
}

export function RealCBBGameBreakdownClient({ backHref, data }: { backHref: string; data: CbbAnalysisData }) {
  const { matchup, edges, teamColors } = data
  const [tab, setTab] = useState(matchup.status === 'Live' ? 'Live' : 'Analysis')
  const tabs = matchup.status === 'Live' ? [LIVE_TAB, ...BASE_TABS] : BASE_TABS
  const a = matchup.away.abbr
  const h = matchup.home.abbr
  const gid = matchup.gameId

  const statusLine = matchup.status === 'Pregame' ? `${when(matchup.date)}${matchup.network ? ` · ${matchup.network}` : ''}` : matchup.status === 'Final' ? `Final · ${when(matchup.date)}` : 'Live'
  const badge = matchup.status === 'Live' ? ({ text: 'LIVE', tone: 'live' } as const) : matchup.status === 'Final' ? ({ text: 'FINAL', tone: 'final' } as const) : undefined
  const rightTop = matchup.status === 'Pregame' ? matchup.venue.arena : `${matchup.away.score ?? '—'}-${matchup.home.score ?? '—'}`
  const rightBottom = matchup.homeSpread !== null ? `${h} ${matchup.homeSpread > 0 ? '+' : ''}${matchup.homeSpread} · O/U ${matchup.totalLine ?? '—'}` : matchup.venue.arena

  return (
    <BreakdownShell
      sport="cbb"
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
      {tab === 'Analysis' && <AnalysisContent edges={edges} categories={EDGE_CATEGORIES} teamColors={teamColors} sport="cbb" matchupOverview={<Overview data={data} />} />}
      {tab === 'Recommended Bets' && <RecommendedBetsTab sport="cbb" gameId={gid} awayAbbr={a} homeAbbr={h} />}
      {tab === 'Trends' && <RealNFLTrendsTab gameId={gid} apiBase={API} />}
      {tab === 'Summary' && <RealCBBSummaryTab gameId={gid} />}
      {tab === 'Scoring' && <RealCBBScoringTab gameId={gid} />}
      {tab === 'Defense' && <RealCBBDefenseTab gameId={gid} />}
      {tab === 'Arena' && <RealCBBArenaTab gameId={gid} />}
    </BreakdownShell>
  )
}
