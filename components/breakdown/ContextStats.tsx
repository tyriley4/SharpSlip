import type { ContextStat } from '@/data/breakdown/types'

export function ContextStats({ stats }: { stats: ContextStat[] }) {
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {stats.map((c) => (
        <div key={c.label} className="rounded-[10px] bg-card3 py-1.5 text-center">
          <div className={`mb-0.5 text-[11px] font-extrabold ${c.good ? 'text-positive' : 'text-text'}`}>
            {c.val}
          </div>
          <div className="text-[8px] text-muted">{c.label}</div>
        </div>
      ))}
    </div>
  )
}
