'use client'

import { useState } from 'react'
import { RushPlayerCard } from '@/components/breakdown/rushing/RushPlayerCard'
import { SegmentTabs } from '@/components/ui/PillTabs'
import type { TeamRushing } from '@/data/breakdown/rushingTypes'

export function RushingContent({
  awayAbbr,
  homeAbbr,
  rushing,
  teamColors,
}: {
  awayAbbr: string
  homeAbbr: string
  rushing: { away: TeamRushing; home: TeamRushing }
  teamColors: Record<string, string>
}) {
  const [view, setView] = useState('Game Stats')
  const [team, setTeam] = useState(awayAbbr)

  const isAway = team === awayAbbr
  const data = isAway ? rushing.away : rushing.home
  const tc = teamColors[team] ?? '#4d9fff'

  return (
    <div className="flex flex-col gap-3 px-3.5 pt-3 md:px-8 md:pt-5">
      <SegmentTabs options={['Game Stats', 'Betting Stats']} active={view} onChange={setView} />

      <div className="grid grid-cols-2 gap-1.5">
        {[awayAbbr, homeAbbr].map((abbr) => {
          const active = team === abbr
          const c = teamColors[abbr] ?? '#4d9fff'
          return (
            <button
              key={abbr}
              onClick={() => setTeam(abbr)}
              className={`rounded-xl border-2 py-2.5 text-center text-[13px] font-bold ${active ? '' : 'border-border text-text2'}`}
              style={active ? { borderColor: c, background: `${c}22`, color: c } : undefined}
            >
              🏈 {abbr}
            </button>
          )
        })}
      </div>

      <div className="rounded-2xl bg-card p-3.5" style={{ border: `2px solid ${tc}` }}>
        <div className="mb-2.5 text-[9px] font-extrabold tracking-[0.1em] text-muted">
          {team} TEAM RUSHING — RANK #{data.summary.rank}
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          <div className="rounded-lg bg-card3 py-2 text-center">
            <div className="text-[13px] font-bold text-text">{data.summary.att}</div>
            <div className="mt-0.5 text-[8px] text-muted">Rush Att</div>
          </div>
          <div className="rounded-lg bg-card3 py-2 text-center">
            <div className="text-[13px] font-bold text-text">{data.summary.yds}</div>
            <div className="mt-0.5 text-[8px] text-muted">Rush Yds</div>
          </div>
          <div className="rounded-lg bg-card3 py-2 text-center">
            <div className="text-[13px] font-bold text-text">{data.summary.ypc}</div>
            <div className="mt-0.5 text-[8px] text-muted">YPC</div>
          </div>
          <div className="rounded-lg bg-card3 py-2 text-center">
            <div className="text-[13px] font-bold text-text">{data.summary.td}</div>
            <div className="mt-0.5 text-[8px] text-muted">Rush TDs</div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2.5 md:grid md:grid-cols-3 md:gap-3">
        {data.players.map((p) => (
          <RushPlayerCard key={p.name} p={p} bettingMode={view === 'Betting Stats'} />
        ))}
      </div>
    </div>
  )
}
