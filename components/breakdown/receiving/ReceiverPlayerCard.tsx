'use client'

import { useState } from 'react'
import { BetTile } from '@/components/breakdown/BetTile'
import { PlayerLink } from '@/components/players/PlayerLink'
import type { ReceiverDetail } from '@/data/breakdown/receivingTypes'

export function ReceiverPlayerCard({ p, bettingMode }: { p: ReceiverDetail; bettingMode: boolean }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="rounded-2xl border border-border bg-card p-3.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[11px]">{p.hot ? '🔥' : ''}</span>
          <div>
            <div className="text-[9px] font-bold tracking-[0.05em] text-muted">{p.role}</div>
            <PlayerLink name={p.name} className="text-[13px] font-bold text-text hover:text-accent hover:underline">
              {p.name}
            </PlayerLink>
          </div>
        </div>
        {!bettingMode && (
          <button onClick={() => setExpanded((v) => !v)} className="text-[10px] font-semibold text-accent">
            {expanded ? 'Hide' : 'Last 3'} {expanded ? '▲' : '▼'}
          </button>
        )}
      </div>

      {!bettingMode && (
        <div className="mt-3 grid grid-cols-4 gap-1.5">
          <div className="rounded-lg bg-card3 py-2 text-center">
            <div className="text-[13px] font-bold text-text">{p.tgt.toFixed(1)}</div>
            <div className="mt-0.5 text-[8px] text-muted">Tgt/G</div>
          </div>
          <div className="rounded-lg bg-card3 py-2 text-center">
            <div className="text-[13px] font-bold text-text">{p.rec.toFixed(1)}</div>
            <div className="mt-0.5 text-[8px] text-muted">Rec/G</div>
          </div>
          <div className="rounded-lg bg-card3 py-2 text-center">
            <div className="text-[13px] font-bold text-text">{p.yds.toFixed(1)}</div>
            <div className="mt-0.5 text-[8px] text-muted">Yds/G</div>
          </div>
          <div className="rounded-lg bg-card3 py-2 text-center">
            <div className="text-[13px] font-bold text-text">{p.td}</div>
            <div className="mt-0.5 text-[8px] text-muted">TDs</div>
          </div>
        </div>
      )}

      {bettingMode && (
        <div className="mt-3 grid grid-cols-3 gap-1.5">
          <BetTile {...p.bet.recYds} />
          <BetTile {...p.bet.receptions} />
          <BetTile {...p.bet.anytimeTd} />
        </div>
      )}

      {!bettingMode && expanded && (
        <div className="mt-3 overflow-x-auto rounded-xl border border-border">
          <div style={{ minWidth: 360 }}>
            <div className="grid grid-cols-5 gap-1 border-b border-border bg-card3 px-2.5 py-1.5">
              {['OPP', 'DATE', 'TGT', 'REC', 'YDS'].map((h) => (
                <div key={h} className="text-[9px] font-bold text-muted">{h}</div>
              ))}
            </div>
            {p.last3.map((g, i) => (
              <div
                key={i}
                className={`grid grid-cols-5 gap-1 px-2.5 py-2 ${i < p.last3.length - 1 ? 'border-b border-border' : ''}`}
              >
                <div className="text-[11px] font-semibold text-text">{g.opp}</div>
                <div className="text-[10px] text-muted">{g.date}</div>
                <div className="text-[11px] text-text2">{g.tgt}</div>
                <div className="text-[11px] text-text2">{g.rec}</div>
                <div className="text-[11px] font-semibold text-text">
                  {g.yds}{g.td > 0 ? ` (${g.td} TD)` : ''}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
