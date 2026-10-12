'use client'

import { useState } from 'react'
import { TeamBettingCard } from '@/components/breakdown/TeamBettingCard'
import { TeamSummaryCard } from '@/components/breakdown/TeamSummaryCard'
import { SegmentTabs } from '@/components/ui/PillTabs'
import type { TeamSummary } from '@/data/breakdown/summaryTypes'

export function SummaryContent({
  away,
  home,
  teamColors,
}: {
  away: TeamSummary
  home: TeamSummary
  teamColors: Record<string, string>
}) {
  const [view, setView] = useState('Game Stats')

  return (
    <div className="flex flex-col px-3.5 pt-3 md:px-8 md:pt-5">
      <div className="mb-3.5 md:max-w-sm">
        <SegmentTabs options={['Game Stats', 'Betting Stats']} active={view} onChange={setView} />
      </div>

      {view === 'Betting Stats' ? (
        <div className="md:grid md:grid-cols-2 md:items-start md:gap-4">
          <TeamBettingCard team={away} teamColor={teamColors[away.abbr] ?? '#4d9fff'} />
          <TeamBettingCard team={home} teamColor={teamColors[home.abbr] ?? '#4d9fff'} />
        </div>
      ) : (
        <div className="md:grid md:grid-cols-2 md:items-start md:gap-4">
          <TeamSummaryCard team={away} teamColor={teamColors[away.abbr] ?? '#4d9fff'} />
          <TeamSummaryCard team={home} teamColor={teamColors[home.abbr] ?? '#4d9fff'} />
        </div>
      )}
    </div>
  )
}
