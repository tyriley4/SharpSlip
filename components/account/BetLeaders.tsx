'use client'

import { useMemo } from 'react'
import { readableTeamColor } from '@/components/leaders/board/theme'
import { MLB_TEAM_COLORS } from '@/data/mlb/teamColors'
import { NBA_TEAM_COLORS } from '@/data/nba/teamColors'
import { NFL_TEAM_COLORS } from '@/data/nfl/teamColors'
import { NHL_TEAM_COLORS } from '@/data/nhl/teamColors'
import { playerTallies, profitText, recordText, teamTallies, type BetTally } from '@/lib/account/betBreakdown'
import { useBets } from '@/lib/account/BetsContext'
import type { BetSport } from '@/lib/account/types'

const COLORS: Record<BetSport, Record<string, string>> = { mlb: MLB_TEAM_COLORS, nfl: NFL_TEAM_COLORS, nba: NBA_TEAM_COLORS, nhl: NHL_TEAM_COLORS }

function Row({ rank, title, sub, tally, badge, color }: { rank: number; title: string; sub: string; tally: BetTally; badge: string; color: string }) {
  const profitColor = tally.profit > 0 ? 'text-win' : tally.profit < 0 ? 'text-loss' : 'text-text2'
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3" style={{ borderLeft: `3px solid ${color}` }}>
      <span className="w-4 text-center text-[11px] font-extrabold text-muted">{rank}</span>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[10px] font-extrabold" style={{ background: `${color}22`, color, border: `1px solid ${color}55` }}>
        {badge}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-bold text-text">{title}</div>
        <div className="text-[10px] text-muted">{sub}</div>
      </div>
      <div className="shrink-0 text-right">
        <div className={`stat-number text-[1rem] ${profitColor}`}>{profitText(tally.profit)}</div>
        <div className="text-[10px] text-muted">
          {recordText(tally)} · {tally.bets} bet{tally.bets === 1 ? '' : 's'}
        </div>
      </div>
    </div>
  )
}

/** Teams and players you actually bet on, ranked by how often (Most Bet) or how much you've won (Most Profitable). */
export function BetLeaders({ mode }: { mode: 'bets' | 'profit' }) {
  const { bets, loading } = useBets()
  const teams = useMemo(() => teamTallies(bets), [bets])
  const players = useMemo(() => playerTallies(bets), [bets])

  const rank = <T extends BetTally>(list: T[]): T[] =>
    [...list]
      .filter((t) => (mode === 'profit' ? t.profit > 0 : true))
      .sort((a, b) => (mode === 'profit' ? b.profit - a.profit : b.bets - a.bets || b.profit - a.profit))
      .slice(0, 8)

  const topTeams = rank(teams)
  const topPlayers = rank(players)

  if (loading) {
    return <div className="rounded-2xl border border-border bg-card py-10 text-center text-xs text-muted">Loading your bets…</div>
  }

  if (topTeams.length === 0 && topPlayers.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card px-5 py-10 text-center text-xs leading-relaxed text-muted">
        {mode === 'profit'
          ? 'No profitable teams or players yet. Win a moneyline, spread or player prop and they will show up here.'
          : 'Log moneyline, spread or player-prop bets with the Bet Tracker and the teams and players you back most will show up here.'}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {topTeams.length > 0 && (
        <div>
          <div className="mb-2 text-[10px] font-extrabold tracking-[0.1em] text-muted">TEAMS {mode === 'profit' ? 'YOU PROFIT ON' : 'YOU BET MOST'}</div>
          <div className="flex flex-col gap-2">
            {topTeams.map((t, i) => (
              <Row key={`${t.sport}-${t.abbr}`} rank={i + 1} title={t.abbr} sub={t.sport.toUpperCase()} tally={t} badge={t.abbr} color={readableTeamColor(COLORS[t.sport][t.abbr] ?? '#3B9EFF')} />
            ))}
          </div>
        </div>
      )}
      {topPlayers.length > 0 && (
        <div>
          <div className="mb-2 text-[10px] font-extrabold tracking-[0.1em] text-muted">PLAYERS {mode === 'profit' ? 'YOU PROFIT ON' : 'YOU BET MOST'}</div>
          <div className="flex flex-col gap-2">
            {topPlayers.map((p, i) => (
              <Row key={`${p.sport}-${p.name}`} rank={i + 1} title={p.name} sub={`${p.sport.toUpperCase()} · player props`} tally={p} badge={p.name.split(' ').map((w) => w[0]).slice(0, 2).join('')} color="#3B9EFF" />
            ))}
          </div>
        </div>
      )}
      <p className="text-[10px] leading-relaxed text-muted">Straight bets only — parlay and teaser results belong to the whole ticket, so they&apos;re not credited to individual teams.</p>
    </div>
  )
}
