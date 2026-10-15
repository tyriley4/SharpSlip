'use client'

import { useEffect, useMemo, useState } from 'react'
import { BettingSection } from '@/components/leaders/board/BettingSection'
import { BoardResults } from '@/components/leaders/board/BoardResults'
import { buildFilterChips, FilterBar } from '@/components/leaders/board/FilterBar'
import { ScrollPills } from '@/components/leaders/board/ScrollPills'
import { SimpleFilterPanel } from '@/components/leaders/board/SimpleFilterPanel'
import { teamFilterActive, useTeamFilter } from '@/components/leaders/board/teamFilter'
import { TeamPlayerFilter } from '@/components/leaders/board/TeamPlayerFilter'
import { SPORT_TAB_STYLES } from '@/components/leaders/board/theme'
import { boardRowsFromLeaders, type BoardContext } from '@/components/leaders/board/types'
import { useWindowedLeaders } from '@/components/leaders/board/useWindowedLeaders'
import { ViewToggle } from '@/components/leaders/board/ViewToggle'
import { VisualizeButton } from '@/components/leaders/board/VisualizeButton'
import { DataUnavailable } from '@/components/ui/DataUnavailable'
import { NBA_TEAM_COLORS } from '@/data/nba/teamColors'
import type { LeaderGroup } from '@/data/leaders/types'
import { useBettingRank } from '@/lib/betting/useBettingRank'
import type { BettingLeaderRow } from '@/lib/mlb/bettingLeaders'
import { NBA_TEAM_NAMES } from '@/lib/nba/divisions'
import { DEFAULT_NBA_FILTERS, HOME_AWAY_OPTIONS, MONTH_OPTIONS, TIME_WINDOWS, type NBALeaderFilters, type TimeWindow } from '@/lib/nba/filters'
import { NBA_BETTING_CATEGORIES, NBA_BETTING_THRESHOLDS, type NBABettingCategory } from '@/lib/nba/leaderCategories'

const EMPTY_ROWS: BettingLeaderRow[] = []
const FILTER_LABELS = { window: 'Window', homeAway: 'Venue', month: 'Month' }
const TEAMS = Object.keys(NBA_TEAM_NAMES)
  .map((abbr) => ({ abbr, name: NBA_TEAM_NAMES[abbr] }))
  .sort((a, b) => a.name.localeCompare(b.name))

function formatThreshold(n: number): string {
  return `${n}+`
}

export function NbaLeadersView({ leaders, season, onVisualize }: { leaders: LeaderGroup | null; season: string; onVisualize: () => void }) {
  const [sub, setSub] = useState('Players')
  const [cat, setCat] = useState('')
  const [view, setView] = useState<'Game Stats' | 'Betting Stats'>('Game Stats')

  const [bettingCategory, setBettingCategory] = useState<NBABettingCategory>('Points')
  const [bettingThreshold, setBettingThreshold] = useState<number>(NBA_BETTING_THRESHOLDS.Points[0])
  const [filters, setFilters] = useState<NBALeaderFilters>(DEFAULT_NBA_FILTERS)
  const [filterPanelOpen, setFilterPanelOpen] = useState(false)
  const teamFilter = useTeamFilter()

  const [bettingCache, setBettingCache] = useState<Record<string, BettingLeaderRow[]>>({})
  const [bettingLoading, setBettingLoading] = useState(false)
  const [bettingError, setBettingError] = useState(false)

  useEffect(() => {
    setCat(leaders?.cats[sub]?.[0] ?? '')
    if (sub === 'Teams') setView('Game Stats')
    teamFilter.clear()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sub, leaders])

  const playerSub = sub === 'Players'
  const bettingView = playerSub && view === 'Betting Stats'
  const apiFilters = `${filters.window}|${filters.homeAway}|${filters.month}`
  const bettingCacheKey = `${bettingCategory}|${bettingThreshold}|${apiFilters}`
  const rank = useBettingRank(bettingCache[bettingCacheKey] ?? EMPTY_ROWS)
  const windowed = useWindowedLeaders({ sport: 'nba', sub, category: cat, window: filters.window, enabled: playerSub && !bettingView && filters.window !== 'Season' })

  useEffect(() => {
    if (!bettingView) return
    if (bettingCache[bettingCacheKey]) return

    let cancelled = false
    setBettingLoading(true)
    setBettingError(false)

    const params = new URLSearchParams({
      category: bettingCategory,
      threshold: String(bettingThreshold),
      window: filters.window,
      team: 'All Teams',
      homeAway: filters.homeAway,
      month: filters.month,
    })

    fetch(`/api/nba-betting-leaders?${params.toString()}`)
      .then((res) => {
        if (!res.ok) throw new Error(`status ${res.status}`)
        return res.json()
      })
      .then((data: { rows: { rank: number; playerId: number; name: string; teamAbbr: string; hitRate: number; wins: number; losses: number; gamesPlayed: number; last5: boolean[]; seasonHitRate?: number }[] }) => {
        if (cancelled) return
        const mapped: BettingLeaderRow[] = data.rows.map((r) => ({
          rank: r.rank,
          name: r.name,
          team: r.teamAbbr,
          hitRate: r.hitRate,
          wins: r.wins,
          losses: r.losses,
          gamesPlayed: r.gamesPlayed,
          last5: r.last5,
          seasonHitRate: r.seasonHitRate,
        }))
        setBettingCache((prev) => ({ ...prev, [bettingCacheKey]: mapped }))
      })
      .catch((err) => {
        console.error('[NbaLeadersView] betting fetch failed', err)
        if (!cancelled) setBettingError(true)
      })
      .finally(() => {
        if (!cancelled) setBettingLoading(false)
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bettingView, bettingCacheKey])

  const chips = useMemo(() => {
    const base = buildFilterChips(
      bettingView ? { window: filters.window, homeAway: filters.homeAway, month: filters.month } : { window: filters.window },
      bettingView ? { window: 'Season', homeAway: 'All', month: 'All' } : { window: 'Season' },
      FILTER_LABELS,
      (next) => setFilters((f) => ({ ...f, ...(next as Partial<NBALeaderFilters>) }))
    )
    if (teamFilterActive(teamFilter.value)) base.push({ key: 'team', label: `Team: ${teamFilter.value.team}`, onRemove: teamFilter.clear })
    return base
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, bettingView, teamFilter.value])

  if (!leaders) {
    return (
      <div className="px-3.5 pt-3 md:px-0">
        <DataUnavailable label="NBA leaders" />
      </div>
    )
  }

  const style = SPORT_TAB_STYLES.find((s) => s.id === 'nba')!
  const cats = leaders.cats[sub] ?? []
  const seasonRows = leaders.rows[sub]?.[cat] ?? []
  const rows = playerSub && filters.window !== 'Season' ? (windowed.rows ?? []) : seasonRows
  const career = playerSub && filters.window === 'Career'
  const resetFilters = () => {
    setFilters(DEFAULT_NBA_FILTERS)
    teamFilter.clear()
  }
  const topHit = rank.rows[0]?.hitRate ?? 0
  const poolRows = bettingView ? rank.rows : rows
  const playerOptions = poolRows.filter((r) => r.team === teamFilter.value.team).map((r) => r.name)

  const panel = (
    <SimpleFilterPanel
      teamSection={<TeamPlayerFilter teams={TEAMS} playerOptions={playerOptions} controller={teamFilter} />}
      {...(bettingView
        ? {
            homeAway: filters.homeAway,
            month: filters.month,
            homeAwayOptions: HOME_AWAY_OPTIONS,
            monthOptions: MONTH_OPTIONS,
            onHomeAway: (v: string) => setFilters((f) => ({ ...f, homeAway: v as NBALeaderFilters['homeAway'] })),
            onMonth: (v: string) => setFilters((f) => ({ ...f, month: v as NBALeaderFilters['month'] })),
          }
        : {})}
    />
  )

  const windowBar = (
    <FilterBar
      windows={TIME_WINDOWS}
      windowValue={filters.window}
      onWindow={(w) => setFilters((f) => ({ ...f, window: w as TimeWindow }))}
      chips={chips}
      onClearAll={resetFilters}
      open={filterPanelOpen}
      onToggle={() => setFilterPanelOpen((v) => !v)}
      panel={panel}
    />
  )

  const baseCtx: Omit<BoardContext, 'sortMode' | 'bestValueKey' | 'trend' | 'career' | 'betting'> = {
    sport: 'nba',
    teamColors: NBA_TEAM_COLORS,
    sub,
    isTeamRows: sub === 'Teams',
    statLabel: bettingView ? bettingCategory : cat,
    thresholdLabel: bettingView ? `${formatThreshold(bettingThreshold)} ${bettingCategory}` : undefined,
    sportIcon: style.icon,
  }

  return (
    <div className="flex flex-col gap-4 px-3.5 pt-3 md:px-0">
      <div className="rounded-xl border border-accent/25 bg-accent/[0.06] px-3.5 py-2.5 text-[11px] leading-relaxed text-text2">
        Showing final {season} season leaders. The next NBA season&apos;s data will update automatically once it tips off.
      </div>

      {leaders.subs.length > 1 && <ScrollPills options={leaders.subs} active={sub} onChange={setSub} activeColor={style.color} activeText={style.textOnActive} />}

      <div className="flex items-center gap-3">
        {playerSub ? <ViewToggle value={view} onChange={setView} /> : <div className="flex-1" />}
        <VisualizeButton onClick={onVisualize} />
      </div>

      {bettingView ? (
        <BettingSection
          rank={rank}
          ctx={baseCtx}
          trend={{ sport: 'nba', sub, mode: 'betting', category: bettingCategory, threshold: bettingThreshold }}
          career={career}
          teamFilter={teamFilter.value}
          loading={bettingLoading && !bettingCache[bettingCacheKey]}
          error={bettingError}
          errorLabel="NBA betting stats"
          onClear={chips.length > 0 ? resetFilters : undefined}
          windowBar={windowBar}
          categoryPills={
            <ScrollPills
              options={[...NBA_BETTING_CATEGORIES]}
              active={bettingCategory}
              activeColor={topHit >= 65 ? '#00E5A0' : '#3B9EFF'}
              activeText={topHit >= 65 ? '#08090C' : '#FFFFFF'}
              onChange={(v) => {
                const next = v as NBABettingCategory
                setBettingCategory(next)
                setBettingThreshold(NBA_BETTING_THRESHOLDS[next][0])
              }}
            />
          }
          thresholdPills={
            <ScrollPills
              size="lg"
              options={NBA_BETTING_THRESHOLDS[bettingCategory].map(formatThreshold)}
              active={formatThreshold(bettingThreshold)}
              onChange={(v) => setBettingThreshold(parseFloat(v))}
            />
          }
        />
      ) : (
        <>
          {playerSub && windowBar}
          <ScrollPills options={cats} active={cat} onChange={setCat} />
          {playerSub && filters.window !== 'Season' && windowed.loading ? (
            <div className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-card py-14 text-xs text-muted">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-muted border-t-accent" />
              {career ? 'Calculating career leaders (this can take a moment)…' : 'Recalculating leaders…'}
            </div>
          ) : playerSub && filters.window !== 'Season' && windowed.error ? (
            <DataUnavailable label="NBA leaders" />
          ) : (
            <BoardResults
              rows={boardRowsFromLeaders(rows)}
              ctx={{ ...baseCtx, betting: false, career, trend: playerSub ? { sport: 'nba', sub, mode: 'stat', category: cat } : undefined }}
              teamFilter={teamFilter.value}
              onClear={chips.length > 0 ? resetFilters : undefined}
            />
          )}
        </>
      )}
    </div>
  )
}
