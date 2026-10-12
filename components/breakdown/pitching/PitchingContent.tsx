'use client'

import { useState } from 'react'
import { BullpenPanel } from '@/components/breakdown/pitching/BullpenPanel'
import { StarterBettingPanel } from '@/components/breakdown/pitching/StarterBettingPanel'
import {
  StarterAdvanced,
  StarterLast3,
  StarterOverview,
  StarterVsLineup,
} from '@/components/breakdown/pitching/StarterStatsPanel'
import { PillTabs, SegmentTabs } from '@/components/ui/PillTabs'
import type { TeamBullpen, StarterDetail } from '@/data/breakdown/pitchingTypes'

const STARTER_TABS = ['Overview', 'Advanced', 'Last 3 Starts', 'vs Lineup']

export function PitchingContent({
  awayAbbr,
  homeAbbr,
  starters,
  bullpen,
  teamColors,
}: {
  awayAbbr: string
  homeAbbr: string
  starters: { away: StarterDetail; home: StarterDetail }
  bullpen: { away: TeamBullpen; home: TeamBullpen }
  teamColors: Record<string, string>
}) {
  const [mode, setMode] = useState('Starters')
  const [view, setView] = useState('Game Stats')
  const [spSide, setSpSide] = useState<'away' | 'home'>('away')
  const [tab, setTab] = useState('Overview')

  const p = spSide === 'away' ? starters.away : starters.home
  const oppAbbr = spSide === 'away' ? homeAbbr : awayAbbr
  const abbr = spSide === 'away' ? awayAbbr : homeAbbr
  const tc = teamColors[abbr] ?? '#4d9fff'

  return (
    <div className="flex flex-col gap-3 px-3.5 pt-3 md:px-8 md:pt-5">
      <SegmentTabs options={['Starters', 'Bullpen']} active={mode} onChange={setMode} />
      <SegmentTabs options={['Game Stats', 'Betting Stats']} active={view} onChange={setView} />

      <div className="grid grid-cols-2 gap-1.5">
        {(['away', 'home'] as const).map((side) => {
          const a = side === 'away' ? awayAbbr : homeAbbr
          const sp = side === 'away' ? starters.away : starters.home
          const c = teamColors[a] ?? '#4d9fff'
          const active = spSide === side
          return (
            <button
              key={side}
              onClick={() => setSpSide(side)}
              className={`rounded-xl border-2 py-2.5 text-center ${active ? '' : 'border-border'}`}
              style={active ? { borderColor: c, background: `${c}22` } : undefined}
            >
              <div className="mb-0.5 text-[9px] text-muted">{a} SP</div>
              <div className="flex items-center justify-center gap-1">
                <span className="text-[11px]">{sp.hot ? '🔥' : '❄️'}</span>
                <span className="text-[13px] font-extrabold" style={{ color: active ? c : '#dce8f7' }}>
                  {sp.name}
                </span>
              </div>
            </button>
          )
        })}
      </div>

      {mode === 'Starters' && view === 'Game Stats' && (
        <div>
          <div className="mb-3">
            <PillTabs options={STARTER_TABS} active={tab} onChange={setTab} />
          </div>
          {tab === 'Overview' && <StarterOverview p={p} oppAbbr={oppAbbr} teamColor={tc} />}
          {tab === 'Advanced' && <StarterAdvanced p={p} />}
          {tab === 'Last 3 Starts' && <StarterLast3 p={p} />}
          {tab === 'vs Lineup' && <StarterVsLineup p={p} />}
        </div>
      )}

      {mode === 'Starters' && view === 'Betting Stats' && <StarterBettingPanel p={p} />}

      {mode === 'Bullpen' && (
        <BullpenPanel abbr={abbr} bullpen={spSide === 'away' ? bullpen.away : bullpen.home} teamColor={tc} />
      )}
    </div>
  )
}
