'use client'

import {
  DAY_NIGHT_OPTIONS,
  HANDEDNESS_OPTIONS,
  HOME_AWAY_OPTIONS,
  MONTH_OPTIONS,
  type LeaderFilters,
} from '@/lib/mlb/filters'

function PillGroup<T extends string>({
  label,
  options,
  active,
  onChange,
  disabled,
}: {
  label: string
  options: readonly T[]
  active: T
  onChange: (v: T) => void
  disabled?: boolean
}) {
  return (
    <div>
      <div className="mb-1.5 text-[9px] font-bold uppercase tracking-wide text-muted">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const isActive = active === o
          return (
            <button
              key={o}
              disabled={disabled}
              onClick={() => onChange(o)}
              className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                isActive ? 'border-accent bg-accent text-white' : 'border-border text-muted hover:border-border2 hover:text-text2'
              }`}
            >
              {o}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function LeaderFilterPanel({
  filters,
  onChange,
  teamSection,
  hideHandedness,
}: {
  filters: LeaderFilters
  onChange: (next: LeaderFilters) => void
  /** Team → Player selector, shown in place of the old single-level "vs Team" dropdown. */
  teamSection: React.ReactNode
  hideHandedness?: boolean
}) {
  const handednessActive = !hideHandedness && filters.handedness !== 'All'

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-3.5 md:p-4">
      {teamSection}

      <PillGroup
        label="Home / Away"
        options={HOME_AWAY_OPTIONS}
        active={filters.homeAway}
        onChange={(v) => onChange({ ...filters, homeAway: v })}
        disabled={handednessActive}
      />

      {!hideHandedness && (
        <PillGroup
          label="vs Handedness"
          options={HANDEDNESS_OPTIONS}
          active={filters.handedness}
          onChange={(v) => onChange({ ...filters, handedness: v })}
        />
      )}
      {handednessActive && (
        <p className="-mt-2.5 text-[10px] leading-relaxed text-muted">
          Handedness splits are season-long and can&apos;t be combined with the other filters below.
        </p>
      )}
      {hideHandedness && (
        <p className="-mt-2.5 text-[10px] leading-relaxed text-muted">
          vs Handedness isn&apos;t available for Betting Stats — hit rates need per-game data the API
          doesn&apos;t split by pitcher handedness.
        </p>
      )}

      <PillGroup
        label="Game Time"
        options={DAY_NIGHT_OPTIONS}
        active={filters.dayNight}
        onChange={(v) => onChange({ ...filters, dayNight: v })}
        disabled={handednessActive}
      />

      <PillGroup
        label="Month"
        options={MONTH_OPTIONS}
        active={filters.month}
        onChange={(v) => onChange({ ...filters, month: v })}
        disabled={handednessActive}
      />
    </div>
  )
}
