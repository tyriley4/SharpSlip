'use client'

import { useState } from 'react'
import { ReceiverPlayerCard } from '@/components/breakdown/receiving/ReceiverPlayerCard'
import { SegmentTabs } from '@/components/ui/PillTabs'
import type { TeamReceiving } from '@/data/breakdown/receivingTypes'

export function ReceivingContent({
  awayAbbr,
  homeAbbr,
  receiving,
  teamColors,
}: {
  awayAbbr: string
  homeAbbr: string
  receiving: { away: TeamReceiving; home: TeamReceiving }
  teamColors: Record<string, string>
}) {
  const [view, setView] = useState('Game Stats')
  const [team, setTeam] = useState(awayAbbr)

  const isAway = team === awayAbbr
  const data = isAway ? receiving.away : receiving.home
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
              🎯 {abbr}
            </button>
          )
        })}
      </div>

      <div className="rounded-2xl bg-card p-3.5" style={{ border: `2px solid ${tc}` }}>
        <div className="mb-2.5 text-[9px] font-extrabold tracking-[0.1em] text-muted">
          {team} TEAM RECEIVING — RANK #{data.summary.rank}
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          <div className="rounded-lg bg-card3 py-2 text-center">
            <div className="text-[13px] font-bold text-text">{data.summary.targets}</div>
            <div className="mt-0.5 text-[8px] text-muted">Targets</div>
          </div>
          <div className="rounded-lg bg-card3 py-2 text-center">
            <div className="text-[13px] font-bold text-text">{data.summary.rec}</div>
            <div className="mt-0.5 text-[8px] text-muted">Rec</div>
          </div>
          <div className="rounded-lg bg-card3 py-2 text-center">
            <div className="text-[13px] font-bold text-text">{data.summary.yds}</div>
            <div className="mt-0.5 text-[8px] text-muted">Rec Yds</div>
          </div>
          <div className="rounded-lg bg-card3 py-2 text-center">
            <div className="text-[13px] font-bold text-text">{data.summary.drops}</div>
            <div className="mt-0.5 text-[8px] text-muted">Drops</div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2.5 md:grid md:grid-cols-2 md:gap-3">
        {data.players.map((p) => (
          <ReceiverPlayerCard key={p.name} p={p} bettingMode={view === 'Betting Stats'} />
        ))}
      </div>
    </div>
  )
}
