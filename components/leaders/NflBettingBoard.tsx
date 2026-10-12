'use client'

import { useEffect, useMemo, useState } from 'react'
import { BettingSection } from '@/components/leaders/board/BettingSection'
import { buildFilterChips, FilterBar } from '@/components/leaders/board/FilterBar'
import { ScrollPills } from '@/components/leaders/board/ScrollPills'
import { SimpleFilterPanel } from '@/components/leaders/board/SimpleFilterPanel'
import { teamFilterActive, useTeamFilter } from '@/components/leaders/board/teamFilter'
import { TeamPlayerFilter } from '@/components/leaders/board/TeamPlayerFilter'
import { type BoardContext } from '@/components/leaders/board/types'
import { NFL_TEAM_COLORS } from '@/data/nfl/teamColors'
import { useBettingRank } from '@/lib/betting/useBettingRank'
import type { BettingLeaderRow } from '@/lib/mlb/bettingLeaders'
import {
  formatNflBettingThreshold,
  NFL_BETTING_CATEGORIES,
  NFL_BETTING_THRESHOLDS,
  type NflBettingSub,
} from '@/lib/nfl/bettingCategories'
import { NFL_TEAM_NAMES } from '@/lib/nfl/divisions'
import { DEFAULT_NFL_FILTERS, HOME_AWAY_OPTIONS, MONTH_OPTIONS, TIME_WINDOWS, type NFLLeaderFilters, type TimeWindow } from '@/lib/nfl/filters'

const FILTER_LABELS = { window: 'Window', homeAway: 'Venue', month: 'Month' }
const EMPTY_ROWS: BettingLeaderRow[] = []
const TEAM_OPTIONS = Object.keys(NFL_TEAM_NAMES)
  .map((abbr) => ({ abbr, name: NFL_TEAM_NAMES[abbr] }))
  .sort((a, b) => a.name.localeCompare(b.name))

/** NFL Betting Stats: hit rates for skill-position props, computed from the real weekly nflverse game logs. */
export function NflBettingBoard({ sub, sportColor }: { sub: NflBettingSub; sportColor: string }) {
  const categories = NFL_BETTING_CATEGORIES[sub]
  const [category, setCategory] = useState(categories[0])
  const [threshold, setThreshold] = useState(NFL_BETTING_THRESHOLDS[categories[0]][0])
  const [filters, setFilters] = useState<NFLLeaderFilters>(DEFAULT_NFL_FILTERS)
  const [panelOpen, setPanelOpen] = useState(false)
  const teamFilter = useTeamFilter()

  const [cache, setCache] = useState<Record<string, BettingLeaderRow[]>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  // A new position group may not offer the selected category — fall back to its first one.
  useEffect(() => {
    if (categories.includes(category)) return
    setCategory(categories[0])
    setThreshold(NFL_BETTING_THRESHOLDS[categories[0]][0])
    teamFilter.clear()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sub])

  const validCategory = categories.includes(category) ? category : categories[0]
  const thresholds = NFL_BETTING_THRESHOLDS[validCategory]
  const validThreshold = thresholds.includes(threshold) ? threshold : thresholds[0]
  // The API only needs the window and venue/month; the team selection is applied on the client.
  const apiFilters = `${filters.window}|${filters.homeAway}|${filters.month}`
  const cacheKey = `${sub}|${validCategory}|${validThreshold}|${apiFilters}`
  const rank = useBettingRank(cache[cacheKey] ?? EMPTY_ROWS)
  const career = filters.window === 'Career'

  useEffect(() => {
    if (cache[cacheKey]) return
    let cancelled = false
    setLoading(true)
    setError(false)

    const params = new URLSearchParams({
      sub,
      category: validCategory,
      threshold: String(validThreshold),
      window: filters.window,
      team: 'All Teams',
      homeAway: filters.homeAway,
      month: filters.month,
    })

    fetch(`/api/nfl-betting-leaders?${params.toString()}`)
      .then((res) => {
        if (!res.ok) throw new Error(`status ${res.status}`)
        return res.json()
      })
      .then((data: { rows: BettingLeaderRow[] }) => {
        if (!cancelled) setCache((prev) => ({ ...prev, [cacheKey]: data.rows }))
      })
      .catch((err) => {
        console.error('[NflBettingBoard] fetch failed', err)
        if (!cancelled) setError(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey])

  const chips = useMemo(() => {
    const base = buildFilterChips({ window: filters.window, homeAway: filters.homeAway, month: filters.month }, { window: 'Season', homeAway: 'All', month: 'All' }, FILTER_LABELS, (next) =>
      setFilters((f) => ({ ...f, ...(next as Partial<NFLLeaderFilters>) }))
    )
    if (teamFilterActive(teamFilter.value)) base.push({ key: 'team', label: `Team: ${teamFilter.value.team}`, onRemove: teamFilter.clear })
    return base
  }, [filters, teamFilter.value, teamFilter.clear])

  const resetFilters = () => {
    setFilters(DEFAULT_NFL_FILTERS)
    teamFilter.clear()
  }

  const topHit = rank.rows[0]?.hitRate ?? 0
  const playerOptions = rank.rows.filter((r) => r.team === teamFilter.value.team).map((r) => r.name)

  const ctx: Omit<BoardContext, 'sortMode' | 'bestValueKey' | 'trend' | 'career' | 'betting'> = {
    sport: 'nfl',
    teamColors: NFL_TEAM_COLORS,
    sub,
    isTeamRows: false,
    statLabel: validCategory,
    thresholdLabel: `${formatNflBettingThreshold(validCategory, validThreshold)} ${validCategory}`,
    sportIcon: '🏈',
  }

  return (
    <BettingSection
      rank={rank}
      ctx={ctx}
      trend={{ sport: 'nfl', sub, mode: 'betting', category: validCategory, threshold: validThreshold }}
      career={career}
      teamFilter={teamFilter.value}
      loading={loading && !cache[cacheKey]}
      error={error}
      errorLabel="NFL betting stats"
      onClear={chips.length > 0 ? resetFilters : undefined}
      windowBar={
        <FilterBar
          windows={TIME_WINDOWS}
          windowValue={filters.window}
          onWindow={(w) => setFilters((f) => ({ ...f, window: w as TimeWindow }))}
          chips={chips}
          onClearAll={resetFilters}
          open={panelOpen}
          onToggle={() => setPanelOpen((v) => !v)}
          panel={
            <SimpleFilterPanel
              teamSection={<TeamPlayerFilter teams={TEAM_OPTIONS} playerOptions={playerOptions} controller={teamFilter} />}
              homeAway={filters.homeAway}
              month={filters.month}
              homeAwayOptions={HOME_AWAY_OPTIONS}
              monthOptions={MONTH_OPTIONS}
              onHomeAway={(v) => setFilters((f) => ({ ...f, homeAway: v as NFLLeaderFilters['homeAway'] }))}
              onMonth={(v) => setFilters((f) => ({ ...f, month: v as NFLLeaderFilters['month'] }))}
            />
          }
        />
      }
      categoryPills={
        <ScrollPills
          options={categories}
          active={validCategory}
          activeColor={topHit >= 65 ? '#00E5A0' : sportColor}
          activeText={topHit >= 65 ? '#08090C' : '#FFFFFF'}
          onChange={(v) => {
            setCategory(v)
            setThreshold(NFL_BETTING_THRESHOLDS[v][0])
          }}
        />
      }
      thresholdPills={
        <ScrollPills
          size="lg"
          options={thresholds.map((t) => formatNflBettingThreshold(validCategory, t))}
          active={formatNflBettingThreshold(validCategory, validThreshold)}
          onChange={(label) => {
            const next = thresholds.find((t) => formatNflBettingThreshold(validCategory, t) === label)
            if (next !== undefined) setThreshold(next)
          }}
        />
      }
    />
  )
}
