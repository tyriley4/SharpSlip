'use client'

import { useState } from 'react'
import { EdgeCard } from '@/components/breakdown/EdgeCard'
import { TopEdgeCard } from '@/components/breakdown/TopEdgeCard'
import { ParlayTeaser } from '@/components/home/ParlayTeaser'
import { PillTabs } from '@/components/ui/PillTabs'
import { ConfBar } from '@/components/ui/ConfBar'
import { EdgeDisclaimer } from '@/components/ui/EdgeDisclaimer'
import type { Edge } from '@/data/breakdown/types'
import { useAccountData } from '@/lib/account/AccountDataContext'

export function AnalysisContent({
  edges: allEdges,
  categories,
  teamColors,
  matchupOverview,
  sport,
}: {
  edges: Edge[]
  categories: string[]
  teamColors: Record<string, string>
  matchupOverview: React.ReactNode
  sport?: string
}) {
  const { settings } = useAccountData()
  const filters = ['All', ...categories, 'Parlays']
  const [filter, setFilter] = useState('All')

  const edges = allEdges.filter((e) => e.conf >= settings.edgeThreshold)
  const hiddenCount = allEdges.length - edges.length

  const topEdge = edges[0]
  const rest = edges.slice(1)
  const filtered =
    filter === 'All' ? rest : filter === 'Parlays' ? [] : rest.filter((e) => e.typeLabel === filter)

  const counts = categories.map((label) => ({
    label,
    n: edges.filter((e) => e.typeLabel === label).length,
  }))

  return (
    <div className="flex flex-col gap-0 px-3.5 pt-3 md:px-0 md:pt-0">
      <div className="md:grid md:grid-cols-2 md:items-start md:gap-4">
        {matchupOverview}
        {topEdge ? (
          <TopEdgeCard edge={topEdge} teamColors={teamColors} sportsbook={settings.sportsbook} />
        ) : (
          <div className="mb-2.5 rounded-2xl border border-border bg-card p-3.5 text-center text-xs text-muted">
            {hiddenCount > 0
              ? `${hiddenCount} edge${hiddenCount !== 1 ? 's' : ''} below your ${settings.edgeThreshold}% confidence threshold — adjust it in Settings to see them.`
              : "No qualifying insights for this matchup yet — the stats don't clear our trend thresholds either way."}
          </div>
        )}
      </div>

      {hiddenCount > 0 && topEdge && (
        <p className="mb-3 text-[10px] text-muted">
          {hiddenCount} more edge{hiddenCount !== 1 ? 's' : ''} hidden below your {settings.edgeThreshold}% threshold.
        </p>
      )}

      <div className="mb-3 grid grid-cols-3 gap-2 md:max-w-lg">
        {counts.map((c) => (
          <div key={c.label} className="rounded-xl bg-card3 px-2 py-2.5 text-center">
            <div className="text-lg font-extrabold text-text">{c.n}</div>
            <div className="mb-1 text-[9px] text-muted">{c.label}</div>
            <ConfBar pct={90} />
          </div>
        ))}
      </div>

      <div className="mb-3">
        <PillTabs
          options={filters}
          active={filter}
          onChange={setFilter}
        />
      </div>

      {filter === 'Parlays' ? (
        <ParlayTeaser />
      ) : (
        <>
          {filtered.map((edge) => (
            <EdgeCard key={edge.id} edge={edge} teamColors={teamColors} sportsbook={settings.sportsbook} sport={sport} />
          ))}
          <EdgeDisclaimer className="mt-2" />
        </>
      )}
    </div>
  )
}
