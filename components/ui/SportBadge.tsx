import { sportMeta } from '@/lib/sport/meta'
import type { Sport } from '@/lib/sport/SportContext'

export function SportBadge({ sport, className = '' }: { sport: Sport; className?: string }) {
  const meta = sportMeta(sport)
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[9px] font-bold ${className}`}
      style={{ background: `${meta.color}1F`, color: meta.color }}
    >
      <span className="h-1 w-1 rounded-full" style={{ background: meta.color }} />
      {meta.icon} {meta.label}
    </span>
  )
}
