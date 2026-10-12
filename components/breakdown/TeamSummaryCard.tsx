'use client'

import { useState } from 'react'
import type { TeamSummary } from '@/data/breakdown/summaryTypes'

const FORM_COLOR: Record<string, string> = {
  W: 'bg-positive',
  L: 'bg-negative',
  P: 'bg-warning',
}

const TONE_TEXT: Record<string, string> = {
  positive: 'text-positive',
  negative: 'text-negative',
  warning: 'text-warning',
  accent: 'text-accent',
  neutral: 'text-muted',
}

export function TeamSummaryCard({
  team,
  teamColor,
}: {
  team: TeamSummary
  teamColor: string
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      className="mb-3 overflow-hidden rounded-2xl bg-card p-3.5"
      style={{ border: `1px solid ${teamColor}` }}
    >
      <div className="mb-2 flex items-center justify-between">
        <div>
          <div className="text-xs text-muted">
            {team.abbr} — {team.side} Record
          </div>
          <div className="text-[10px] text-muted">Last 5 games</div>
        </div>
        <div className="flex gap-1">
          {team.form.map((r, i) => (
            <div key={i} className={`h-2 w-2 rounded-full ${FORM_COLOR[r]}`} />
          ))}
        </div>
      </div>

      <div className="mb-3 flex items-baseline gap-2.5">
        <span className="text-4xl font-black text-positive">{team.record}</span>
        <span className="text-sm font-semibold text-text2">{team.winPct}% win rate</span>
      </div>

      <div className="mb-2 text-[9px] font-bold tracking-[0.1em] text-muted">OFFENSE</div>
      <div className="mb-3 grid grid-cols-4 gap-1.5">
        {team.offense.map((s) => (
          <div key={s.label} className="rounded-lg bg-card3 py-2 text-center">
            <div className="text-[13px] font-bold text-text">{s.value}</div>
            <div className="mt-0.5 text-[8px] text-muted">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="mb-2 text-[9px] font-bold tracking-[0.1em] text-muted">
        DEFENSE (OPP. ALLOWED)
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {team.defense.map((s) => (
          <div key={s.label} className="rounded-lg bg-card3 py-2 text-center">
            <div className="text-[13px] font-bold text-text2">{s.value}</div>
            <div className="mt-0.5 text-[8px] text-muted">{s.label}</div>
          </div>
        ))}
      </div>

      <button
        onClick={() => setExpanded((v) => !v)}
        className="mt-2.5 w-full text-center text-[10px] font-semibold text-accent"
      >
        {expanded ? 'Hide' : 'Show'} Last 5 Games {expanded ? '▲' : '▼'}
      </button>

      {expanded && (
        <div className="mt-2.5 overflow-x-auto">
          <table className="w-full border-collapse text-[10px]">
            <thead>
              <tr className="font-bold text-muted">
                {team.logColumns.map((c) => (
                  <th key={c.key} className="px-1.5 py-1 text-left">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {team.log.map((row, i) => (
                <tr key={i} className="border-t border-border">
                  {row.cells.map((cell, j) => (
                    <td
                      key={j}
                      className={`px-1.5 py-1 ${
                        cell.tone ? `font-bold ${TONE_TEXT[cell.tone]}` : 'text-text2'
                      }`}
                    >
                      {cell.value}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
