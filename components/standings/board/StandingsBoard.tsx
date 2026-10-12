'use client'

import { useMemo, useState } from 'react'
import { computePicture, computeStatuses } from '@/lib/standings/playoffs'
import type { SportStandings } from '@/lib/standings/types'
import { columnsFor, gridTemplates } from './columns'
import { ConferenceToggle } from './ConferenceToggle'
import { DivisionSection } from './DivisionSection'
import { PlayoffPicture } from './PlayoffPicture'

const SHORT_LABELS: Record<string, string> = { AL: 'AL', NL: 'NL', AFC: 'AFC', NFC: 'NFC', East: 'East', West: 'West' }

export function StandingsBoard({ data, teamColors }: { data: SportStandings; teamColors: Record<string, string> }) {
  const [confId, setConfId] = useState(data.conferences[0].id)
  const [highlight, setHighlight] = useState<string | null>(null)

  const cols = useMemo(() => columnsFor(data), [data])
  const templates = useMemo(() => gridTemplates(cols), [cols])
  const statuses = useMemo(() => computeStatuses(data), [data])

  const conf = data.conferences.find((c) => c.id === confId) ?? data.conferences[0]
  const picture = useMemo(() => computePicture(data, conf.id, statuses), [data, conf.id, statuses])

  const toggleHighlight = (key: string) => setHighlight((cur) => (cur === key ? null : key))

  return (
    <div className="flex flex-col gap-4">
      <ConferenceToggle
        options={data.conferences.map((c) => ({ id: c.id, label: SHORT_LABELS[c.id] ?? c.id }))}
        value={conf.id}
        onChange={(id) => {
          setConfId(id)
          setHighlight(null)
        }}
      />

      <div className="flex flex-col gap-5 2xl:grid 2xl:grid-cols-[minmax(0,1fr)_360px] 2xl:items-start">
        <div className="flex flex-col gap-4">
          {conf.divisions.map((division) => {
            const rows = data.rows.filter((r) => r.division === division).sort((a, b) => a.divRank - b.divRank)
            if (rows.length === 0) return null
            return (
              <DivisionSection
                key={division}
                division={division}
                rows={rows}
                data={data}
                cols={cols}
                templates={templates}
                teamColors={teamColors}
                statuses={statuses}
                highlight={highlight}
                onHighlight={toggleHighlight}
              />
            )
          })}
        </div>

        <div className="2xl:sticky 2xl:top-4">
          <PlayoffPicture title={conf.label} picture={picture} data={data} teamColors={teamColors} />
        </div>
      </div>
    </div>
  )
}
