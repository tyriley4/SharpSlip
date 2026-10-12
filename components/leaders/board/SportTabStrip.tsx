'use client'

import { trackEvent } from '@/lib/analytics/posthog'
import { useSport } from '@/lib/sport/SportContext'
import { SPORT_TAB_STYLES } from './theme'

export function SportTabStrip() {
  const { sport, setSport } = useSport()

  return (
    <div className="grid grid-cols-3 gap-2 md:grid-cols-6" role="tablist" aria-label="Sport">
      {SPORT_TAB_STYLES.map((s) => {
        const active = sport === s.id
        return (
          <button
            key={s.id}
            role="tab"
            aria-selected={active}
            onClick={() => {
              trackEvent('sport_filter_selected', { sport: s.id })
              setSport(s.id)
            }}
            className="flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2.5 text-[12px] font-extrabold transition-all duration-200 md:text-[13px]"
            style={
              active
                ? { background: s.color, color: s.textOnActive, borderColor: s.color, boxShadow: `0 0 16px ${s.glow}` }
                : { background: '#111318', color: '#8B909A', borderColor: '#1F2229' }
            }
          >
            <span className="text-base leading-none">{s.icon}</span>
            {s.label}
          </button>
        )
      })}
    </div>
  )
}
