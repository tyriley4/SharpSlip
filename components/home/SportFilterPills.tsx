'use client'

import { trackEvent } from '@/lib/analytics/posthog'
import { SPORT_META, isCollege } from '@/lib/sport/meta'
import { SPORTS } from '@/lib/sport/SportContext'
import type { Sport } from '@/lib/sport/SportContext'

export function SportFilterPills({ value, onChange }: { value: Sport | 'all'; onChange: (v: Sport | 'all') => void }) {
  return (
    <div className="flex gap-1.5 overflow-x-auto border-b border-border px-3.5 py-2 [scrollbar-width:none] md:px-0 md:py-3 [&::-webkit-scrollbar]:hidden">
      <button
        onClick={() => {
          trackEvent('sport_filter_selected', { sport: 'all' })
          onChange('all')
        }}
        className={`shrink-0 rounded-full border px-3.5 py-1.5 text-[11px] font-semibold transition-colors ${
          value === 'all' ? 'border-accent bg-accent text-white shadow-[0_0_12px_rgba(59,158,255,0.3)]' : 'border-border bg-card text-muted'
        }`}
      >
        All
      </button>
      {SPORTS.map((s) => (
        <button
          key={s.id}
          onClick={() => {
            trackEvent('sport_filter_selected', { sport: s.id })
            onChange(s.id)
          }}
          style={value === s.id && isCollege(s.id) ? { borderColor: SPORT_META[s.id].color, background: SPORT_META[s.id].color, color: '#fff', boxShadow: `0 0 12px ${SPORT_META[s.id].color}66` } : undefined}
          className={`shrink-0 rounded-full border px-3.5 py-1.5 text-[11px] font-semibold transition-colors ${
            value === s.id ? (isCollege(s.id) ? '' : 'border-accent bg-accent text-white shadow-[0_0_12px_rgba(59,158,255,0.3)]') : 'border-border bg-card text-muted'
          }`}
        >
          {s.icon} {s.label}
        </button>
      ))}
    </div>
  )
}
