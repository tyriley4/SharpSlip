'use client'

import { useEffect, useMemo, useState } from 'react'
import { BettingSection } from '@/components/leaders/board/BettingSection'
import { BoardResults } from '@/components/leaders/board/BoardResults'
import { buildFilterChips, FilterBar } from '@/components/leaders/board/FilterBar'
import { ScrollPills } from '@/components/leaders/board/ScrollPills'
import { teamFilterActive, useTeamFilter } from '@/components/leaders/board/teamFilter'
import { TeamPlayerFilter } from '@/components/leaders/board/TeamPlayerFilter'
import { boardRowsFromLeaders, type BoardContext } from '@/components/leaders/board/types'
import { ViewToggle, type StatView } from '@/components/leaders/board/ViewToggle'
import { DataUnavailable } from '@/components/ui/DataUnavailable'
import type { LeaderGroup, LeaderRow } from '@/data/leaders/types'
import { useBettingRank } from '@/lib/betting/useBettingRank'
import type { BettingLeaderRow } from '@/lib/mlb/bettingLeaders'
import type { Sport } from '@/lib/sport/SportContext'

export interface CollegeLeadersConfig {
  sport: Extract<Sport, 'cfb' | 'cbb'>
  label: string
  color: string
  textOnColor: string
  icon: string
  apiPath: string
  /** Sub-tabs that offer Betting Stats. */
  bettingSubs: string[]
  bettingCategories: (sub: string) => string[]
  thresholds: Record<string, number[]>
  formatThreshold: (category: string, t: number) => string
  showConference: boolean
  bettingExplainer: string
  teamsNote: string
}

const WINDOWS = ['Season', 'Last 30', 'Last 14', 'Last 7'] as const
const HOME_AWAY = ['All', 'Home', 'Away'] as const

interface Filters {
  window: (typeof WINDOWS)[number]
  homeAway: (typeof HOME_AWAY)[number]
  conference: string
  vs: string
}
const DEFAULT_FILTERS: Filters = { window: 'Season', homeAway: 'All', conference: 'All', vs: 'All Teams' }
const FILTER_LABELS = { window: 'Window', homeAway: 'Venue', conference: 'Conference', vs: 'Vs' }
const EMPTY: BettingLeaderRow[] = []


function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="text-[9px] font-bold uppercase tracking-wide text-muted">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-border bg-card3 px-3 py-2 text-[12px] font-semibold text-text focus:border-accent focus:outline-none [color-scheme:dark]"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

/** College Leaders (football and basketball): sub-tabs with Game Stats and Betting Stats, plus Window / Venue / (Conference) / Vs-team filters. */
export function CollegeLeadersView({
  config,
  notice,
  leaders,
  teams,
  conferences,
  teamColors,
  building,
}: {
  config: CollegeLeadersConfig
  /** Shown above the boards, e.g. the last-season note. */
  notice?: string | null
  leaders: LeaderGroup | null
  teams: { abbr: string; name: string }[]
  conferences: { abbr: string; name: string }[]
  teamColors: Record<string, string>
  building: boolean
}) {
  const { color: COLOR, bettingSubs: BETTING_SUBS, thresholds: THRESHOLDS, formatThreshold: fmtThreshold } = config
  const [sub, setSub] = useState(leaders?.subs[0] ?? '')
  const [cat, setCat] = useState(leaders?.cats[sub]?.[0] ?? '')
  const [view, setView] = useState<StatView>('Game Stats')
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [panelOpen, setPanelOpen] = useState(false)
  const teamFilter = useTeamFilter()

  const [bCat, setBCat] = useState('')
  const [bThreshold, setBThreshold] = useState(0)

  const [gameCache, setGameCache] = useState<Record<string, LeaderRow[]>>({})
  const [gameLoading, setGameLoading] = useState(false)
  const [gameError, setGameError] = useState(false)
  const [betCache, setBetCache] = useState<Record<string, BettingLeaderRow[]>>({})
  const [betLoading, setBetLoading] = useState(false)
  const [betError, setBetError] = useState(false)

  const isBettingSub = BETTING_SUBS.includes(sub)
  const bCats = config.bettingCategories(sub)

  useEffect(() => {
    setCat(leaders?.cats[sub]?.[0] ?? '')
    teamFilter.clear()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sub])

  useEffect(() => {
    if (!isBettingSub || (bCat && bCats.includes(bCat))) return
    setBCat(bCats[0])
    setBThreshold(THRESHOLDS[bCats[0]][0])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sub])

  const filtersActive = filters.window !== 'Season' || filters.homeAway !== 'All' || filters.conference !== 'All' || filters.vs !== 'All Teams'
  const teamsBoard = sub === 'Teams'

  const params = (extra: Record<string, string>) =>
    new URLSearchParams({ sub, window: filters.window, homeAway: filters.homeAway, conference: filters.conference, vs: filters.vs, ...extra }).toString()

  const gameKey = `${sub}|${cat}|${filters.window}|${filters.homeAway}|${filters.conference}|${filters.vs}`
  const betKey = `${sub}|${bCat}|${bThreshold}|${filters.window}|${filters.homeAway}|${filters.conference}|${filters.vs}`
  const rank = useBettingRank(betCache[betKey] ?? EMPTY)

  useEffect(() => {
    if (view !== 'Game Stats' || !filtersActive || teamsBoard || !cat || gameCache[gameKey]) return
    let cancelled = false
    setGameLoading(true)
    setGameError(false)
    fetch(`${config.apiPath}?${params({ mode: 'game', category: cat })}`)
      .then((r) => {
        if (!r.ok) throw new Error(`status ${r.status}`)
        return r.json()
      })
      .then((d: { rows: LeaderRow[] }) => !cancelled && setGameCache((p) => ({ ...p, [gameKey]: d.rows })))
      .catch((err) => {
        console.error('[CollegeLeadersView] game fetch failed', err)
        if (!cancelled) setGameError(true)
      })
      .finally(() => !cancelled && setGameLoading(false))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, gameKey, filtersActive])

  useEffect(() => {
    if (view !== 'Betting Stats' || !isBettingSub || !bCat || betCache[betKey]) return
    let cancelled = false
    setBetLoading(true)
    setBetError(false)
    fetch(`${config.apiPath}?${params({ mode: 'betting', category: bCat, threshold: String(bThreshold) })}`)
      .then((r) => {
        if (!r.ok) throw new Error(`status ${r.status}`)
        return r.json()
      })
      .then((d: { rows: BettingLeaderRow[] }) => !cancelled && setBetCache((p) => ({ ...p, [betKey]: d.rows })))
      .catch((err) => {
        console.error('[CollegeLeadersView] betting fetch failed', err)
        if (!cancelled) setBetError(true)
      })
      .finally(() => !cancelled && setBetLoading(false))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, betKey, isBettingSub])

  const chips = useMemo(() => {
    const base = buildFilterChips(filters, DEFAULT_FILTERS, FILTER_LABELS, setFilters)
    if (teamFilterActive(teamFilter.value)) base.push({ key: 'team', label: `Team: ${teamFilter.value.team}`, onRemove: teamFilter.clear })
    return base
  }, [filters, teamFilter.value, teamFilter.clear])

  if (!leaders) {
    return (
      <div className="px-3.5 pt-3 md:px-0">
        <DataUnavailable label={building ? `${config.label} leaders (still building from this season’s box scores — check back in a minute)` : `${config.label} leaders`} />
      </div>
    )
  }

  const reset = () => {
    setFilters(DEFAULT_FILTERS)
    teamFilter.clear()
  }
  const baseRows = leaders.rows[sub]?.[cat] ?? []
  const filtered = filtersActive && !teamsBoard
  const rows = filtered ? (gameCache[gameKey] ?? []) : baseRows
  const betting = view === 'Betting Stats'
  const topHit = rank.rows[0]?.hitRate ?? 0

  const poolRows = betting ? rank.rows : rows
  const playerOptions = poolRows.filter((r) => r.team === teamFilter.value.team).map((r) => r.name)

  const panel = (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-3.5 md:p-4">
      <TeamPlayerFilter teams={teams} playerOptions={playerOptions} controller={teamFilter} />
      <div className={`grid gap-3 ${config.showConference ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
        <Select label="Home / Away" value={filters.homeAway} onChange={(v) => setFilters((f) => ({ ...f, homeAway: v as Filters['homeAway'] }))} options={HOME_AWAY.map((o) => ({ value: o, label: o }))} />
        {config.showConference && (
        <Select
          label="Conference"
          value={filters.conference}
          onChange={(v) => setFilters((f) => ({ ...f, conference: v }))}
          options={[{ value: 'All', label: 'All conferences' }, ...conferences.map((c) => ({ value: c.abbr, label: c.name }))]}
        />
        )}
        <Select
          label="Vs team"
          value={filters.vs}
          onChange={(v) => setFilters((f) => ({ ...f, vs: v }))}
          options={[{ value: 'All Teams', label: 'All teams' }, ...teams.map((t) => ({ value: t.abbr, label: t.name }))]}
        />
      </div>
    </div>
  )

  const windowBar = teamsBoard ? null : (
    <FilterBar windows={WINDOWS} windowValue={filters.window} onWindow={(w) => setFilters((f) => ({ ...f, window: w as Filters['window'] }))} chips={chips} onClearAll={reset} open={panelOpen} onToggle={() => setPanelOpen((v) => !v)} panel={panel} />
  )

  const ctx: Omit<BoardContext, 'sortMode' | 'bestValueKey' | 'trend' | 'career' | 'betting'> = {
    sport: config.sport,
    teamColors,
    sub,
    isTeamRows: teamsBoard,
    statLabel: betting ? bCat : cat,
    thresholdLabel: betting && bCat ? `${fmtThreshold(bCat, bThreshold)} ${bCat}` : undefined,
    sportIcon: config.icon,
  }

  return (
    <div className="flex flex-col gap-4 px-3.5 pt-3 md:px-0">
      {notice && <p className="rounded-xl border border-warning/25 bg-warning/[0.07] px-3 py-2 text-[11px] text-text2">{notice}</p>}
      {building && (
        <p className="rounded-xl border border-border bg-card px-3 py-2 text-[11px] text-muted">Still collecting this season’s box scores — boards fill in as games are processed.</p>
      )}
      <ScrollPills options={leaders.subs} active={sub} onChange={setSub} activeColor={COLOR} activeText="#FFFFFF" />
      <div className="flex items-center gap-3">
        <ViewToggle value={view} onChange={setView} />
      </div>

      {betting ? (
        isBettingSub ? (
          <BettingSection
            rank={rank}
            ctx={ctx}
            trend={{ sport: config.sport, sub, mode: 'betting', category: bCat, threshold: bThreshold }}
            career={false}
            teamFilter={teamFilter.value}
            loading={betLoading && !betCache[betKey]}
            error={betError}
            errorLabel={`${config.label} betting stats`}
            onClear={chips.length > 0 ? reset : undefined}
            windowBar={windowBar}
            categoryPills={
              <ScrollPills
                options={bCats}
                active={bCat}
                activeColor={topHit >= 65 ? '#00E5A0' : COLOR}
                activeText={topHit >= 65 ? '#08090C' : '#FFFFFF'}
                onChange={(v) => {
                  setBCat(v)
                  setBThreshold(THRESHOLDS[v][0])
                }}
              />
            }
            thresholdPills={
              bCat ? (
                <ScrollPills
                  size="lg"
                  options={(THRESHOLDS[bCat] ?? []).map((t) => fmtThreshold(bCat, t))}
                  active={fmtThreshold(bCat, bThreshold)}
                  onChange={(label) => {
                    const next = (THRESHOLDS[bCat] ?? []).find((t) => fmtThreshold(bCat, t) === label)
                    if (next !== undefined) setBThreshold(next)
                  }}
                />
              ) : null
            }
          />
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card px-5 py-10 text-center">
            <div className="text-3xl">🎯</div>
            <div className="text-sm font-extrabold text-text">{config.bettingExplainer}</div>
            <p className="max-w-sm text-xs leading-relaxed text-muted">Hit rates come from player game logs, so {teamsBoard ? 'team boards' : 'this board'} only have Game Stats.</p>
            <div className="flex flex-wrap justify-center gap-2">
              {BETTING_SUBS.map((s) => (
                <button key={s} onClick={() => setSub(s)} className="rounded-full border border-border bg-card3 px-4 py-1.5 text-xs font-bold text-text2 hover:border-accent hover:text-accent">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )
      ) : (
        <>
          {windowBar}
          <ScrollPills options={leaders.cats[sub] ?? []} active={cat} onChange={setCat} />
          {filtered && gameLoading && !gameCache[gameKey] ? (
            <div className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-card py-14 text-xs text-muted">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-muted border-t-accent" />
              Recalculating leaders…
            </div>
          ) : filtered && gameError ? (
            <DataUnavailable label="filtered leaders" />
          ) : (
            <BoardResults
              rows={boardRowsFromLeaders(rows)}
              ctx={{ ...ctx, betting: false, career: false, trend: teamsBoard ? undefined : { sport: config.sport, sub, mode: 'stat', category: cat } }}
              teamFilter={teamFilter.value}
              onClear={filtered || teamFilterActive(teamFilter.value) ? reset : undefined}
            />
          )}
        </>
      )}
      {teamsBoard && <p className="px-1 text-[10px] text-muted">{config.teamsNote}</p>}
    </div>
  )
}
