'use client'

import { trackEvent } from '@/lib/analytics/posthog'
import { PlayerLink } from '@/components/players/PlayerLink'
import { useEffect, useMemo, useState } from 'react'
import { LineRowView } from '@/components/parlay/LineButton'
import { useAccountData } from '@/lib/account/AccountDataContext'
import { formatOdds } from '@/lib/account/odds'
import type { GameOdds, GamePropsResult } from '@/lib/odds/types'
import { gameLineRows, propGroups, fmtLine } from '@/lib/parlay/lines'
import type { Sport } from '@/lib/sport/SportContext'

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="section-header mb-2 mt-1 text-sm text-text">{children}</h3>
}

type Load<T> = { state: 'loading' } | { state: 'ready'; data: T } | { state: 'unavailable' }

const SOURCE_LABEL: Record<GameOdds['source'], string> = {
  'the-odds-api': 'The Odds API',
  oddspapi: 'OddsPapi',
  espn: 'ESPN',
}

function timeAgo(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000))
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  return `${Math.round(mins / 60)}h ago`
}

function useJson<T>(url: string, pick: (json: unknown) => T | null): Load<T> & { reload: () => void } {
  const [state, setState] = useState<Load<T>>({ state: 'loading' })
  const [nonce, setNonce] = useState(0)
  useEffect(() => {
    const ctrl = new AbortController()
    setState({ state: 'loading' })
    fetch(url, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((json) => {
        const data = pick(json)
        setState(data ? { state: 'ready', data } : { state: 'unavailable' })
      })
      .catch((err) => {
        if ((err as Error).name !== 'AbortError') setState({ state: 'unavailable' })
      })
    return () => ctrl.abort()
    // `pick` is stable per call site (module-level functions), so only url/nonce restart the load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, nonce])
  return { ...state, reload: () => setNonce((n) => n + 1) }
}

const pickOdds = (json: unknown) => (json as { odds?: GameOdds | null }).odds ?? null
interface PropsPayload {
  props: GamePropsResult | null
  /** 'budget' = paused to protect the free-tier credit allowance; 'not-posted' = books haven't released them. */
  reason: string
}

const pickProps = (json: unknown): PropsPayload | null => {
  const j = json as { props?: GamePropsResult | null; reason?: string }
  return j && 'reason' in j ? { props: j.props ?? null, reason: String(j.reason) } : null
}

function BookCompare({ odds }: { odds: GameOdds }) {
  const { settings } = useAccountData()
  const [open, setOpen] = useState(false)
  if (odds.books.length < 2) return null
  const fmt = (n: number | null) => (n === null ? '—' : formatOdds(n, settings.oddsFormat))
  return (
    <div className="rounded-[14px] border border-border bg-card">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between px-3 py-2.5 text-left text-[11px] font-bold text-text2" aria-expanded={open}>
        <span>Compare {odds.books.length} sportsbooks</span>
        <span className="text-muted">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="overflow-x-auto border-t border-border px-1 pb-2">
          <table className="w-full min-w-[420px] text-[11px]">
            <thead>
              <tr className="text-left text-[9px] font-extrabold tracking-[0.08em] text-muted">
                <th className="px-2 py-2">BOOK</th>
                <th className="px-2 py-2">{odds.away} ML</th>
                <th className="px-2 py-2">{odds.home} ML</th>
                <th className="px-2 py-2">SPREAD ({odds.away})</th>
                <th className="px-2 py-2">TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {odds.books.map((b, i) => (
                <tr key={b.bookKey} className={i % 2 === 0 ? 'bg-card' : 'bg-card2'}>
                  <td className="px-2 py-1.5 font-semibold text-text">{b.book}</td>
                  <td className="stat-number px-2 py-1.5 text-text2">{fmt(b.awayMl)}</td>
                  <td className="stat-number px-2 py-1.5 text-text2">{fmt(b.homeMl)}</td>
                  <td className="stat-number px-2 py-1.5 text-text2">{b.awaySpread ? `${fmtLine(b.awaySpread.point)} (${fmt(b.awaySpread.price)})` : '—'}</td>
                  <td className="stat-number px-2 py-1.5 text-text2">{b.total ? `${b.total.point} (${fmt(b.total.over)}/${fmt(b.total.under)})` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Unavailable({ children, onRetry }: { children: React.ReactNode; onRetry?: () => void }) {
  return (
    <div className="rounded-[14px] border border-border bg-card px-4 py-8 text-center text-xs text-muted">
      <div>{children}</div>
      {onRetry && (
        <button onClick={onRetry} className="mt-3 rounded-lg border border-border2 px-3 py-1.5 text-[11px] font-semibold text-text2 hover:border-accent hover:text-accent">
          Try again
        </button>
      )}
    </div>
  )
}

export function LinesTab({ sport, gameId, awayAbbr, homeAbbr }: { sport: Sport; gameId: string; awayAbbr: string; homeAbbr: string }) {
  useEffect(() => {
    trackEvent('lines_tab_opened', { sport, gameId })
  }, [sport, gameId])
  const qs = `sport=${sport}&gameId=${encodeURIComponent(gameId)}&away=${encodeURIComponent(awayAbbr)}&home=${encodeURIComponent(homeAbbr)}`
  const odds = useJson<GameOdds>(`/api/odds?${qs}`, pickOdds)
  const props = useJson<PropsPayload>(`/api/odds/props?${qs}`, pickProps)

  const oddsData = odds.state === 'ready' ? odds.data : null
  const propsData = props.state === 'ready' ? props.data.props : null
  const propsReason = props.state === 'ready' ? props.data.reason : null
  const gameRows = useMemo(() => (oddsData ? gameLineRows(oddsData) : []), [oddsData])
  const propRows = useMemo(
    () => (propsData ? propGroups(sport, gameId, `${awayAbbr} @ ${homeAbbr}`, propsData.props, () => null) : []),
    [propsData, sport, gameId, awayAbbr, homeAbbr]
  )
  const reload = odds.reload

  return (
    <div className="flex flex-col gap-3 px-3.5 pt-3 md:px-0 md:pt-0">
      {odds.state === 'ready' && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-border bg-card px-3 py-2 text-[11px] text-text2">
          <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-extrabold text-accent">{odds.data.book}</span>
          {odds.data.live && <span className="rounded-full bg-loss/15 px-2 py-0.5 text-[10px] font-extrabold text-loss">LIVE</span>}
          <span className="text-muted">
            Real posted lines via {SOURCE_LABEL[odds.data.source]} · updated {timeAgo(odds.data.fetchedAt)}
          </span>
        </div>
      )}

      <div className="md:grid md:grid-cols-2 md:items-start md:gap-6">
        <div className="flex flex-col gap-2">
          <SectionTitle>Game Lines</SectionTitle>
          {odds.state === 'loading' && <div className="h-40 animate-pulse rounded-[14px] border border-border bg-card" />}
          {odds.state === 'unavailable' && <Unavailable onRetry={reload}>Lines temporarily unavailable</Unavailable>}
          {odds.state === 'ready' &&
            (gameRows.length === 0 ? (
              <Unavailable>Lines temporarily unavailable</Unavailable>
            ) : (
              <>
                {gameRows.map((row) => (
                  <LineRowView key={row.title} row={row} />
                ))}
                <BookCompare odds={odds.data} />
                <p className="text-[10px] leading-snug text-muted">
                  Percentages are the market&apos;s no-vig implied probability. First-half and alternate lines aren&apos;t included on the free data tier.
                </p>
              </>
            ))}
        </div>

        <div className="mt-3 flex flex-col gap-2 md:mt-0">
          <SectionTitle>Player Props</SectionTitle>
          {props.state === 'loading' && <div className="h-40 animate-pulse rounded-[14px] border border-border bg-card" />}
          {props.state === 'unavailable' && <Unavailable onRetry={props.reload}>Player props temporarily unavailable</Unavailable>}
          {props.state === 'ready' &&
            (propRows.length === 0 ? (
              propsReason === 'budget' ? (
                <Unavailable>Player props are paused for now to stay within the free data allowance. They return automatically.</Unavailable>
              ) : (
                <Unavailable>Player props aren&apos;t posted for this game yet — books usually release them a day or less before the start.</Unavailable>
              )
            ) : (
              propRows.map((group) => (
                <div key={group.player} className="flex flex-col gap-2">
                  <div className="mt-1 flex items-baseline gap-1.5">
                    <PlayerLink name={group.player} team={group.team || undefined} className="text-[13px] font-extrabold text-text hover:text-accent hover:underline">
                      {group.player}
                    </PlayerLink>
                  </div>
                  {group.rows.map((row) => (
                    <LineRowView key={row.title} row={row} />
                  ))}
                </div>
              ))
            ))}
        </div>
      </div>
    </div>
  )
}
