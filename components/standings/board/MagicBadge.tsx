import type { MagicInfo } from '@/lib/standings/playoffs'

/** Magic (M, green) / elimination (E, red) number — only rendered when it is close enough to matter. */
export function MagicBadge({ magic, compact = false }: { magic: MagicInfo | null; compact?: boolean }) {
  if (!magic) return null
  const base = 'shrink-0 rounded px-1.5 py-px text-[9px] font-extrabold tracking-wide tabular-nums'
  if (magic.kind === 'M')
    return (
      <span className={base} style={{ color: '#00E5A0', background: 'rgba(0,229,160,0.12)' }} title="Magic number to clinch a playoff spot">
        M: {magic.n}
      </span>
    )
  if (magic.kind === 'E')
    return (
      <span className={base} style={{ color: '#EF4444', background: 'rgba(239,68,68,0.12)' }} title="Elimination number">
        E: {magic.n}
      </span>
    )
  if (magic.kind === 'clinched')
    return (
      <span className={base} style={{ color: '#00E5A0', background: 'rgba(0,229,160,0.12)' }} title="Clinched a playoff spot">
        {compact ? '✓' : '✓ CLINCHED'}
      </span>
    )
  if (compact) return null
  return (
    <span className={base} style={{ color: '#8B909A', background: 'rgba(139,144,154,0.12)' }} title="Eliminated from playoff contention">
      ELIM
    </span>
  )
}
