'use client'

import { useEffect, useMemo, useState } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { NflSeasonNote } from '@/components/ui/NflSeasonNote'
import { LeaderFilterPanel } from '@/components/leaders/LeaderFilterPanel'
import { NflBettingBoard } from '@/components/leaders/NflBettingBoard'
import { CollegeLeadersView } from '@/components/leaders/CollegeLeadersView'
import { CBB_LEADERS_CONFIG, CFB_LEADERS_CONFIG } from '@/components/leaders/collegeConfig'
import { NbaLeadersView } from '@/components/leaders/NbaLeadersView'
import { NhlLeadersView } from '@/components/leaders/NhlLeadersView'
import { BettingSection } from '@/components/leaders/board/BettingSection'
import { BoardResults } from '@/components/leaders/board/BoardResults'
import { buildFilterChips, FilterBar } from '@/components/leaders/board/FilterBar'
import { ScatterModal, type ScatterSource } from '@/components/leaders/board/ScatterModal'
import { ScrollPills } from '@/components/leaders/board/ScrollPills'
import { SimpleFilterPanel } from '@/components/leaders/board/SimpleFilterPanel'
import { SportTabStrip } from '@/components/leaders/board/SportTabStrip'
import { teamFilterActive, useTeamFilter } from '@/components/leaders/board/teamFilter'
import { TeamPlayerFilter } from '@/components/leaders/board/TeamPlayerFilter'
import { SPORT_TAB_STYLES } from '@/components/leaders/board/theme'
import { boardRowsFromLeaders, type BoardContext } from '@/components/leaders/board/types'
import { useWindowedLeaders } from '@/components/leaders/board/useWindowedLeaders'
import { ViewToggle } from '@/components/leaders/board/ViewToggle'
import { VisualizeButton } from '@/components/leaders/board/VisualizeButton'
import { DataUnavailable } from '@/components/ui/DataUnavailable'
import { MLB_TEAM_COLORS } from '@/data/mlb/teamColors'
import { NBA_TEAM_COLORS } from '@/data/nba/teamColors'
import { NFL_TEAM_COLORS } from '@/data/nfl/teamColors'
import { NHL_TEAM_COLORS } from '@/data/nhl/teamColors'
import type { LeaderGroup, LeaderRow } from '@/data/leaders/types'
import { useBettingRank } from '@/lib/betting/useBettingRank'
import type { BettingLeaderRow } from '@/lib/mlb/bettingLeaders'
import {
  formatThreshold,
  HITTER_PROP_CATEGORIES,
  PITCHER_PROP_CATEGORIES,
  thresholdsFor,
  type PropCategory,
} from '@/lib/mlb/bettingCategories'
import { DEFAULT_FILTERS, hasActiveFilters, TIME_WINDOWS, type LeaderFilters, type TimeWindow } from '@/lib/mlb/filters'
import { NBA_TEAM_NAMES } from '@/lib/nba/divisions'
import { isNflBettingSub, type NflBettingSub } from '@/lib/nfl/bettingCategories'
import { NFL_TEAM_NAMES } from '@/lib/nfl/divisions'
import { NHL_TEAM_NAMES } from '@/lib/nhl/divisions'
import { isProSport, useSport } from '@/lib/sport/SportContext'

const EMPTY_ROWS: BettingLeaderRow[] = []


function teamList(names: Record<string, string>): { abbr: string; name: string }[] {
  return Object.keys(names)
    .map((abbr) => ({ abbr, name: names[abbr] }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

const NFL_TEAMS = teamList(NFL_TEAM_NAMES)
const NBA_TEAMS = teamList(NBA_TEAM_NAMES)
const NHL_TEAMS = teamList(NHL_TEAM_NAMES)

const FILTER_LABELS = { window: 'Window', homeAway: 'Venue', handedness: 'Hand', dayNight: 'Time', month: 'Month' }

export function LeadersPageClient({
  mlbLeaders,
  nflLeaders,
  nflSeason,
  nflDataUpdating,
  mlbTeams,
  nbaLeaders,
  nbaSeason,
  nhlLeaders,
  cfb,
  cbb,
}: {
  mlbLeaders: LeaderGroup | null
  nflLeaders: LeaderGroup | null
  nflSeason: number
  nflDataUpdating: boolean
  mlbTeams: { abbr: string; name: string }[]
  nbaLeaders: LeaderGroup | null
  nbaSeason: string
  nhlLeaders: LeaderGroup | null
  cfb: { leaders: LeaderGroup | null; teams: { abbr: string; name: string }[]; conferences: { abbr: string; name: string }[]; colors: Record<string, string>; building: boolean }
  cbb: { leaders: LeaderGroup | null; teams: { abbr: string; name: string }[]; colors: Record<string, string>; notice: string | null }
}) {
  const { sport } = useSport()
  const isNFL = sport === 'nfl'

  const group = isNFL ? nflLeaders : mlbLeaders
  const teamColors = isNFL ? NFL_TEAM_COLORS : MLB_TEAM_COLORS

  const [sub, setSub] = useState('')
  const [cat, setCat] = useState('')
  const [filters, setFilters] = useState<LeaderFilters>(DEFAULT_FILTERS)
  const [filterPanelOpen, setFilterPanelOpen] = useState(false)
  const [scatterOpen, setScatterOpen] = useState(false)
  const teamFilter = useTeamFilter()

  const [filteredCache, setFilteredCache] = useState<Record<string, LeaderRow[]>>({})
  const [loading, setLoading] = useState(false)
  const [filteredError, setFilteredError] = useState(false)

  const [view, setView] = useState<'Game Stats' | 'Betting Stats'>('Game Stats')
  const [bettingCategory, setBettingCategory] = useState<PropCategory | ''>('')
  const [bettingThreshold, setBettingThreshold] = useState(0)
  const [bettingCache, setBettingCache] = useState<Record<string, BettingLeaderRow[]>>({})
  const [bettingLoading, setBettingLoading] = useState(false)
  const [bettingError, setBettingError] = useState(false)

  useEffect(() => {
    const firstSub = group?.subs[0] ?? ''
    setSub(firstSub)
    setCat(group?.cats[firstSub]?.[0] ?? '')
    setView('Game Stats')
    setFilters(DEFAULT_FILTERS)
    teamFilter.clear()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sport, group])

  useEffect(() => {
    setCat(group?.cats[sub]?.[0] ?? '')
    teamFilter.clear()
    // MLB's Teams board has no betting view; NFL keeps the toggle on every group and explains it where betting stats don't apply.
    if (sub === 'Teams' && !isNFL) setView('Game Stats')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sub])

  const bettingGroup: 'hitting' | 'pitching' = sub === 'Pitchers' ? 'pitching' : 'hitting'
  const bettingCategories = bettingGroup === 'hitting' ? [...HITTER_PROP_CATEGORIES] : [...PITCHER_PROP_CATEGORIES]

  useEffect(() => {
    if (view !== 'Betting Stats' || isNFL) return
    if (bettingCategory && (bettingCategories as string[]).includes(bettingCategory)) return
    const firstCat = bettingCategories[0] as PropCategory
    setBettingCategory(firstCat)
    setBettingThreshold(thresholdsFor(firstCat, bettingGroup)[0])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, sub])

  const filterable = !isNFL && (sub === 'Hitters' || sub === 'Pitchers')
  const nflPlayerSub = isNFL && isNflBettingSub(sub)
  const nflBettingView = isNFL && view === 'Betting Stats'
  const filtersActive = filterable && hasActiveFilters(filters)
  const cacheKey = `${sub}|${cat}|${JSON.stringify(filters)}`
  // The team selection is applied on the client, so it never needs to be part of the request.
  const bettingCacheKey = `${sub}|${bettingCategory}|${bettingThreshold}|${filters.window}|${filters.homeAway}|${filters.dayNight}|${filters.month}`
  const rank = useBettingRank(bettingCache[bettingCacheKey] ?? EMPTY_ROWS)
  const windowedNfl = useWindowedLeaders({
    sport: 'nfl',
    sub,
    category: cat,
    window: filters.window,
    enabled: nflPlayerSub && view === 'Game Stats' && filters.window !== 'Season',
  })

  useEffect(() => {
    if (view !== 'Game Stats') return
    if (!filtersActive || !cat) return
    if (filteredCache[cacheKey]) return

    let cancelled = false
    setLoading(true)
    setFilteredError(false)

    const params = new URLSearchParams({
      sub,
      category: cat,
      window: filters.window,
      team: 'All Teams',
      homeAway: filters.homeAway,
      handedness: filters.handedness,
      dayNight: filters.dayNight,
      month: filters.month,
    })

    fetch(`/api/leaders?${params.toString()}`)
      .then((res) => {
        if (!res.ok) throw new Error(`status ${res.status}`)
        return res.json()
      })
      .then((data: { rows: LeaderRow[] }) => {
        if (cancelled) return
        setFilteredCache((prev) => ({ ...prev, [cacheKey]: data.rows }))
      })
      .catch((err) => {
        console.error('[LeadersPageClient] filtered fetch failed', err)
        if (!cancelled) setFilteredError(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, cacheKey, filtersActive, cat, sub])

  useEffect(() => {
    if (view !== 'Betting Stats' || isNFL) return
    if (!bettingCategory) return
    if (bettingCache[bettingCacheKey]) return

    let cancelled = false
    setBettingLoading(true)
    setBettingError(false)

    const params = new URLSearchParams({
      sub,
      category: bettingCategory,
      threshold: String(bettingThreshold),
      window: filters.window,
      team: 'All Teams',
      homeAway: filters.homeAway,
      dayNight: filters.dayNight,
      month: filters.month,
    })

    fetch(`/api/betting-leaders?${params.toString()}`)
      .then((res) => {
        if (!res.ok) throw new Error(`status ${res.status}`)
        return res.json()
      })
      .then((data: { rows: BettingLeaderRow[] }) => {
        if (cancelled) return
        setBettingCache((prev) => ({ ...prev, [bettingCacheKey]: data.rows }))
      })
      .catch((err) => {
        console.error('[LeadersPageClient] betting-leaders fetch failed', err)
        if (!cancelled) setBettingError(true)
      })
      .finally(() => {
        if (!cancelled) setBettingLoading(false)
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, bettingCacheKey, bettingCategory, bettingThreshold, sub])

  const scatterSources = useMemo<Record<'mlb' | 'nfl' | 'nba' | 'nhl', ScatterSource>>(
    () => ({
      mlb: { group: mlbLeaders, teamColors: MLB_TEAM_COLORS, teams: mlbTeams },
      nfl: { group: nflLeaders, teamColors: NFL_TEAM_COLORS, teams: NFL_TEAMS },
      nba: { group: nbaLeaders, teamColors: NBA_TEAM_COLORS, teams: NBA_TEAMS },
      nhl: { group: nhlLeaders, teamColors: NHL_TEAM_COLORS, teams: NHL_TEAMS },
    }),
    [mlbLeaders, nflLeaders, nbaLeaders, nhlLeaders, mlbTeams]
  )

  const openScatter = () => setScatterOpen(true)

  let content: React.ReactNode
  if (sport === 'nba') {
    content = <NbaLeadersView leaders={nbaLeaders} season={nbaSeason} onVisualize={openScatter} />
  } else if (sport === 'nhl') {
    content = <NhlLeadersView leaders={nhlLeaders} onVisualize={openScatter} />
  } else if (sport === 'cfb') {
    content = <CollegeLeadersView key="cfb" config={CFB_LEADERS_CONFIG} leaders={cfb.leaders} teams={cfb.teams} conferences={cfb.conferences} teamColors={cfb.colors} building={cfb.building} />
  } else if (sport === 'cbb') {
    content = <CollegeLeadersView key="cbb" config={CBB_LEADERS_CONFIG} notice={cbb.notice} leaders={cbb.leaders} teams={cbb.teams} conferences={[]} teamColors={cbb.colors} building={false} />
  } else if (!group) {
    content = (
      <div className="px-3.5 pt-3 md:px-0">
        <DataUnavailable label={isNFL ? 'NFL leaders' : 'MLB leaders'} />
      </div>
    )
  } else {
    const cats = group.cats[sub] ?? []
    const baseRows = group.rows[sub]?.[cat] ?? []
    const nflWindowed = nflPlayerSub && filters.window !== 'Season'
    const rows = filtersActive ? (filteredCache[cacheKey] ?? []) : nflWindowed ? (windowedNfl.rows ?? []) : baseRows

    const bettingThresholds = bettingCategory ? thresholdsFor(bettingCategory, bettingGroup) : []
    const bettingView = filterable && view === 'Betting Stats'
    const sportStyle = SPORT_TAB_STYLES.find((s) => s.id === sport)!
    const windowControls = filterable || (nflPlayerSub && !nflBettingView)
    const career = windowControls && filters.window === 'Career'

    const topHit = rank.rows[0]?.hitRate ?? 0
    const bettingPillColor = topHit >= 65 ? '#00E5A0' : '#3B9EFF'
    const bettingPillText = topHit >= 65 ? '#08090C' : '#FFFFFF'

    const resetFilters = () => {
      setFilters(DEFAULT_FILTERS)
      teamFilter.clear()
    }

    const poolRows = bettingView ? rank.rows : rows
    const playerOptions = poolRows.filter((r) => r.team === teamFilter.value.team).map((r) => r.name)
    const teamSection = <TeamPlayerFilter teams={isNFL ? NFL_TEAMS : mlbTeams} playerOptions={playerOptions} controller={teamFilter} />

    const chips = buildFilterChips(filters, DEFAULT_FILTERS, FILTER_LABELS, setFilters)
    if (teamFilterActive(teamFilter.value)) chips.push({ key: 'team', label: `Team: ${teamFilter.value.team}`, onRemove: teamFilter.clear })

    const windowBar = windowControls ? (
      <FilterBar
        windows={TIME_WINDOWS}
        windowValue={filters.window}
        onWindow={(w) => setFilters((f) => ({ ...f, window: w as TimeWindow }))}
        chips={chips}
        onClearAll={resetFilters}
        open={filterPanelOpen}
        onToggle={() => setFilterPanelOpen((v) => !v)}
        panel={filterable ? <LeaderFilterPanel filters={filters} onChange={setFilters} teamSection={teamSection} hideHandedness={bettingView} /> : <SimpleFilterPanel teamSection={teamSection} />}
      />
    ) : null

    const baseCtx: Omit<BoardContext, 'sortMode' | 'bestValueKey' | 'trend' | 'career' | 'betting'> = {
      sport,
      teamColors,
      sub,
      isTeamRows: sub === 'Teams',
      statLabel: bettingView ? bettingCategory : cat,
      thresholdLabel: bettingView && bettingCategory ? `${formatThreshold(bettingThreshold)} ${bettingCategory}` : undefined,
      sportIcon: sportStyle.icon,
    }

    const statTrend = filterable || nflPlayerSub ? ({ sport, sub, mode: 'stat', category: cat } as const) : undefined

    content = (
      <div className="flex flex-col gap-4 px-3.5 pt-3 md:px-0">
        {isNFL && <NflSeasonNote season={nflSeason} updating={nflDataUpdating} />}

        {group.subs.length > 1 && (
          <ScrollPills options={group.subs} active={sub} onChange={setSub} activeColor={sportStyle.color} activeText={sportStyle.textOnActive} />
        )}

        <div className="flex items-center gap-3">
          {filterable || isNFL ? <ViewToggle value={view} onChange={setView} /> : <div className="flex-1" />}
          <VisualizeButton onClick={openScatter} />
        </div>

        {nflBettingView ? (
          isNflBettingSub(sub) ? (
            <NflBettingBoard sub={sub as NflBettingSub} sportColor={sportStyle.color} />
          ) : (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card px-5 py-10 text-center">
              <div className="text-3xl">🎯</div>
              <div className="text-sm font-extrabold text-text">Betting stats cover QB, RB, WR and TE</div>
              <p className="max-w-sm text-xs leading-relaxed text-muted">
                Hit rates are calculated from player game logs, so {sub === 'Teams' ? 'team boards' : 'defense'} only have Game Stats. Pick a position group to see them.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {['QB', 'RB', 'WR', 'TE'].map((s) => (
                  <button
                    key={s}
                    onClick={() => setSub(s)}
                    className="rounded-full border border-border bg-card3 px-4 py-1.5 text-xs font-bold text-text2 hover:border-accent hover:text-accent"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )
        ) : bettingView ? (
          <BettingSection
            rank={rank}
            ctx={baseCtx}
            trend={{ sport, sub, mode: 'betting', category: bettingCategory, threshold: bettingThreshold }}
            career={career}
            teamFilter={teamFilter.value}
            loading={bettingLoading && !bettingCache[bettingCacheKey]}
            error={bettingError}
            errorLabel="betting stats"
            onClear={chips.length > 0 ? resetFilters : undefined}
            windowBar={windowBar}
            categoryPills={
              <ScrollPills
                options={bettingCategories}
                active={bettingCategory}
                activeColor={bettingPillColor}
                activeText={bettingPillText}
                onChange={(v) => {
                  const next = v as PropCategory
                  setBettingCategory(next)
                  setBettingThreshold(thresholdsFor(next, bettingGroup)[0])
                }}
              />
            }
            thresholdPills={
              bettingCategory ? (
                <ScrollPills size="lg" options={bettingThresholds.map(formatThreshold)} active={formatThreshold(bettingThreshold)} onChange={(v) => setBettingThreshold(parseFloat(v))} />
              ) : null
            }
          />
        ) : (
          <>
            {windowBar}
            <ScrollPills options={cats} active={cat} onChange={setCat} />
            {loading || (nflWindowed && windowedNfl.loading) ? (
              <div className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-card py-14 text-xs text-muted">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-muted border-t-accent" />
                {career ? 'Calculating career leaders (this can take a moment)…' : 'Recalculating leaders…'}
              </div>
            ) : (filtersActive && filteredError) || (nflWindowed && windowedNfl.error) ? (
              <DataUnavailable label="filtered leaders" />
            ) : (
              <BoardResults
                rows={boardRowsFromLeaders(rows)}
                ctx={{ ...baseCtx, betting: false, career, trend: statTrend }}
                teamFilter={teamFilter.value}
                onClear={filtersActive || teamFilterActive(teamFilter.value) ? resetFilters : undefined}
              />
            )}
          </>
        )}
      </div>
    )
  }

  return (
    <AppShell>
      <div className="px-3.5 pt-1 md:px-0 md:pt-0">
        <SportTabStrip />
      </div>
      {content}
      {scatterOpen && isProSport(sport) && <ScatterModal sources={scatterSources} initialSport={sport} onClose={() => setScatterOpen(false)} />}
    </AppShell>
  )
}
