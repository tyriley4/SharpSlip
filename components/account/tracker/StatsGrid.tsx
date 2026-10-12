'use client'

import { useMemo } from 'react'
import { computeBetStats } from '@/lib/account/betStats'
import { formatAmericanOdds } from '@/lib/account/odds'
import type { Bet } from '@/lib/account/types'

function StatCard({ label, value, color = 'text-text', sub }: { label: string; value: string; color?: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3.5">
      <div className={`stat-number text-[1.45rem] leading-none md:text-[1.7rem] ${color}`}>{value}</div>
      <div className="mt-2 text-[10px] font-bold uppercase tracking-[0.08em] text-muted">{label}</div>
      {sub && <div className="mt-0.5 text-[10px] text-muted">{sub}</div>}
    </div>
  )
}

const dollars = (n: number) => `${n > 0 ? '+' : n < 0 ? '-' : ''}$${Math.abs(Math.round(n)).toLocaleString('en-US')}`

/** Six-card dashboard: record, win rate, ROI, profit, average price and current streak. */
export function StatsGrid({ bets }: { bets: Bet[] }) {
  const s = useMemo(() => computeBetStats(bets), [bets])
  const settled = s.wins + s.losses + s.pushes > 0

  return (
    <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3">
      <StatCard label="Overall Record" value={`${s.wins}-${s.losses}-${s.pushes}`} sub={s.pending > 0 ? `${s.pending} pending` : 'W-L-P'} />
      <StatCard label="Win Rate" value={settled ? `${s.winRate}%` : '—'} color={!settled ? 'text-muted' : s.winRate > 55 ? 'text-win' : s.winRate < 50 ? 'text-loss' : 'text-text'} />
      <StatCard label="ROI" value={settled ? `${s.roi > 0 ? '+' : s.roi < 0 ? '-' : ''}${Math.abs(s.roi)}%` : '—'} color={!settled ? 'text-muted' : s.roi > 0 ? 'text-win' : s.roi < 0 ? 'text-loss' : 'text-text'} sub={settled ? `on $${s.totalStaked.toLocaleString('en-US')} staked` : undefined} />
      <StatCard
        label="Total Profit"
        value={settled ? dollars(s.totalProfit) : '—'}
        color={!settled ? 'text-muted' : s.totalProfit > 0 ? 'text-win' : s.totalProfit < 0 ? 'text-loss' : 'text-text'}
        sub={settled ? `${s.units > 0 ? '+' : ''}${s.units} units ($10 each)` : undefined}
      />
      <StatCard label="Avg Odds" value={s.avgOdds !== null ? formatAmericanOdds(s.avgOdds) : '—'} color={s.avgOdds === null ? 'text-muted' : 'text-text'} />
      <StatCard label="Current Streak" value={s.streak.type ? `${s.streak.type}${s.streak.count}` : '—'} color={s.streak.type === 'W' ? 'text-win' : s.streak.type === 'L' ? 'text-loss' : 'text-muted'} />
    </div>
  )
}
