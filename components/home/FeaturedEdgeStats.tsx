'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { BestBetsDrawer } from '@/components/home/BestBetsDrawer'
import { InjuryDrawer } from '@/components/home/InjuryDrawer'
import { TeamLink } from '@/components/teams/TeamLink'
import { BaseCard } from '@/components/ui/Cards'
import { SportBadge } from '@/components/ui/SportBadge'
import { useAccountData } from '@/lib/account/AccountDataContext'
import { formatOdds } from '@/lib/account/odds'
import { filterBestBets } from '@/lib/home/bestBets'
import type { BestBetPick } from '@/lib/home/bestBetPicks'
import type { Injury } from '@/lib/home/injuries'
import type { TopEdgeResult } from '@/lib/home/topEdges'
import { probTone } from '@/lib/parlay/math'
import type { Sport } from '@/lib/sport/SportContext'

const ROTATE_MS = 6000

function BestBetCard({ picks, sportFilter, onOpenDrawer }: { picks: BestBetPick[]; sportFilter: Sport | 'all'; onOpenDrawer: () => void }) {
  const { settings } = useAccountData()
  const bets = sportFilter === 'all' ? picks : picks.filter((b) => b.sport === sportFilter)
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    setIndex(0)
  }, [sportFilter])

  useEffect(() => {
    if (paused || bets.length < 2) return
    const timer = setInterval(() => setIndex((i) => (i + 1) % bets.length), ROTATE_MS)
    return () => clearInterval(timer)
  }, [paused, bets.length])

  if (bets.length === 0) {
    return (
      <BaseCard className="flex flex-col justify-center !p-3.5">
        <div className="flex items-center gap-1.5 text-[11px] font-extrabold text-text">
          <span>🎯</span> Today&apos;s Best Bet
        </div>
        <p className="mt-1 text-[11px] text-muted">No priced pick for {sportFilter === 'all' ? 'today' : 'this sport'} yet — lines post closer to game time.</p>
      </BaseCard>
    )
  }

  const bet = bets[index % bets.length]
  const tone = probTone(bet.hitRate)
  const edgeColor = bet.edgePts > 0 ? 'text-win' : 'text-muted'

  return (
    <div
      className="rounded-[14px] border border-grade-a/30 p-3.5 shadow-[0_0_16px_rgba(0,229,160,0.06)]"
      style={{ background: 'linear-gradient(135deg, #111318 0%, #0D1A14 100%)' }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5 text-[12px] font-extrabold text-text">
            <span>🎯</span> Today&apos;s Best Bet
          </div>
          <div className="text-[10px] text-muted">Top-rated insight, priced at a real sportsbook line</div>
        </div>
        <SportBadge sport={bet.sport} />
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-[14px] font-extrabold text-text" title={bet.pick}>
            <TeamLink sport={bet.sport} abbr={bet.team} className="hover:text-accent hover:underline">
              {bet.team}
            </TeamLink>{' '}
            Moneyline <span className="text-[11px] font-semibold text-muted">· {bet.matchup}</span>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="stat-number text-[13px] text-accent">{formatOdds(bet.oddsAmerican, settings.oddsFormat)}</span>
            <span className="text-[10px] text-muted">{bet.book}</span>
            <Link href={bet.href} className="text-[11px] font-semibold text-accent hover:underline">
              Game breakdown →
            </Link>
          </div>
          <button onClick={onOpenDrawer} className="mt-0.5 text-[11px] font-semibold text-accent hover:underline">
            {bet.trends} supporting trend{bet.trends === 1 ? '' : 's'} →
          </button>
        </div>
        <div className="shrink-0 text-right">
          <div className="stat-featured leading-none" style={{ color: tone.color }}>
            {bet.hitRate}%
          </div>
          <div className="mt-0.5 text-[9px] text-muted">est. hit rate</div>
          <div className={`mt-1 text-[10px] font-bold ${edgeColor}`} title={`Market implies ${bet.marketProb}% (no vig)`}>
            {bet.edgePts > 0 ? '+' : ''}
            {bet.edgePts} pts vs market
          </div>
        </div>
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-2">
        <p className="text-[9px] leading-snug text-muted">
          Hit rate is estimated from the insight&apos;s confidence; the price is the book&apos;s real line. Not a guarantee.
        </p>
        {bets.length > 1 && (
          <div className="flex shrink-0 gap-1" role="tablist" aria-label="Best bet suggestions">
            {bets.map((_, i) => (
              <button
                key={i}
                onClick={() => setIndex(i)}
                aria-label={`Show suggestion ${i + 1}`}
                className={`h-1.5 rounded-full transition-all ${i === index % bets.length ? 'w-4 bg-grade-a' : 'w-1.5 bg-border2'}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function GatewayCard({
  icon,
  count,
  label,
  borderClass,
  onClick,
  href,
}: {
  icon: string
  count: number
  label: string
  borderClass: string
  onClick?: () => void
  href?: string
}) {
  const content = (
    <BaseCard className={`flex h-full w-full flex-col !p-3 ${borderClass}`}>
      <div className="flex items-center justify-between">
        <span className="text-base">{icon}</span>
        <span className="stat-featured text-text">{count}</span>
      </div>
      <span className="mt-1 text-[10px] font-semibold uppercase leading-tight tracking-wide text-muted">{label}</span>
      <span className="mt-auto pt-1.5 text-[10px] font-semibold text-accent">View →</span>
    </BaseCard>
  )

  if (href) {
    return (
      <Link href={href} className="flex">
        {content}
      </Link>
    )
  }
  return (
    <button onClick={onClick} className="flex text-left">
      {content}
    </button>
  )
}

export function FeaturedEdgeStats({ allEdges, injuries, bestBetPicks, sportFilter }: { allEdges: TopEdgeResult[]; injuries: Injury[]; bestBetPicks: BestBetPick[]; sportFilter: Sport | 'all' }) {
  const { settings } = useAccountData()
  const [drawer, setDrawer] = useState<'bestBets' | 'injuries' | null>(null)

  const { results: bestBets } = filterBestBets(allEdges, settings)

  return (
    <>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch lg:gap-5">
        <div className="lg:flex-1">
          <BestBetCard picks={bestBetPicks} sportFilter={sportFilter} onOpenDrawer={() => setDrawer('bestBets')} />
        </div>

        <div className="grid grid-cols-3 gap-2 lg:w-[45%] lg:gap-2.5">
          <GatewayCard icon="⚡" count={allEdges.length} label="Edges Today" borderClass="border-accent/40" href="/edges" />
          <GatewayCard icon="🎯" count={bestBets.length} label="Best Bets for You" borderClass="border-grade-a/40" onClick={() => setDrawer('bestBets')} />
          <GatewayCard icon="🩹" count={injuries.length} label="Injury Updates" borderClass="border-warning/40" onClick={() => setDrawer('injuries')} />
        </div>
      </div>

      {drawer === 'bestBets' && <BestBetsDrawer edges={allEdges} onClose={() => setDrawer(null)} />}
      {drawer === 'injuries' && <InjuryDrawer injuries={injuries} onClose={() => setDrawer(null)} />}
    </>
  )
}
