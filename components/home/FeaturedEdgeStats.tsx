'use client'

import Link from 'next/link'
import { useState } from 'react'
import { BetAnalysis } from '@/components/breakdown/BetAnalysis'
import { GradeBadge, InsightList, SharpFindBadge } from '@/components/breakdown/BetCard'
import { explainBet } from '@/lib/edges/explainBet'
import { BestBetsDrawer } from '@/components/home/BestBetsDrawer'
import { InjuryDrawer } from '@/components/home/InjuryDrawer'
import { BaseCard } from '@/components/ui/Cards'
import { Drawer } from '@/components/ui/Drawer'
import { SportBadge } from '@/components/ui/SportBadge'
import { useAccountData } from '@/lib/account/AccountDataContext'
import { formatOdds } from '@/lib/account/odds'
import type { TodayBet } from '@/lib/edges/todaysBets'
import { filterBestBets } from '@/lib/home/bestBets'
import type { Injury } from '@/lib/home/injuries'
import type { TopEdgeResult } from '@/lib/home/topEdges'
import type { Sport } from '@/lib/sport/SportContext'

/** The single highest-conviction bet across today games (or within the selected sport). */
function BestBetCard({ bets, sportFilter }: { bets: TodayBet[]; sportFilter: Sport | 'all' }) {
  const { settings } = useAccountData()
  const [insightsOpen, setInsightsOpen] = useState(false)
  const pool = sportFilter === 'all' ? bets : bets.filter((b) => b.bet.sport === sportFilter)
  const top = pool[0]

  if (!top) {
    return (
      <BaseCard className="flex flex-col justify-center !p-3.5">
        <div className="flex items-center gap-1.5 text-[11px] font-extrabold text-text">
          <span>🎯</span> Today&apos;s Best Bet
        </div>
        <p className="mt-1 text-[11px] text-muted">No graded bet for {sportFilter === 'all' ? 'today' : 'this sport'} yet — grades appear once the evidence supports a bet.</p>
      </BaseCard>
    )
  }

  const b = top.bet
  const shown = b.insights.filter((i) => i.description).slice(0, 2)
  return (
    <div className="rounded-[14px] border border-grade-a/30 p-3.5 shadow-[0_0_16px_rgba(0,229,160,0.06)]" style={{ background: 'linear-gradient(135deg, #111318 0%, #0D1A14 100%)' }}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5 text-[12px] font-extrabold text-text">
            <span>🎯</span> Today&apos;s Best Bet
          </div>
          <div className="text-[10px] text-muted">Highest conviction across today&apos;s games</div>
        </div>
        <SportBadge sport={b.sport} />
      </div>

      <div className="mt-2.5 flex items-center gap-3">
        <GradeBadge grade={b.grade} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[11px] font-semibold text-muted">{b.matchup}</div>
          <div className="truncate text-[14px] font-extrabold text-text" title={b.description}>
            {b.description}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
            {b.odds !== null && (
              <span className="stat-number text-[13px] text-accent">
                {formatOdds(b.odds, settings.oddsFormat)} <span className="text-[10px] font-semibold text-muted">{b.book}</span>
              </span>
            )}
            {b.historicalHitRate !== null && <span className="text-[11px] text-text2">{Math.round(b.historicalHitRate)}% historical</span>}
            {b.isSharpFind && <SharpFindBadge />}
          </div>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        {shown.length > 0 && (
          <button onClick={() => setInsightsOpen(true)} className="text-[11px] font-semibold text-accent hover:underline">
            {shown.length} supporting insight{shown.length === 1 ? '' : 's'} →
          </button>
        )}
        <Link href={top.href} className="text-[11px] font-semibold text-accent hover:underline">
          View full breakdown →
        </Link>
      </div>
      {b.explain && <BetAnalysis className="mt-2" text={() => explainBet(b)} />}
      <p className="mt-2 text-[9px] leading-snug text-muted">Grades reflect statistical evidence and historical patterns, not a guarantee. Not betting advice.</p>

      {insightsOpen && (
        <Drawer title={b.description} subtitle={`${b.matchup} · Grade ${b.grade}`} onClose={() => setInsightsOpen(false)}>
          <InsightList insights={shown} />
          <Link href={top.href} className="mt-4 block text-[11px] font-semibold text-accent hover:underline" onClick={() => setInsightsOpen(false)}>
            View full breakdown →
          </Link>
        </Drawer>
      )}
    </div>
  )
}

function GatewayCard({ icon, count, label, borderClass, onClick, href }: { icon: string; count: number; label: string; borderClass: string; onClick?: () => void; href?: string }) {
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

export function FeaturedEdgeStats({ allEdges, injuries, todayBets, sportFilter }: { allEdges: TopEdgeResult[]; injuries: Injury[]; todayBets: TodayBet[]; sportFilter: Sport | 'all' }) {
  const { settings } = useAccountData()
  const [drawer, setDrawer] = useState<'bestBets' | 'injuries' | null>(null)

  const { results: bestBets } = filterBestBets(todayBets, settings)

  return (
    <>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch lg:gap-5">
        <div className="lg:flex-1">
          <BestBetCard bets={todayBets} sportFilter={sportFilter} />
        </div>

        <div className="grid grid-cols-3 gap-2 lg:w-[45%] lg:gap-2.5">
          <GatewayCard icon="⚡" count={allEdges.length} label="Edges Today" borderClass="border-accent/40" href="/edges" />
          <GatewayCard icon="🎯" count={bestBets.length} label="Best Bets for You" borderClass="border-grade-a/40" onClick={() => setDrawer('bestBets')} />
          <GatewayCard icon="🩹" count={injuries.length} label="Injury Updates" borderClass="border-warning/40" onClick={() => setDrawer('injuries')} />
        </div>
      </div>

      {drawer === 'bestBets' && <BestBetsDrawer bets={todayBets} onClose={() => setDrawer(null)} />}
      {drawer === 'injuries' && <InjuryDrawer injuries={injuries} onClose={() => setDrawer(null)} />}
    </>
  )
}
