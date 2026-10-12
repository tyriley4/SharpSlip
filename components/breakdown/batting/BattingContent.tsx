'use client'

import { PlayerLink } from '@/components/players/PlayerLink'
import { useState } from 'react'
import {
  BattingAdvancedTable,
  BattingHotColdTable,
  BattingSplitsTable,
  BattingStandardTable,
} from '@/components/breakdown/batting/BattingStatsTable'
import { BattingPropsTable } from '@/components/breakdown/batting/BattingPropsTable'
import { PillTabs, SegmentTabs } from '@/components/ui/PillTabs'
import type { TeamBatting } from '@/data/breakdown/battingTypes'
import type { MLBPitcher } from '@/data/breakdown/gameTypes'

const STAT_VIEWS = ['Standard', 'Advanced', 'Splits', 'Hot/Cold']

export function BattingContent({
  awayAbbr,
  homeAbbr,
  away,
  home,
  awayPitcher,
  homePitcher,
  teamColors,
}: {
  awayAbbr: string
  homeAbbr: string
  away: TeamBatting
  home: TeamBatting
  awayPitcher: MLBPitcher
  homePitcher: MLBPitcher
  teamColors: Record<string, string>
}) {
  const [view, setView] = useState('Game Stats')
  const [team, setTeam] = useState(awayAbbr)
  const [statView, setStatView] = useState('Standard')

  const isAway = team === awayAbbr
  const batting = isAway ? away : home
  const opposingPitcher = isAway ? homePitcher : awayPitcher
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
              className={`rounded-xl border-2 py-2.5 text-center text-[13px] font-bold ${
                active ? '' : 'border-border text-text2'
              }`}
              style={active ? { borderColor: c, background: `${c}22`, color: c } : undefined}
            >
              ⚾ {abbr}
            </button>
          )
        })}
      </div>

      <div className="flex items-center justify-between rounded-[10px] border border-border bg-card px-3 py-2">
        <span className="text-[11px] text-text2">
          <span className="font-semibold text-text">{team}</span> vs{' '}
          <PlayerLink name={opposingPitcher.name} className="font-bold text-accent hover:underline">{opposingPitcher.name}</PlayerLink>{' '}
          <span className="text-muted">
            ({opposingPitcher.era} ERA · {opposingPitcher.hot ? '🔥' : '❄️'})
          </span>
        </span>
      </div>

      {view === 'Betting Stats' ? (
        <BattingPropsTable team={team} batting={batting} />
      ) : (
        <div>
          <div className="mb-3">
            <PillTabs options={STAT_VIEWS} active={statView} onChange={setStatView} />
          </div>
          {statView === 'Standard' && <BattingStandardTable lineup={batting.lineup} />}
          {statView === 'Advanced' && <BattingAdvancedTable lineup={batting.lineup} />}
          {statView === 'Splits' && <BattingSplitsTable lineup={batting.lineup} />}
          {statView === 'Hot/Cold' && <BattingHotColdTable lineup={batting.lineup} />}
        </div>
      )}
    </div>
  )
}
