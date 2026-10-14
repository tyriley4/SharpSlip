'use client'

import { useMemo, useState } from 'react'
import { PropConviction, usePlayerConviction, type ConvictionPlayer } from '@/components/players/PropConviction'
import { CBB_BETTING_THRESHOLDS, formatCbbThreshold } from '@/lib/college/cbbProps'
import { CFB_BETTING_THRESHOLDS, formatCfbThreshold } from '@/lib/college/cfbProps'
import type { StatLine } from '@/lib/players/types'

export interface CalcGame {
  date: string
  opp: string
  home: boolean
  values: Record<string, number | null>
}

const LABELS: Record<string, string> = {
  passYds: 'Pass Yds', passTd: 'Pass TD', int: 'INT', compPct: 'Comp %', rating: 'Efficiency', rushYds: 'Rush Yds', rushTd: 'Rush TD', ypc: 'YPC', recYds: 'Rec Yds',
  rec: 'Rec', recTd: 'Rec TD', ypr: 'Yds/Catch', tackles: 'Tackles', sacks: 'Sacks', tfl: 'TFL', pd: 'PD',
  ppg: 'PPG', rpg: 'RPG', apg: 'APG', spg: 'SPG', bpg: 'BPG', mpg: 'MPG', fgPct: 'FG %', tpPct: '3P %', ftPct: 'FT %', tpmPg: '3PM/G',
}

/** Season stat tiles for a college player. */
export function CfbSeasonStats({ stats, games, label = 'SEASON STATS' }: { stats: StatLine; games: number; label?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3.5 md:p-5">
      <div className="mb-3 text-[9px] font-extrabold tracking-[0.1em] text-muted md:text-[10px]">{label} · {games} GAMES</div>
      <div className="grid grid-cols-3 gap-2 md:grid-cols-6">
        {Object.entries(stats).map(([k, v]) => (
          <div key={k} className="rounded-xl border border-border bg-card3 p-2.5 text-center">
            <div className="text-lg font-black text-text">{typeof v === 'number' ? v.toLocaleString('en-US') : v}</div>
            <div className="mt-0.5 text-[9px] font-bold uppercase tracking-wide text-muted">{LABELS[k] ?? k}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Pick a prop and a line; see how often this player has cleared it, game by game. */
export function CfbPropCalculator({ categories, games, color, league = 'cfb', caption = 'Hit rates from this season’s game logs', player }: { categories: string[]; games: CalcGame[]; color: string; league?: 'cfb' | 'cbb'; caption?: string; player?: ConvictionPlayer }) {
  const table = league === 'cbb' ? CBB_BETTING_THRESHOLDS : CFB_BETTING_THRESHOLDS
  const format = league === 'cbb' ? formatCbbThreshold : formatCfbThreshold
  const [category, setCategory] = useState(categories[0])
  const thresholds = table[category] ?? []
  const [threshold, setThreshold] = useState(thresholds[0])
  const [venue, setVenue] = useState<'All' | 'Home' | 'Away'>('All')

  const sample = useMemo(
    () => games.filter((g) => g.values[category] !== null && g.values[category] !== undefined && (venue === 'All' || (venue === 'Home') === g.home)),
    [games, category, venue]
  )
  const t = thresholds.includes(threshold) ? threshold : thresholds[0]
  const conviction = usePlayerConviction(player && thresholds.length > 0 ? { sport: league, name: player.name, team: player.team, category, thresholds } : null)
  const fmt = (n: number) => format(category, n)
  const hits = sample.filter((g) => (g.values[category] ?? 0) >= t).length
  const rate = sample.length > 0 ? Math.round((hits / sample.length) * 100) : null
  const rateColor = rate === null ? '#6B7280' : rate >= 65 ? '#00E5A0' : rate >= 50 ? '#FFB800' : '#EF4444'

  if (categories.length === 0) return null

  return (
    <div className="rounded-2xl border border-border bg-card p-3.5 md:p-5">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[9px] font-extrabold tracking-[0.1em] text-muted md:text-[10px]">PROP CALCULATOR</span>
        <span className="text-[10px] text-muted">{caption}</span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => {
              setCategory(c)
              setThreshold((table[c] ?? [])[0])
            }}
            className={`rounded-full border px-3 py-1.5 text-[11px] font-bold transition-colors ${category === c ? 'border-transparent text-white' : 'border-border bg-card3 text-text2 hover:text-text'}`}
            style={category === c ? { background: color } : undefined}
          >
            {c}
          </button>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {thresholds.map((x) => (
          <button
            key={x}
            onClick={() => setThreshold(x)}
            className={`rounded-full border px-3 py-1.5 text-[12px] font-extrabold transition-colors ${t === x ? 'border-accent bg-accent text-white' : 'border-border bg-card3 text-text2 hover:text-text'}`}
          >
            {format(category, x)}
            {conviction.data?.best === x && ' ★'}
          </button>
        ))}
      </div>
      <div className="mt-2 flex gap-1.5">
        {(['All', 'Home', 'Away'] as const).map((v) => (
          <button key={v} onClick={() => setVenue(v)} className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${venue === v ? 'border-accent text-accent' : 'border-border text-muted'}`}>
            {v}
          </button>
        ))}
      </div>

      {player && (
        <div className="mt-3">
          <PropConviction conviction={conviction} selected={t} onSelect={setThreshold} format={fmt} />
        </div>
      )}

      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <div className="text-4xl font-black" style={{ color: rateColor }}>{rate === null ? '—' : `${rate}%`}</div>
          <div className="text-[11px] text-muted">
            {sample.length === 0 ? 'No games with this stat yet' : `${hits}-${sample.length - hits} in ${sample.length} game${sample.length === 1 ? '' : 's'}`}
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-1">
          {sample.slice(0, 10).map((g, i) => {
            const hit = (g.values[category] ?? 0) >= t
            return (
              <span key={i} title={`${g.opp}: ${g.values[category]}`} className={`flex h-6 min-w-6 items-center justify-center rounded-md px-1 text-[10px] font-extrabold text-white ${hit ? 'bg-positive' : 'bg-negative'}`}>
                {g.values[category]}
              </span>
            )
          })}
        </div>
      </div>
      {rate !== null && <div className="mt-3 h-2 overflow-hidden rounded-full bg-border2"><div className="h-full rounded-full" style={{ width: `${rate}%`, background: rateColor }} /></div>}
      {sample.length > 0 && sample.length < 5 && <p className="mt-2 text-[10px] text-muted">Small sample — treat this with caution.</p>}
    </div>
  )
}
