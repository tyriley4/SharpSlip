import type { BetTileData } from '@/data/breakdown/summaryTypes'

export function BetTile({ rec, pct, label }: BetTileData) {
  const tone = pct >= 60 ? 'positive' : pct <= 40 ? 'negative' : 'neutral'
  const classes =
    tone === 'positive'
      ? { text: 'text-positive', border: 'border-positive/20', bg: 'bg-positive/[0.07]' }
      : tone === 'negative'
        ? { text: 'text-negative', border: 'border-negative/20', bg: 'bg-negative/[0.07]' }
        : { text: 'text-text2', border: 'border-border', bg: 'bg-white/[0.03]' }

  return (
    <div className={`rounded-[10px] border p-2 text-center ${classes.border} ${classes.bg}`}>
      <div className={`mb-0.5 text-sm font-black ${classes.text}`}>{rec}</div>
      <div className="mb-1 h-[2px] overflow-hidden rounded-full bg-border2">
        <div className={`h-full rounded-full ${tone === 'positive' ? 'bg-positive' : tone === 'negative' ? 'bg-negative' : 'bg-text2'}`} style={{ width: `${pct}%` }} />
      </div>
      <div className={`mb-0.5 text-[11px] font-bold ${classes.text}`}>{pct}%</div>
      <div className="text-[8px] leading-tight text-muted">{label}</div>
    </div>
  )
}
