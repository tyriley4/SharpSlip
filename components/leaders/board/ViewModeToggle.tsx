'use client'

import type { BoardMode } from './boardMode'

/** Compact Board / Chart switch for the leaders content area. */
export function ViewModeToggle({ value, onChange }: { value: BoardMode; onChange: (m: BoardMode) => void }) {
  const items: { id: BoardMode; icon: string; label: string }[] = [
    { id: 'board', icon: '📋', label: 'Board' },
    { id: 'chart', icon: '📊', label: 'Chart' },
  ]
  return (
    <div className="inline-flex gap-0.5 rounded-lg border border-border bg-card p-0.5" role="group" aria-label="Leaders view">
      {items.map((it) => {
        const active = value === it.id
        return (
          <button
            key={it.id}
            type="button"
            aria-pressed={active}
            aria-label={`${it.label} view`}
            title={`${it.label} view`}
            onClick={() => onChange(it.id)}
            className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-bold transition-colors ${
              active ? 'bg-accent text-white' : 'text-text2 hover:text-text'
            }`}
          >
            <span>{it.icon}</span>
            <span className="hidden sm:inline">{it.label}</span>
          </button>
        )
      })}
    </div>
  )
}
