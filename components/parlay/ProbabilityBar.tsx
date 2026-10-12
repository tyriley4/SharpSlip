'use client'

import { formatProb, probTone } from '@/lib/parlay/math'

export function ProbabilityBar({ prob, legCount }: { prob: number; legCount: number }) {
  const tone = probTone(prob)
  const hasLegs = legCount > 0
  const width = hasLegs ? Math.max(2, Math.min(100, prob)) : 0

  return (
    <div className="rounded-[14px] border border-border bg-card p-4">
      <div className="mb-2 flex items-end justify-between gap-3">
        <div className="stat-featured" style={{ color: hasLegs ? tone.color : 'var(--muted)', fontSize: '2.5rem' }}>
          {hasLegs ? formatProb(prob) : '—'}
        </div>
        {hasLegs && (
          <span className="mb-1 rounded-full border px-2 py-0.5 text-[10px] font-bold" style={{ borderColor: `${tone.color}66`, color: tone.color, background: `${tone.color}1A` }}>
            {tone.label}
          </span>
        )}
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-border2" role="progressbar" aria-valuenow={Math.round(prob)} aria-valuemin={0} aria-valuemax={100}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${width}%`, background: tone.color, boxShadow: hasLegs ? `0 0 10px ${tone.color}99` : 'none' }}
        />
      </div>
      <div className="mt-2 text-[11px] font-semibold text-text2">Combined probability of all legs hitting</div>
      <p className="mt-1.5 text-[10px] leading-relaxed text-muted">
        Most parlays do not hit. The more legs you add, the lower your actual probability of winning.
      </p>
    </div>
  )
}
