'use client'

import { useState } from 'react'
import { BAD_STAT_KEYS, GOOD_STAT_KEYS, RECENT_FORM_COLUMNS, getPositionCategory } from '@/lib/players/columns'
import type { PlayerSport, RecentFormGame } from '@/lib/players/types'

export function RecentFormTable({
  games,
  sport,
  position,
}: {
  games: RecentFormGame[]
  sport: PlayerSport
  position: string
}) {
  const [expanded, setExpanded] = useState(false)
  const category = getPositionCategory(sport, position)
  const columns = RECENT_FORM_COLUMNS[category]
  const goodKeys = GOOD_STAT_KEYS[category]
  const badKeys = BAD_STAT_KEYS[category]

  const visible = games.slice(0, expanded ? 10 : 5)
  const cols = `44px 60px ${columns.map(() => '1fr').join(' ')} 44px`

  return (
    <div className="rounded-2xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-3.5 py-2.5 md:px-5 md:py-3">
        <span className="text-[9px] font-extrabold tracking-[0.1em] text-muted md:text-[10px]">
          RECENT FORM
        </span>
        {games.length > 5 && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-[10px] font-semibold text-accent md:text-[11px]"
          >
            {expanded ? 'Show Last 5' : 'Show Last 10'} {expanded ? '▲' : '▼'}
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <div style={{ minWidth: 460 }}>
          <div className="grid gap-1 border-b border-border bg-card3 px-3.5 py-2 md:px-5" style={{ gridTemplateColumns: cols }}>
            <div className="text-[9px] font-bold text-muted">OPP</div>
            <div className="text-[9px] font-bold text-muted">DATE</div>
            {columns.map((c) => (
              <div key={c.key} className="text-center text-[9px] font-bold text-muted">
                {c.label}
              </div>
            ))}
            <div className="text-center text-[9px] font-bold text-muted">W/L</div>
          </div>

          {visible.map((g, i) => (
            <div
              key={i}
              className={`grid items-center gap-1 px-3.5 py-2.5 md:px-5 ${i < visible.length - 1 ? 'border-b border-border' : ''}`}
              style={{ gridTemplateColumns: cols }}
            >
              <div className="text-xs font-bold text-text">{g.opp}</div>
              <div className="text-[10px] text-muted">{g.date}</div>
              {columns.map((c) => {
                const val = g.stats[c.key] ?? '--'
                const isGood = goodKeys.includes(c.key)
                const isBad = badKeys.includes(c.key)
                const color = isGood ? 'text-positive font-bold' : isBad ? 'text-negative font-bold' : 'text-text2'
                return (
                  <div key={c.key} className={`text-center text-xs ${color}`}>
                    {val}
                  </div>
                )
              })}
              <div className="flex justify-center">
                <div
                  className={`flex h-6 w-6 items-center justify-center rounded-md text-[11px] font-extrabold text-white ${
                    g.result === 'W' ? 'bg-positive' : 'bg-negative'
                  }`}
                >
                  {g.result}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
