'use client'

import { useState } from 'react'
import { PlayerLink } from '@/components/players/PlayerLink'
import { propCats, propLabels } from '@/data/breakdown/battingTypes'
import type { TeamBatting } from '@/data/breakdown/battingTypes'

export function BattingPropsTable({ team, batting }: { team: string; batting: TeamBatting }) {
  const [activeProp, setActiveProp] = useState<string>(propCats[0])
  const hotPlayers = batting.lineup
    .map((p, i) => ({ p, pd: batting.props[i] }))
    .filter(({ pd }) => pd?.label === 'Hot')

  return (
    <div>
      {hotPlayers.length > 0 && (
        <div className="mb-3 rounded-2xl border border-positive/20 bg-positive/[0.06] p-3.5">
          <div className="mb-2 text-[9px] font-extrabold tracking-[0.1em] text-positive">
            🎯 BEST PROP TARGETS TONIGHT — {team}
          </div>
          <div className="flex flex-col gap-1.5">
            {hotPlayers.map(({ p, pd }) => (
              <div key={p.name} className="flex items-start gap-1.5">
                <span className="shrink-0 text-[11px] text-positive">•</span>
                <div className="text-[11px] leading-relaxed text-text2">
                  <PlayerLink name={p.name} className="font-bold text-text hover:text-accent hover:underline">
                    {p.name}
                  </PlayerLink>{' '}
                  — {pd.targets}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="mb-3 rounded-[10px] border border-border bg-card p-2.5 text-[11px] leading-relaxed text-text2">
        Player prop hit rates this season — how often each batter has covered common prop lines.
      </p>

      <div className="mb-3 flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {propCats.map((cat) => {
          const isActive = activeProp === cat
          return (
            <button
              key={cat}
              onClick={() => setActiveProp(cat)}
              className={`shrink-0 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-[11px] font-semibold transition-colors ${
                isActive ? 'border-accent bg-accent text-white' : 'border-border bg-transparent text-muted'
              }`}
            >
              {propLabels[cat]}
            </button>
          )
        })}
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="grid grid-cols-[24px_1fr_44px_56px_48px_52px] gap-1 border-b border-border bg-card3 px-2.5 py-2">
          {['#', 'BATTER', 'POS', 'Record', 'Hit%', 'Streak'].map((h) => (
            <div key={h} className={`text-[9px] font-bold text-muted ${h === '#' || h === 'BATTER' ? 'text-left' : 'text-center'}`}>
              {h}
            </div>
          ))}
        </div>
        {batting.lineup.map((p, i) => {
          const pd = batting.props[i]
          const rec = pd?.rec[activeProp] ?? '--'
          const pct = pd?.pct[activeProp] ?? 0
          const streak = pd?.streak[activeProp] ?? '--'
          const label = pd?.label ?? 'Avg'
          const isBest = pct >= 65
          const pctColor = isBest ? 'text-positive' : pct <= 40 ? 'text-negative' : 'text-text2'
          const barColor = isBest ? 'bg-positive' : pct <= 40 ? 'bg-negative' : 'bg-accent'
          const lblColor = label === 'Hot' ? 'text-hot' : label === 'Cold' ? 'text-cold' : 'text-muted'
          const lblBg = label === 'Hot' ? 'bg-hot/10' : label === 'Cold' ? 'bg-cold/10' : 'bg-white/5'
          const strEndsW = streak.endsWith('W')
          const strColor = strEndsW ? 'text-positive' : streak.endsWith('L') ? 'text-negative' : 'text-muted'
          return (
            <div
              key={p.name}
              className={`px-2.5 py-2 ${i < batting.lineup.length - 1 ? 'border-b border-border' : ''} ${
                isBest ? 'bg-positive/[0.04]' : ''
              }`}
            >
              <div className="grid grid-cols-[24px_1fr_44px_56px_48px_52px] items-center gap-1">
                <div className="text-[10px] font-semibold text-muted">{i + 1}</div>
                <div>
                  <div className={`mb-0.5 inline-flex items-center gap-1 rounded-lg px-1.5 py-0.5 ${lblBg}`}>
                    <span className={`text-[8px] font-bold ${lblColor}`}>
                      {label === 'Hot' ? '🔥 Hot' : label === 'Cold' ? '❄️ Cold' : '— Avg'}
                    </span>
                  </div>
                  <PlayerLink
                    name={p.name}
                    className="block truncate text-[11px] font-semibold text-text hover:text-accent hover:underline"
                  >
                    {p.name}
                  </PlayerLink>
                </div>
                <div className="text-center text-[10px] text-text2">{p.pos}</div>
                <div className="text-center text-[10px] text-text2">{rec}</div>
                <div className={`text-center text-[11px] font-bold ${pctColor}`}>{pct}%</div>
                <div className={`text-center text-[10px] font-semibold ${strColor}`}>{streak}</div>
              </div>
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-border">
                <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
