'use client'

import { useEffect, useState } from 'react'
import type { CfbCard } from '@/lib/espn/live'
import type { Sport } from '@/lib/sport/SportContext'

function Team({ t, winning }: { t: CfbCard['away']; winning: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2">
        {t.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={t.logo} alt="" width={20} height={20} className="h-5 w-5 shrink-0 object-contain" />
        ) : (
          <span className="h-5 w-5 shrink-0 rounded-full bg-card3" />
        )}
        <span className={`truncate text-[12px] ${winning ? 'font-extrabold text-text' : 'font-semibold text-text2'}`}>{t.name}</span>
        {t.record && <span className="shrink-0 text-[9px] text-muted">{t.record}</span>}
      </div>
      <span className={`stat-number text-[15px] ${winning ? 'text-text' : 'text-muted'}`}>{t.score ?? '—'}</span>
    </div>
  )
}

function Card({ g }: { g: CfbCard }) {
  const live = g.state === 'in'
  const awayWin = g.state !== 'pre' && (g.away.score ?? 0) > (g.home.score ?? 0)
  const homeWin = g.state !== 'pre' && (g.home.score ?? 0) > (g.away.score ?? 0)
  return (
    <div className="w-[230px] shrink-0 rounded-[14px] border border-border bg-card p-3.5 md:w-auto">
      <div className="mb-2 flex items-center justify-between">
        <span className={`rounded-full px-2 py-0.5 text-[9px] font-extrabold ${live ? 'bg-loss/15 text-loss' : 'bg-card3 text-muted'}`}>{live ? `LIVE · ${g.status}` : g.status}</span>
        {g.network && <span className="text-[9px] font-bold text-text2">📺 {g.network}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Team t={g.away} winning={awayWin} />
        <Team t={g.home} winning={homeWin} />
      </div>
      {g.venue && <div className="mt-2 truncate text-[9px] text-muted">{g.venue}</div>}
    </div>
  )
}

/** College football scores: only rendered while games are in progress, finished today, or about to start. */
export function CfbScores({ initial, sportFilter }: { initial: CfbCard[]; sportFilter: Sport | 'all' }) {
  const [games, setGames] = useState<CfbCard[]>(initial)

  useEffect(() => {
    let cancelled = false
    const id = setInterval(() => {
      fetch('/api/live-scores')
        .then((r) => (r.ok ? r.json() : null))
        .then((data: { cfb?: CfbCard[] } | null) => {
          if (!cancelled && data?.cfb) setGames(data.cfb)
        })
        .catch(() => undefined)
    }, 60_000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  // CFB isn't one of the four sport filters, so it only shows under "All".
  if (sportFilter !== 'all' || games.length === 0) return null

  return (
    <div className="flex flex-col gap-3">
      <h2 className="section-header text-sm text-text md:text-base">🎓 College Football</h2>
      <div className="flex gap-2.5 overflow-x-auto pb-1 [scrollbar-width:none] md:grid md:grid-cols-2 md:gap-3 md:overflow-visible lg:grid-cols-3 [&::-webkit-scrollbar]:hidden">
        {games.map((g) => (
          <Card key={g.id} g={g} />
        ))}
      </div>
    </div>
  )
}
