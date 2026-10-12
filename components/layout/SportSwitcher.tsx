'use client'

import { trackEvent } from '@/lib/analytics/posthog'
import { SPORT_META, isCollege } from '@/lib/sport/meta'
import { SPORTS, useSport } from '@/lib/sport/SportContext'

export function SportSwitcher({ layout = 'row' }: { layout?: 'row' | 'grid' }) {
  const { sport, setSport } = useSport()

  return (
    <div
      className={
        layout === 'grid'
          ? 'grid grid-cols-2 gap-2'
          : 'flex gap-2 overflow-x-auto pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
      }
    >
      {SPORTS.map((s) => {
        const active = sport === s.id
        return (
          <button
            key={s.id}
            onClick={() => {
              trackEvent('sport_filter_selected', { sport: s.id })
              setSport(s.id)
            }}
            // The college pills carry their own brand colors (CFB dark red, CBB amber); the pro leagues share the accent blue.
            style={active && isCollege(s.id) ? { borderColor: SPORT_META[s.id].color, background: `${SPORT_META[s.id].color}33`, color: SPORT_META[s.id].text } : undefined}
            className={`flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full border-2 px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              layout === 'row' ? 'shrink-0' : ''
            } ${
              active
                ? isCollege(s.id)
                  ? ''
                  : 'border-accent bg-accent/15 text-accent'
                : 'border-border bg-transparent text-text2 hover:border-border2 hover:text-text'
            }`}
          >
            <span>{s.icon}</span>
            <span>{s.label}</span>
          </button>
        )
      })}
    </div>
  )
}
