'use client'

import { useEffect, useState } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { useSport } from '@/lib/sport/SportContext'
import type { TeamPageData } from '@/lib/teams/types'
import { BettingTab } from './BettingTab'
import { OverviewTab } from './OverviewTab'
import { RosterTab } from './RosterTab'
import { ScheduleTab } from './ScheduleTab'
import { StatsTab } from './StatsTab'
import { SummaryGrid, TeamHeader } from './TeamHeader'

const TABS = ['Overview', 'Schedule', 'Roster', 'Betting', 'Stats'] as const
type Tab = (typeof TABS)[number]

export function TeamPageClient({ data }: { data: TeamPageData }) {
  const [tab, setTab] = useState<Tab>('Overview')
  const { sport, setSport } = useSport()

  // Keep the sport switcher in step with the team being viewed.
  useEffect(() => {
    if (sport !== data.sport) setSport(data.sport)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.sport])

  return (
    <AppShell>
      <div className="flex flex-col gap-4 px-3.5 pt-1 md:px-0 md:pt-0">
        <TeamHeader data={data} />
        <SummaryGrid cards={data.summary} />

        {data.unavailable.length > 0 && (
          <div className="rounded-xl border border-warning/25 bg-warning/[0.07] px-3.5 py-2.5 text-[11px] text-text2">
            Some data couldn&apos;t be loaded right now ({data.unavailable.join(', ')}). The rest of the page is unaffected.
          </div>
        )}

        <div className="flex gap-0 overflow-x-auto border-b border-border [scrollbar-width:none] md:gap-1.5 [&::-webkit-scrollbar]:hidden" role="tablist">
          {TABS.map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`shrink-0 whitespace-nowrap border-b-2 px-4 py-2.5 text-[13px] transition-colors md:rounded-t-lg ${
                tab === t ? 'border-accent font-bold text-text md:bg-card3' : 'border-transparent font-medium text-muted hover:text-text2 md:hover:bg-card3/60'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {data.notes && data.notes.length > 0 && <p className="px-1 text-[10px] text-muted">{data.notes.join(' ')}</p>}

        <div className="pb-6">
          {tab === 'Overview' && <OverviewTab data={data} />}
          {tab === 'Schedule' && <ScheduleTab data={data} />}
          {tab === 'Roster' && <RosterTab data={data} />}
          {tab === 'Betting' && <BettingTab data={data} />}
          {tab === 'Stats' && <StatsTab data={data} />}
        </div>
      </div>
    </AppShell>
  )
}
