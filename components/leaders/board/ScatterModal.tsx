'use client'

import dynamic from 'next/dynamic'
import { useEffect, useMemo, useState } from 'react'
import type { LeaderGroup } from '@/data/leaders/types'
import {
  DEFAULT_SCATTER_FILTERS,
  FILTERABLE_SUBS,
  rateAxesFor,
  SCATTER_FILTER_SUPPORT,
  scatterFiltersActive,
  type ScatterFilters,
} from '@/lib/scatter/axes'
import { isProSport, type ProSport } from '@/lib/sport/SportContext'
import { ScrollPills } from './ScrollPills'
import { SPORT_TAB_STYLES, parseNumeric, readableTeamColor } from './theme'
import type { ScatterPoint } from './ScatterChartPanel'

const ScatterChartPanel = dynamic(() => import('./ScatterChartPanel').then((m) => m.ScatterChartPanel), {
  ssr: false,
  loading: () => <ChartSpinner label="Loading chart…" />,
})

export interface ScatterSource {
  group: LeaderGroup | null
  teamColors: Record<string, string>
  /** Opponents offered in the "vs Team" filter. */
  teams: { abbr: string; name: string }[]
}

const TEXT = '#F0F2F5'

function ChartSpinner({ label }: { label: string }) {
  return (
    <div className="flex h-full items-center justify-center gap-2 text-xs" style={{ color: TEXT }}>
      <span className="h-3 w-3 animate-spin rounded-full border-2 border-muted border-t-accent" />
      {label}
    </div>
  )
}

function lastName(name: string): string {
  const parts = name.split(' ')
  return parts[parts.length - 1]
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }) {
  return (
    <label className="flex min-w-0 flex-1 flex-col gap-1">
      <span className="text-[9px] font-bold uppercase tracking-wide" style={{ color: TEXT }}>
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full min-w-0 rounded-lg border border-border bg-card3 px-3 py-2 text-[12px] font-semibold focus:border-accent focus:outline-none [color-scheme:dark]"
        style={{ color: TEXT }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} style={{ background: '#16191F', color: TEXT }}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function PillRow<T extends string>({ label, options, value, onChange }: { label: string; options: readonly T[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[9px] font-bold uppercase tracking-wide" style={{ color: TEXT }}>
        {label}
      </span>
      <div className="flex flex-wrap gap-1">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            aria-pressed={value === o}
            onClick={() => onChange(o)}
            className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
              value === o ? 'border-accent bg-accent text-white' : 'border-border bg-card text-text2 hover:border-border2 hover:text-text'
            }`}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  )
}

type ScatterMode = 'game' | 'betting' | 'mixed'

const MODES: { id: ScatterMode; label: string; hint: string }[] = [
  { id: 'game', label: 'Game Stats', hint: 'Game stat vs game stat' },
  { id: 'betting', label: 'Betting Stats', hint: 'Hit rate vs hit rate — which props travel together' },
  { id: 'mixed', label: 'Mixed', hint: 'Game stat vs hit rate — does performance predict prop success?' },
]

interface ApiPoint {
  name: string
  team: string
  x: number
  y: number
}

interface ApiResult {
  points: ApiPoint[]
  notes: string[]
}

/** The scatter builder covers the four pro leagues only. */
const PRO_TABS = SPORT_TAB_STYLES.filter((s) => isProSport(s.id))

export function ScatterModal({ sources, initialSport, onClose }: { sources: Record<ProSport, ScatterSource>; initialSport: ProSport; onClose: () => void }) {
  const [sport, setSport] = useState<ProSport>(initialSport)
  const group = sources[sport].group
  const teamColors = sources[sport].teamColors

  const [sub, setSub] = useState('')
  const [mode, setMode] = useState<ScatterMode>('game')
  const [xCat, setXCat] = useState('')
  const [yCat, setYCat] = useState('')
  const [team, setTeam] = useState('All Teams')
  const [filters, setFilters] = useState<ScatterFilters>(DEFAULT_SCATTER_FILTERS)

  const [remote, setRemote] = useState<Record<string, ApiResult>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  // Reset the selectors whenever the sport (and therefore the available boards) changes.
  useEffect(() => {
    const firstSub = group?.subs[0] ?? ''
    setSub(firstSub)
    setTeam('All Teams')
    setFilters(DEFAULT_SCATTER_FILTERS)
  }, [group])

  useEffect(() => {
    const gameCats = group?.cats[sub] ?? []
    const rates = rateAxesFor(sport, sub).map((a) => a.label)
    if (mode === 'betting' && rates.length > 0) {
      setXCat(rates[0])
      setYCat(rates[1] ?? rates[0])
    } else if (mode === 'mixed' && rates.length > 0) {
      setXCat(gameCats[0] ?? '')
      setYCat(rates[0])
    } else {
      setXCat(gameCats[0] ?? '')
      setYCat(gameCats[1] ?? gameCats[0] ?? '')
    }
    setTeam('All Teams')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group, sub, mode])

  // Groups with no hit-rate axes (e.g. team boards) fall back to plain game stats.
  useEffect(() => {
    if (mode !== 'game' && rateAxesFor(sport, sub).length === 0) setMode('game')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sport, sub])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const cats = group?.cats[sub] ?? []
  const rateAxes = rateAxesFor(sport, sub)
  const gameOptions = cats.map((c) => ({ value: c, label: c }))
  const rateOptions = rateAxes.map((a) => ({ value: a.label, label: `📊 ${a.label}` }))
  const xOptions = mode === 'betting' ? rateOptions : gameOptions
  const yOptions = mode === 'game' ? gameOptions : rateOptions
  const hasRates = rateAxes.length > 0
  const singleRate = mode === 'betting' && rateAxes.length === 1
  const isRate = (label: string) => rateAxes.some((a) => a.label === label)

  const filterable = FILTERABLE_SUBS[sport].includes(sub)
  const support = SCATTER_FILTER_SUPPORT[sport]
  const filtersOn = filterable && scatterFiltersActive(filters)
  const needsServer = filtersOn || isRate(xCat) || isRate(yCat)
  const requestKey = `${sport}|${sub}|${xCat}|${yCat}|${JSON.stringify(filtersOn ? filters : DEFAULT_SCATTER_FILTERS)}`

  useEffect(() => {
    if (!needsServer || !xCat || !yCat || remote[requestKey]) return
    let cancelled = false
    setLoading(true)
    setError(false)

    const f = filtersOn ? filters : DEFAULT_SCATTER_FILTERS
    const params = new URLSearchParams({
      sport,
      sub,
      x: xCat,
      y: yCat,
      vsTeam: f.vsTeam,
      hand: f.hand,
      homeAway: f.homeAway,
      conference: f.conference,
    })

    fetch(`/api/scatter?${params.toString()}`)
      .then((res) => {
        if (!res.ok) throw new Error(`status ${res.status}`)
        return res.json()
      })
      .then((data: ApiResult) => {
        if (!cancelled) setRemote((prev) => ({ ...prev, [requestKey]: data }))
      })
      .catch((err) => {
        console.error('[ScatterModal] scatter fetch failed', err)
        if (!cancelled) setError(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsServer, requestKey])

  const allPoints = useMemo<ScatterPoint[]>(() => {
    if (!group || !xCat || !yCat) return []
    const color = (t: string) => readableTeamColor(teamColors[t] ?? '#3B9EFF')

    if (needsServer) {
      const result = remote[requestKey]
      return (result?.points ?? []).map((p) => ({ name: p.name, label: lastName(p.name), team: p.team, x: p.x, y: p.y, color: color(p.team) }))
    }

    const xRows = group.rows[sub]?.[xCat] ?? []
    const yRows = group.rows[sub]?.[yCat] ?? []
    const yByKey = new Map(yRows.map((r) => [`${r.name}|${r.team}`, r]))
    const out: ScatterPoint[] = []
    for (const xr of xRows) {
      const yr = yByKey.get(`${xr.name}|${xr.team}`)
      if (!yr) continue
      const x = parseNumeric(xr.value)
      const y = parseNumeric(yr.value)
      if (x === null || y === null) continue
      out.push({ name: xr.name, label: lastName(xr.name), team: xr.team, x, y, color: color(xr.team) })
    }
    return out
  }, [group, sub, xCat, yCat, teamColors, needsServer, remote, requestKey])

  const notes = needsServer ? (remote[requestKey]?.notes ?? []) : []
  const teams = useMemo(() => Array.from(new Set(allPoints.map((p) => p.team))).sort(), [allPoints])
  const points = team === 'All Teams' ? allPoints : allPoints.filter((p) => p.team === team)
  const sportStyle = SPORT_TAB_STYLES.find((s) => s.id === sport)!
  const waiting = needsServer && !remote[requestKey] && !error

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/70 md:items-center md:p-6" onClick={onClose}>
      <div
        className="flex w-full flex-col overflow-hidden bg-card md:h-[86vh] md:w-[84vw] md:rounded-2xl md:border md:border-border"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Explore Data"
        style={{ color: TEXT }}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <h2 className="section-header text-base" style={{ color: TEXT }}>
            Explore Data
          </h2>
          <button onClick={onClose} aria-label="Close" className="flex h-8 w-8 items-center justify-center rounded-full border border-border hover:border-border2" style={{ color: TEXT }}>
            ✕
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div className="flex shrink-0 flex-col gap-3 border-b border-border px-4 py-3">
          <ScrollPills
            options={PRO_TABS.map((s) => `${s.icon} ${s.label}`)}
            active={`${sportStyle.icon} ${sportStyle.label}`}
            onChange={(v) => {
              const next = PRO_TABS.find((s) => `${s.icon} ${s.label}` === v)
              if (next && isProSport(next.id)) setSport(next.id)
            }}
            size="sm"
            activeColor={sportStyle.color}
            activeText={sportStyle.textOnActive}
          />

          {group && (
            <>
              <ScrollPills options={group.subs} active={sub} onChange={setSub} size="sm" />
              <div className="flex flex-col gap-1.5">
                <div className="grid grid-cols-3 gap-1 rounded-xl border border-border bg-card2 p-1" role="tablist" aria-label="Scatter mode">
                  {MODES.map((m) => {
                    const disabled = m.id !== 'game' && !hasRates
                    return (
                      <button
                        key={m.id}
                        role="tab"
                        aria-selected={mode === m.id}
                        disabled={disabled}
                        onClick={() => setMode(m.id)}
                        className={`rounded-lg px-2 py-2 text-[12px] font-extrabold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                          mode === m.id ? 'bg-accent text-white shadow-[0_0_12px_rgba(59,158,255,0.4)]' : 'text-text2 hover:text-text'
                        }`}
                      >
                        {m.label}
                      </button>
                    )
                  })}
                </div>
                <p className="px-1 text-[10px]" style={{ color: TEXT }}>
                  {hasRates ? MODES.find((m) => m.id === mode)?.hint : "Hit-rate axes aren't available for this group — only Game Stats can be plotted."}
                  {singleRate ? ' This group has just one hit-rate category, so try Mixed to pair it with a game stat.' : ''}
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Select label={mode === 'mixed' ? 'X Axis — game stat' : 'X Axis'} value={xCat} options={xOptions} onChange={setXCat} />
                <Select label={mode === 'mixed' ? 'Y Axis — hit rate' : 'Y Axis'} value={yCat} options={yOptions} onChange={setYCat} />
                <Select
                  label="Player's Team"
                  value={team}
                  options={['All Teams', ...teams].map((t) => ({ value: t, label: t }))}
                  onChange={setTeam}
                />
              </div>

              <div className="flex flex-col gap-2.5 rounded-xl border border-border bg-card2 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold tracking-[0.1em]" style={{ color: TEXT }}>
                    FILTERS
                  </span>
                  {filtersOn && (
                    <button type="button" onClick={() => setFilters(DEFAULT_SCATTER_FILTERS)} className="text-[10px] font-bold text-accent hover:underline">
                      Reset
                    </button>
                  )}
                </div>
                {!filterable ? (
                  <p className="text-[11px]" style={{ color: TEXT }}>
                    Filters apply to player boards (they re-total each player&apos;s games). Pick a player group to use them.
                  </p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <Select
                      label="vs Team"
                      value={filters.vsTeam}
                      options={[{ value: 'All Teams', label: 'All Teams' }, ...sources[sport].teams.map((t) => ({ value: t.abbr, label: t.name }))]}
                      onChange={(v) => setFilters((f) => ({ ...f, vsTeam: v }))}
                    />
                    {support.hand && (
                      <PillRow label="vs Pitcher Handedness" options={['All', 'vs RHP', 'vs LHP'] as const} value={filters.hand} onChange={(v) => setFilters((f) => ({ ...f, hand: v }))} />
                    )}
                    <PillRow label="Home / Away" options={['All', 'Home', 'Away'] as const} value={filters.homeAway} onChange={(v) => setFilters((f) => ({ ...f, homeAway: v }))} />
                    {support.conference && (
                      <PillRow label="vs Conference" options={['All', 'AFC', 'NFC'] as const} value={filters.conference} onChange={(v) => setFilters((f) => ({ ...f, conference: v }))} />
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <div className="min-h-[340px] flex-1 shrink-0 px-2 py-3 md:px-4">
          {!group ? (
            <div className="flex h-full items-center justify-center text-xs" style={{ color: TEXT }}>
              Leaders data isn&apos;t available for this sport right now.
            </div>
          ) : error ? (
            <div className="flex h-full items-center justify-center px-6 text-center text-xs" style={{ color: TEXT }}>
              Couldn&apos;t load this combination right now. Try again in a moment.
            </div>
          ) : waiting || loading ? (
            <ChartSpinner label="Crunching game logs…" />
          ) : points.length < 2 ? (
            <div className="flex h-full flex-col items-center justify-center gap-1 px-6 text-center">
              <div className="text-4xl opacity-80">{sportStyle.icon}</div>
              <div className="text-sm font-extrabold" style={{ color: TEXT }}>
                Not enough overlapping players
              </div>
              <div className="max-w-sm text-xs" style={{ color: TEXT }}>
                {filtersOn
                  ? `No two players have data for both ${xCat} and ${yCat} under these filters. Loosen a filter or pick different axes.`
                  : `Only players who appear on both the ${xCat} and ${yCat} leaderboards can be plotted. Try two related stats, or clear the team filter.`}
              </div>
            </div>
          ) : (
            <ScatterChartPanel
              points={points}
              xLabel={xCat}
              yLabel={yCat}
              quadrants={
                mode === 'mixed'
                  ? {
                      tr: `High ${xCat} + High hit rate — Prime targets`,
                      tl: `Low ${xCat} but High hit rate — Regression risk`,
                      br: `High ${xCat} but Low hit rate — Avoid`,
                      bl: `Low ${xCat} + Low hit rate — Skip`,
                    }
                  : undefined
              }
            />
          )}
        </div>

        </div>

        <div className="flex shrink-0 flex-col gap-0.5 border-t border-border px-4 py-2 text-[10px]" style={{ color: TEXT }}>
          <span>
            {points.length} player{points.length !== 1 ? 's' : ''} plotted
            {needsServer ? ' — recomputed from each player’s game logs' : ' — players ranked on both leaderboards'}. Dashed lines mark the averages of the plotted group.
          </span>
          {notes.map((n) => (
            <span key={n} className="text-[#FFB800]">
              {n}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
