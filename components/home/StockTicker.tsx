'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { TickerItem } from '@/lib/home/ticker'

const TYPE_ICON: Record<TickerItem['type'], string> = { trend: '📈', score: '', alert: '🔥' }
const TYPE_TEXT_CLASS: Record<TickerItem['type'], string> = {
  trend: 'text-text',
  score: 'text-loss',
  alert: 'text-hot',
}

export function StockTicker() {
  const router = useRouter()
  const [trends, setTrends] = useState<TickerItem[]>([])
  const [live, setLive] = useState<TickerItem[]>([])

  // Trends and streaks: computed server-side, refreshed hourly.
  useEffect(() => {
    let cancelled = false
    fetch('/api/ticker')
      .then((res) => (res.ok ? res.json() : { items: [] }))
      .then((data: { items: TickerItem[] }) => {
        // The hourly feed also carries scores; those are replaced by the real-time ESPN items below.
        if (!cancelled) setTrends((data.items ?? []).filter((i) => i.type !== 'score'))
      })
      .catch((err) => {
        console.error('[StockTicker] fetch failed', err)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Live scores: ESPN, every 30s while any game is in progress, every 5 minutes otherwise.
  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null
    async function poll() {
      let liveCount = 0
      try {
        const res = await fetch('/api/live-scores')
        if (res.ok) {
          const data = (await res.json()) as { items: TickerItem[]; liveCount: number }
          liveCount = data.liveCount ?? 0
          if (!cancelled) setLive(data.items ?? [])
        }
      } catch (err) {
        console.error('[StockTicker] live scores failed', err)
      }
      if (!cancelled) timer = setTimeout(poll, liveCount > 0 ? 30_000 : 300_000)
    }
    poll()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [])

  const items = [...live, ...trends]
  if (items.length === 0) return null

  const duration = Math.max(30, items.length * 4.5)

  return (
    <div className="h-9 w-full overflow-hidden border-b border-t border-border bg-bg font-mono">
      <div className="flex h-9 items-center whitespace-nowrap">
        <div className="ticker-track flex h-9 shrink-0 items-center" style={{ animationDuration: `${duration}s` }}>
          {[...items, ...items].map((item, i) => (
            <button
              key={`${item.id}-${i}`}
              onClick={() => router.push(item.linkTo)}
              className={`flex shrink-0 items-center gap-1.5 border-r border-border/60 px-4 text-[11px] font-semibold ${TYPE_TEXT_CLASS[item.type]} hover:opacity-80`}
            >
              <span className="h-1 w-1 shrink-0 rounded-full" style={{ background: item.sportColor }} />
              {item.type === 'score' ? (
                <span className="text-loss">●</span>
              ) : (
                <span>{TYPE_ICON[item.type]}</span>
              )}
              <span>{item.text}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
