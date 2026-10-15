'use client'

import { useEffect, useMemo, useState } from 'react'
import { useCareer } from '@/components/players/CareerCompare'
import { TimePeriodSelector, useTimeWindow } from '@/components/research/TimeWindow'
import type { CareerGame } from '@/lib/props/careerHitRates'
import type { MatchupContext } from '@/lib/research/matchupContext'
import { applyWindow, averages, categoriesOf, DEFAULT_WINDOW, WINDOW_OPTIONS } from '@/lib/research/windows'

const USAGE_KEY: Record<string, string> = { nfl: 'Targets', nba: 'Minutes', nhl: 'TOI' }

const f1 = (n: number) => (Math.round(n * 10) / 10).toString()
const dateText = (iso: string) => new Date(iso + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

/** Per-game averages for the selected window set beside the full season. */
function WindowTable({ games, label, season, compare }: { games: CareerGame[]; label: string; season: CareerGame[]; compare: boolean }) {
  // Categories that are zero across the board (a running back's passing yards) are left out.
  const cats = useMemo(() => categoriesOf(season.length ? season : games).filter((c) => [...season, ...games].some((g) => (g.values[c] ?? 0) !== 0)), [season, games])
  const win = useMemo(() => averages(games), [games])
  const all = useMemo(() => averages(season), [season])
  if (games.length === 0) return <p className="rounded-lg border border-border bg-card3 px-3 py-4 text-center text-[11px] text-muted">No games in this window.</p>
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className={`grid ${compare ? 'grid-cols-[1fr_auto_auto_auto]' : 'grid-cols-[1fr_auto]'} gap-x-3 bg-card3 px-3 py-1.5 text-[9px] font-bold uppercase tracking-wide text-muted`}>
        <span>Per game</span>
        <span className="w-14 text-right">{label}</span>
        {compare && <span className="w-14 text-right">Season</span>}
        {compare && <span className="w-10 text-right">Δ</span>}
      </div>
      <div className="px-3 pb-1 pt-1 text-[10px] text-muted">
        {games.length} game{games.length === 1 ? '' : 's'} in this window · {season.length} this season
      </div>
      {cats.map((c) => {
        const w = win[c]
        const s = all[c]
        if (w === undefined) return null
        const d = s !== undefined && s > 0 ? ((w - s) / s) * 100 : null
        return (
          <div key={c} className={`grid ${compare ? 'grid-cols-[1fr_auto_auto_auto]' : 'grid-cols-[1fr_auto]'} items-center gap-x-3 border-t border-border/60 px-3 py-1.5 text-[11px]`}>
            <span className="font-semibold text-text2">{c}</span>
            <span className="stat-number w-14 text-right font-black text-text">{f1(w)}</span>
            {compare && <span className="stat-number w-14 text-right text-muted">{s !== undefined ? f1(s) : '—'}</span>}
            {compare && <span className={`w-10 text-right text-[10px] font-bold ${d === null ? 'text-muted' : d >= 15 ? 'text-positive' : d <= -15 ? 'text-negative' : 'text-muted'}`}>{d === null ? '' : `${d >= 0 ? '+' : ''}${Math.round(d)}%`}</span>}
          </div>
        )
      })}
    </div>
  )
}

function SectionTitle({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="mb-1.5 mt-3 flex items-center gap-1.5 text-[10px] font-extrabold tracking-[0.08em] text-muted">
      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-accent/15 text-[9px] text-accent">{n}</span>
      {children}
    </div>
  )
}

/**
 * "vs This Opponent" is a four-part picture, not just head to head: every meeting (the last three highlighted), how each side
 * is playing now regardless of opponent, what has changed since they last met, and how the history and the form fit together.
 */
function VsOpponentView({ sport, name, team, opponent, games }: { sport: string; name: string; team: string; opponent: string; games: CareerGame[] }) {
  const [ctx, setCtx] = useState<MatchupContext | null | 'loading'>('loading')
  useEffect(() => {
    let cancelled = false
    fetch(`/api/matchup-context?${new URLSearchParams({ sport, team, opponent }).toString()}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: MatchupContext | null) => !cancelled && setCtx(d))
      .catch(() => !cancelled && setCtx(null))
    return () => {
      cancelled = true
    }
  }, [sport, team, opponent])

  const sorted = useMemo(() => [...games].sort((a, b) => b.date.localeCompare(a.date)), [games])
  const meetings = sorted.filter((g) => g.opp === opponent)
  // The three categories that actually carry numbers for this player (a running back's passing yards do not).
  const cats = categoriesOf(meetings.length ? meetings : sorted)
    .filter((c) => c !== 'Minutes' && c !== 'TOI' && sorted.slice(0, 15).some((g) => (g.values[c] ?? 0) !== 0))
    .slice(0, 3)
  const usage = USAGE_KEY[sport]
  const lastMeeting = meetings[0]
  const recent = sorted.slice(0, 5)
  const meetAvg = averages(meetings)
  const recentAvg = averages(recent)
  const beforeLast = lastMeeting ? sorted.filter((g) => g.date < lastMeeting.date).slice(0, 5) : []
  const beforeAvg = averages(beforeLast)

  return (
    <div className="flex flex-col">
      <SectionTitle n={1}>HEAD-TO-HEAD HISTORY</SectionTitle>
      {meetings.length === 0 ? (
        <p className="rounded-lg border border-border bg-card3 px-3 py-3 text-[11px] text-muted">{name} has no logged games against {opponent} in the seasons on file.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          {meetings.slice(0, 8).map((g, i) => (
            <div key={g.date + i} className={`flex items-center gap-2 border-b border-border/60 px-3 py-1.5 text-[11px] last:border-b-0 ${i < 3 ? 'bg-accent/[0.05]' : ''}`}>
              <span className="w-24 shrink-0 text-[10px] text-muted">{dateText(g.date)}</span>
              <span className="w-8 shrink-0 text-[10px] font-bold text-text2">{g.home === undefined ? '' : g.home ? 'HOME' : 'AWAY'}</span>
              <span className="min-w-0 flex-1 truncate text-text2">{cats.map((c) => `${g.values[c] ?? '—'} ${c}`).join(' · ')}</span>
              {g.team && g.team !== team && <span className="shrink-0 rounded-full border border-warning/40 px-1.5 text-[9px] font-bold text-warning">for {g.team}</span>}
              {i < 3 && <span className="shrink-0 text-[9px] font-extrabold text-accent">RECENT</span>}
            </div>
          ))}
          <div className="bg-card3 px-3 py-1.5 text-[10px] text-muted">
            {meetings.length} meeting{meetings.length === 1 ? '' : 's'} · averaging {cats.map((c) => `${f1(meetAvg[c] ?? 0)} ${c}`).join(' · ')}
          </div>
        </div>
      )}

      {ctx && ctx !== 'loading' && ctx.meetings.length > 0 && (
        <div className="mt-2 rounded-xl border border-border bg-card3 px-3 py-2 text-[11px] text-text2">
          <div className="mb-0.5 text-[9px] font-bold uppercase tracking-wide text-muted">{team} vs {opponent}, team results</div>
          {ctx.meetings.slice(0, 6).map((m, i) => (
            <div key={m.date + i} className={i < 3 ? 'font-semibold text-text' : 'text-muted'}>
              {dateText(m.date)} · {m.home ? 'home' : 'away'}{m.playoff ? ' · postseason' : ''} · {m.us > m.them ? 'won' : m.us < m.them ? 'lost' : 'tied'} {m.us}-{m.them}
            </div>
          ))}
        </div>
      )}

      <SectionTitle n={2}>CURRENT FORM, REGARDLESS OF OPPONENT</SectionTitle>
      <div className="rounded-xl border border-border bg-card3 px-3 py-2 text-[11px] leading-relaxed text-text2">
        <div>
          <span className="font-bold text-text">{name}</span>, last {recent.length} games: {cats.map((c) => `${f1(recentAvg[c] ?? 0)} ${c}`).join(' · ')}
          {meetings.length > 0 && cats[0] ? ` (against ${opponent}: ${f1(meetAvg[cats[0]] ?? 0)} ${cats[0]})` : ''}
        </div>
        {ctx && ctx !== 'loading' && (
          <div className="mt-1 text-[10px] text-muted">
            {team}: {ctx.form.team.filter((g) => g.us > g.them).length}-{ctx.form.team.filter((g) => g.us < g.them).length} in its last 5 ({f1(ctx.changes.team.now.pf)} scored, {f1(ctx.changes.team.now.pa)} allowed) · {opponent}: {ctx.form.opponent.filter((g) => g.us > g.them).length}-{ctx.form.opponent.filter((g) => g.us < g.them).length} ({f1(ctx.changes.opponent.now.pf)} scored, {f1(ctx.changes.opponent.now.pa)} allowed)
          </div>
        )}
      </div>

      <SectionTitle n={3}>CHANGES SINCE THEY LAST MET</SectionTitle>
      <ul className="flex flex-col gap-1 rounded-xl border border-border bg-card3 px-3 py-2 text-[11px] leading-snug text-text2">
        {!lastMeeting && <li className="text-muted">No earlier meeting on file to compare against.</li>}
        {lastMeeting && (
          <>
            <li>Last met {dateText(lastMeeting.date)}{lastMeeting.team && lastMeeting.team !== team ? ` — then with ${lastMeeting.team}, now with ${team}` : ''}.</li>
            {usage && beforeAvg[usage] !== undefined && recentAvg[usage] !== undefined && beforeLast.length >= 3 && Math.abs(recentAvg[usage] - beforeAvg[usage]) >= beforeAvg[usage] * 0.1 && (
              <li>
                {name}&apos;s {usage.toLowerCase()} per game: {f1(beforeAvg[usage])} in the five games before that meeting → {f1(recentAvg[usage])} over the latest five ({recentAvg[usage] > beforeAvg[usage] ? 'an expanded role' : 'a reduced role'}).
              </li>
            )}
            {cats[0] && beforeAvg[cats[0]] !== undefined && beforeLast.length >= 3 && (
              <li>
                {cats[0]} per game: {f1(beforeAvg[cats[0]])} then → {f1(recentAvg[cats[0]] ?? 0)} now.
              </li>
            )}
          </>
        )}
        {ctx && ctx !== 'loading' && ctx.changes.team.before && (
          <li>
            {team} scored {f1(ctx.changes.team.before.pf)} and allowed {f1(ctx.changes.team.before.pa)} per game going into that meeting; now {f1(ctx.changes.team.now.pf)} and {f1(ctx.changes.team.now.pa)}.
          </li>
        )}
        {ctx && ctx !== 'loading' && ctx.changes.opponent.before && (
          <li>
            {opponent} scored {f1(ctx.changes.opponent.before.pf)} and allowed {f1(ctx.changes.opponent.before.pa)} then; now {f1(ctx.changes.opponent.now.pf)} and {f1(ctx.changes.opponent.now.pa)}.
          </li>
        )}
        {ctx && ctx !== 'loading' && (ctx.changes.injuries.team.length > 0 || ctx.changes.injuries.opponent.length > 0) && (
          <li>
            Out now — {team}: {ctx.changes.injuries.team.join(', ') || 'none listed'} · {opponent}: {ctx.changes.injuries.opponent.join(', ') || 'none listed'}.
          </li>
        )}
        <li className="text-[10px] text-muted">Coaching and transaction changes are not available from the data feeds; the role, scoring and injury changes above are computed from logs and the live report.</li>
      </ul>

      <SectionTitle n={4}>HOW IT FITS TOGETHER TONIGHT</SectionTitle>
      <p className="rounded-xl border border-accent/25 bg-accent/[0.06] px-3 py-2 text-[11px] leading-relaxed text-text2">
        {ctx === 'loading' ? 'Loading the matchup picture…' : ctx ? ctx.convergence : 'Team results are not available for this matchup.'}
        {cats[0] && meetings.length > 0 && recent.length >= 3 && recentAvg[cats[0]] !== undefined && meetAvg[cats[0]] !== undefined && (
          <>
            {' '}
            For {name}, the career line against {opponent} ({f1(meetAvg[cats[0]])} {cats[0]}) {recentAvg[cats[0]] > meetAvg[cats[0]] * 1.1 ? 'sits below' : recentAvg[cats[0]] < meetAvg[cats[0]] * 0.9 ? 'sits above' : 'is in line with'} his current form ({f1(recentAvg[cats[0]])}).
          </>
        )}
      </p>
    </div>
  )
}

/**
 * The research card on a player page: pick any time period and every number recalculates instantly from the game log that is
 * already loaded (no new request). "vs This Opponent" opens the four-part matchup view.
 */
export function PlayerResearch({ sport, name, team, tonight, gamesOverride }: { sport: 'mlb' | 'nfl' | 'nba' | 'nhl' | 'cfb' | 'cbb'; name: string; team: string; tonight: { opponent: string; home: boolean } | null; gamesOverride?: CareerGame[] }) {
  const { id, setId, ctx } = useTimeWindow()
  const { career } = useCareer()
  const games = gamesOverride ?? (career.state === 'ready' ? career.games : null)
  const loading = !gamesOverride && career.state === 'loading'
  const win = useMemo(() => (games ? applyWindow(games, id, ctx) : null), [games, id, ctx])
  const season = useMemo(() => (games ? applyWindow(games, DEFAULT_WINDOW, ctx).games : []), [games, ctx])
  const label = WINDOW_OPTIONS[sport].find((w) => w.id === id)?.label ?? id

  return (
    <div className="rounded-2xl border border-border bg-card p-3.5 md:p-6">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[9px] font-extrabold tracking-[0.1em] text-muted md:text-[10px]">RESEARCH · TIME PERIOD</span>
        <span className="text-[10px] text-muted">{id === DEFAULT_WINDOW ? 'Full Season (default)' : label}</span>
      </div>
      <TimePeriodSelector sport={sport} value={id} onChange={setId} hasOpponent={!!tonight} />
      {tonight ? <p className="mt-1 text-[10px] text-muted">Tonight: {tonight.home ? 'vs' : '@'} {tonight.opponent}. Every stat and prop hit rate on this page follows the period you pick.</p> : <p className="mt-1 text-[10px] text-muted">No game today, so “vs This Opponent” is off. Every stat and prop hit rate on this page follows the period you pick.</p>}
      <div className="mt-2.5">
        {loading || !games ? (
          <div className="rounded-lg border border-border bg-card3 px-3 py-4 text-center text-[11px] text-muted">{loading ? 'Loading the game log…' : 'The game log is unavailable for this player.'}</div>
        ) : id === 'vsOpp' && tonight ? (
          <VsOpponentView sport={sport} name={name} team={team} opponent={tonight.opponent} games={games} />
        ) : win?.games.length === 0 && win.note ? (
          <p className="rounded-lg border border-border bg-card3 px-3 py-4 text-center text-[11px] text-muted">{win.note}</p>
        ) : (
          win && <WindowTable games={win.games} label={label.replace('Full Season', 'Season').slice(0, 9)} season={season} compare={id !== DEFAULT_WINDOW} />
        )}
        {win?.note && win.games.length > 0 && id !== 'vsOpp' && <p className="mt-1 text-[10px] text-muted">{win.note}</p>}
      </div>
    </div>
  )
}
