'use client'

import { useState } from 'react'
import { QBBettingPanel } from '@/components/breakdown/passing/QBBettingPanel'
import { QBAdvanced, QBLast3, QBOverview } from '@/components/breakdown/passing/QBStatsPanel'
import { PlayerLink } from '@/components/players/PlayerLink'
import { PillTabs, SegmentTabs } from '@/components/ui/PillTabs'
import type { QBPassingDetail } from '@/data/breakdown/passingTypes'

const QB_TABS = ['Overview', 'Advanced', 'Last 3 Games']

export function PassingContent({
  awayAbbr,
  homeAbbr,
  passing,
  teamColors,
}: {
  awayAbbr: string
  homeAbbr: string
  passing: { away: QBPassingDetail; home: QBPassingDetail }
  teamColors: Record<string, string>
}) {
  const [view, setView] = useState('Game Stats')
  const [side, setSide] = useState<'away' | 'home'>('away')
  const [tab, setTab] = useState('Overview')

  const p = side === 'away' ? passing.away : passing.home
  const oppAbbr = side === 'away' ? homeAbbr : awayAbbr
  const abbr = side === 'away' ? awayAbbr : homeAbbr
  const tc = teamColors[abbr] ?? '#4d9fff'

  return (
    <div className="flex flex-col gap-3 px-3.5 pt-3 md:px-8 md:pt-5">
      <SegmentTabs options={['Game Stats', 'Betting Stats']} active={view} onChange={setView} />

      <div className="grid grid-cols-2 gap-1.5">
        {(['away', 'home'] as const).map((s) => {
          const a = s === 'away' ? awayAbbr : homeAbbr
          const qb = s === 'away' ? passing.away : passing.home
          const c = teamColors[a] ?? '#4d9fff'
          const active = side === s
          return (
            <div
              key={s}
              role="button"
              tabIndex={0}
              onClick={() => setSide(s)}
              onKeyDown={(e) => e.key === 'Enter' && setSide(s)}
              className={`cursor-pointer rounded-xl border-2 py-2.5 text-center ${active ? '' : 'border-border'}`}
              style={active ? { borderColor: c, background: `${c}22` } : undefined}
            >
              <div className="mb-0.5 text-[9px] text-muted">{a} QB</div>
              <div className="flex items-center justify-center gap-1">
                <span className="text-[11px]">{qb.hot ? '🔥' : '❄️'}</span>
                <PlayerLink
                  name={qb.name}
                  stopPropagation
                  className="text-[13px] font-extrabold hover:underline"
                >
                  <span style={{ color: active ? c : '#dce8f7' }}>{qb.name}</span>
                </PlayerLink>
              </div>
            </div>
          )
        })}
      </div>

      {view === 'Game Stats' && (
        <div>
          <div className="mb-3">
            <PillTabs options={QB_TABS} active={tab} onChange={setTab} />
          </div>
          {tab === 'Overview' && <QBOverview p={p} oppAbbr={oppAbbr} teamColor={tc} />}
          {tab === 'Advanced' && <QBAdvanced p={p} />}
          {tab === 'Last 3 Games' && <QBLast3 p={p} />}
        </div>
      )}

      {view === 'Betting Stats' && <QBBettingPanel p={p} />}
    </div>
  )
}
