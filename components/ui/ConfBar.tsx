const GRADE_GRADIENT: Record<'grade-a' | 'grade-b' | 'grade-c', string> = {
  'grade-a': 'linear-gradient(90deg, #00B87E 0%, #00E5A0 100%)',
  'grade-b': 'linear-gradient(90deg, #0090AD 0%, #00B4D8 100%)',
  'grade-c': 'linear-gradient(90deg, #CC9300 0%, #FFB800 100%)',
}

const GLOW: Record<'grade-a' | 'grade-b' | 'grade-c', string> = {
  'grade-a': '0 0 8px rgba(0,229,160,0.6)',
  'grade-b': '0 0 8px rgba(0,180,216,0.6)',
  'grade-c': '0 0 8px rgba(255,184,0,0.6)',
}

export function ConfBar({ pct, grade }: { pct: number; grade?: string }) {
  const tier: 'grade-a' | 'grade-b' | 'grade-c' =
    grade === 'A' || grade === 'A+' || grade === 'A-'
      ? 'grade-a'
      : grade === 'B' || grade === 'B+'
        ? 'grade-b'
        : grade
          ? 'grade-c'
          : pct >= 80
            ? 'grade-a'
            : pct >= 65
              ? 'grade-b'
              : 'grade-c'

  return (
    <div className="mt-1 h-[6px] overflow-hidden rounded-full bg-border2">
      <div
        className="conf-bar-fill h-full rounded-full transition-[width]"
        style={{ width: `${pct}%`, background: GRADE_GRADIENT[tier], boxShadow: GLOW[tier] }}
      />
    </div>
  )
}
