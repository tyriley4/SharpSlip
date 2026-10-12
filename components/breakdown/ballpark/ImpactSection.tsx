import type { BallparkData } from '@/data/breakdown/ballparkTypes'

const DIRECTION_LABEL: Record<string, string> = {
  for: '✓ Supports',
  against: '✕ Works Against',
  neutral: '— Neutral',
}

export function ImpactSection({ bp }: { bp: BallparkData }) {
  return (
    <div>
      <div className="mb-2.5 text-[9px] font-extrabold tracking-[0.1em] text-muted">
        HOW TONIGHT&apos;S CONDITIONS AFFECT YOUR BETS
      </div>
      <div className="flex flex-col gap-2">
        {bp.impacts.map((item) => {
          const dirColor = item.direction === 'for' ? 'text-positive' : item.direction === 'against' ? 'text-negative' : 'text-muted'
          const dirBorder = item.direction === 'for' ? 'border-positive/20' : item.direction === 'against' ? 'border-negative/20' : 'border-border'
          const dirBg = item.direction === 'for' ? 'bg-positive/[0.07]' : item.direction === 'against' ? 'bg-negative/[0.07]' : 'bg-white/[0.03]'
          return (
            <div key={item.bet} className={`rounded-xl border p-3 ${dirBorder} ${dirBg}`}>
              <div className="mb-1.5 flex items-center gap-2">
                <span className="text-base">{item.icon}</span>
                <div className="flex-1">
                  <div className="text-xs font-extrabold text-text">{item.bet}</div>
                  <div className={`text-[10px] font-bold ${dirColor}`}>{DIRECTION_LABEL[item.direction]}</div>
                </div>
              </div>
              <div className="mb-1 text-[11px] font-bold text-text">{item.headline}</div>
              <p className="text-[11px] leading-relaxed text-text2">{item.body}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
