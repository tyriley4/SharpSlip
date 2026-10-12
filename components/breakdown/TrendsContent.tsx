'use client'

import { useState } from 'react'
import { PillTabs } from '@/components/ui/PillTabs'
import type { TrendItem } from '@/data/breakdown/summaryTypes'

export function TrendsContent({
  tags,
  trends,
  teamColors,
}: {
  tags: string[]
  trends: TrendItem[]
  teamColors: Record<string, string>
}) {
  const [active, setActive] = useState('All')
  const filtered = active === 'All' ? trends : trends.filter((t) => t.cat === active)

  return (
    <div className="flex flex-col gap-2 px-3.5 pt-3 md:px-8 md:pt-5">
      <div className="mb-1 md:max-w-2xl">
        <PillTabs options={tags} active={active} onChange={setActive} />
      </div>
      <div className="flex flex-col gap-2 md:grid md:grid-cols-2 md:gap-3 xl:grid-cols-3">
        {filtered.map((t) => {
          const tc = t.team ? (teamColors[t.team] ?? '#4d9fff') : null
          return (
            <div
              key={t.title}
              className={`rounded-2xl border p-3 ${
                t.hot ? 'border-hot/20 bg-hot/[0.08]' : 'border-cold/20 bg-cold/[0.05]'
              }`}
            >
              <div className="flex items-start gap-2.5">
                <span className="shrink-0 text-lg">{t.hot ? '🔥' : '❄️'}</span>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-1.5">
                    <span className="text-xs font-bold text-text">{t.title}</span>
                    {t.team && (
                      <span
                        className="rounded-md px-1.5 py-0.5 text-[9px] font-bold"
                        style={{ background: `${tc}22`, color: tc ?? undefined }}
                      >
                        {t.team}
                      </span>
                    )}
                    <span className="rounded-full border border-border bg-card3 px-1.5 py-0.5 text-[9px] font-bold text-muted">
                      {t.cat}
                    </span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-text2">{t.body}</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
