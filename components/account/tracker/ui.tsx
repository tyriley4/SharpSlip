'use client'

import type { ReactNode } from 'react'

export function FieldLabel({ children }: { children: ReactNode }) {
  return <div className="mb-1.5 text-[9px] font-extrabold uppercase tracking-[0.1em] text-muted">{children}</div>
}

export function StepHeader({ n, title, hint }: { n: number; title: string; hint?: string }) {
  return (
    <div className="mb-2.5 flex items-center gap-2.5">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/15 text-[11px] font-extrabold text-accent">{n}</span>
      <div>
        <div className="text-[13px] font-extrabold text-text">{title}</div>
        {hint && <div className="text-[10px] text-muted">{hint}</div>}
      </div>
    </div>
  )
}

export function Pill({ active, onClick, children, disabled }: { active: boolean; onClick: () => void; children: ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={`shrink-0 rounded-full border px-3.5 py-1.5 text-[11px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        active ? 'border-accent bg-accent text-white shadow-[0_0_10px_rgba(59,158,255,0.3)]' : 'border-border bg-card text-text2 hover:border-border2 hover:text-text'
      }`}
    >
      {children}
    </button>
  )
}

export const INPUT_CLASS =
  'w-full rounded-xl border border-border bg-card3 px-3 py-2.5 text-[13px] font-semibold text-text placeholder:text-muted focus:border-accent focus:outline-none [color-scheme:dark]'

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${INPUT_CLASS} ${props.className ?? ''}`} />
}
