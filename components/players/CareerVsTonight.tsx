import type { CareerVsOpponent, StatLine } from '@/lib/players/types'

const TONE_TEXT: Record<string, string> = {
  positive: 'text-positive',
  negative: 'text-negative',
  neutral: 'text-text2',
}

const TONE_BG: Record<string, string> = {
  positive: 'bg-positive/[0.06]',
  negative: 'bg-negative/[0.06]',
  neutral: '',
}

function formatStatLine(stats: StatLine): string {
  return Object.entries(stats)
    .map(([k, v]) => `${k.toUpperCase()} ${v}`)
    .join(' · ')
}

export function CareerVsTonight({ data }: { data: CareerVsOpponent }) {
  const overallEntries = Object.entries(data.overall ?? {})

  return (
    <div className="rounded-2xl border border-border bg-card p-3.5 md:p-6">
      <div className="mb-3 flex items-center justify-between md:mb-4">
        <div className="text-[9px] font-extrabold tracking-[0.1em] text-muted md:text-[10px]">
          CAREER VS {data.opponent?.toUpperCase() ?? 'OPPONENT'}
        </div>
        {data.record && (
          <div className="rounded-md bg-card3 px-2 py-0.5 text-[11px] font-bold text-text">{data.record}</div>
        )}
      </div>

      {overallEntries.length > 0 && (
        <div className="mb-4 grid grid-cols-3 gap-1.5 md:mb-5 md:grid-cols-4 md:gap-2">
          {overallEntries.map(([label, value]) => (
            <div key={label} className="rounded-lg bg-card3 py-2 text-center">
              <div className="text-[13px] font-bold text-text">{value}</div>
              <div className="mt-0.5 text-[8px] uppercase tracking-wide text-muted">{label}</div>
            </div>
          ))}
        </div>
      )}

      {data.seasons && data.seasons.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border">
          <div className="grid grid-cols-[64px_44px_1fr] gap-1 border-b border-border bg-card3 px-2.5 py-1.5">
            {['SEASON', 'GP', 'STATS'].map((h) => (
              <div key={h} className="text-[9px] font-bold text-muted">
                {h}
              </div>
            ))}
          </div>
          {data.seasons.map((s, i) => (
            <div
              key={s.season}
              className={`grid grid-cols-[64px_44px_1fr] items-center gap-1 px-2.5 py-2 ${
                i < (data.seasons?.length ?? 0) - 1 ? 'border-b border-border' : ''
              } ${TONE_BG[s.tone ?? 'neutral']}`}
            >
              <div className="text-xs font-bold text-text">{s.season}</div>
              <div className="text-xs text-text2">{s.games}</div>
              <div className={`truncate text-[11px] font-semibold ${TONE_TEXT[s.tone ?? 'neutral']}`}>
                {formatStatLine(s.stats)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
