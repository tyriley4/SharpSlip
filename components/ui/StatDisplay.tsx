export function StatDisplay({
  value,
  label,
  trend,
  className = '',
}: {
  value: string | number
  label: string
  trend?: 'up' | 'down'
  className?: string
}) {
  return (
    <div className={className}>
      <div className="flex items-center gap-1.5">
        <span className="stat-featured">{value}</span>
        {trend && (
          <span className={`text-sm font-bold ${trend === 'up' ? 'text-win' : 'text-loss'}`}>
            {trend === 'up' ? '▲' : '▼'}
          </span>
        )}
      </div>
      <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">{label}</div>
    </div>
  )
}

/** Color-coded hit-rate display: 65%+ green, 45-64% neutral, below 45% red. */
export function HitRateDisplay({ pct, record, className = '' }: { pct: number; record?: string; className?: string }) {
  const color = pct >= 65 ? 'text-grade-a' : pct >= 45 ? 'text-text' : 'text-loss'
  return (
    <div className={className}>
      <div className={`stat-featured ${color}`}>{pct.toFixed(0)}%</div>
      {record && <div className="mt-0.5 text-[11px] font-semibold text-muted">{record}</div>}
    </div>
  )
}
