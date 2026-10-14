import type { BallparkData } from '@/data/breakdown/ballparkTypes'

export function HistorySection({ bp }: { bp: BallparkData }) {
  const avgTotal = (bp.historical.reduce((s, h) => s + h.avgTotal, 0) / bp.historical.length).toFixed(1)
  const avgOver = Math.round(bp.historical.reduce((s, h) => s + h.overRate, 0) / bp.historical.length)
  const avgHr = (bp.historical.reduce((s, h) => s + h.hrPerGame, 0) / bp.historical.length).toFixed(1)

  return (
    <div>
      <div className="mb-2.5 text-[9px] font-extrabold tracking-[0.1em] text-muted">
        HISTORICAL SCORING (LAST 3 SEASONS)
      </div>
      <div className="mb-3 overflow-hidden rounded-2xl border border-border bg-card">
        <div className="grid grid-cols-5 gap-1 border-b border-border bg-card3 px-3.5 py-2">
          {['Season', 'Games', 'Avg Total', 'Over%', 'HR/G'].map((h) => (
            <div key={h} className={`text-[9px] font-bold text-muted ${h === 'Season' ? 'text-left' : 'text-center'}`}>
              {h}
            </div>
          ))}
        </div>
        {bp.historical.map((row, i) => (
          <div
            key={row.season}
            className={`grid grid-cols-5 gap-1 px-3.5 py-2.5 ${i < bp.historical.length - 1 ? 'border-b border-border' : ''} ${i === 0 ? 'bg-accent/5' : ''}`}
          >
            <div className={`text-xs font-bold ${i === 0 ? 'text-accent' : 'text-text2'}`}>
              {row.season}
              {i === 0 ? ' ★' : ''}
            </div>
            <div className="text-center text-xs text-text2">{row.games}</div>
            <div className={`text-center text-xs font-semibold ${row.avgTotal >= 9 ? 'text-negative' : row.avgTotal <= 8.5 ? 'text-positive' : 'text-text2'}`}>
              {row.avgTotal}
            </div>
            <div className={`text-center text-xs ${row.overRate >= 55 ? 'text-negative' : row.overRate <= 50 ? 'text-positive' : 'text-text2'}`}>
              {row.overRate}%
            </div>
            <div className="text-center text-xs text-text2">{row.hrPerGame}</div>
          </div>
        ))}
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-border bg-card p-3">
          <div className="mb-1 text-[11px] text-muted">3-Year Avg Total</div>
          <div className="mb-0.5 text-lg font-black text-accent">{avgTotal}</div>
          <div className="text-[9px] text-text2">Tonight&apos;s line: {bp.historical[0].avgTotal}</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <div className="mb-1 text-[11px] text-muted">3-Year Over Rate</div>
          <div className="mb-0.5 text-lg font-black text-accent">{avgOver}%</div>
          <div className="text-[9px] text-text2">
            {avgOver >= 52 ? 'Historical data modestly supports the over' : 'Historical data modestly supports the under'}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <div className="mb-1 text-[11px] text-muted">Avg HR/Game</div>
          <div className="mb-0.5 text-lg font-black text-accent">{avgHr}</div>
          <div className="text-[9px] text-text2">Weather tonight may shift this</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <div className="mb-1 text-[11px] text-muted">Games Sampled</div>
          <div className="mb-0.5 text-lg font-black text-accent">{bp.historical.reduce((s, h) => s + h.games, 0)}</div>
          <div className="text-[9px] text-text2">Across {bp.historical.length} seasons</div>
        </div>
      </div>

      <div className="rounded-xl border border-positive/15 bg-positive/[0.06] p-3.5">
        <div className="mb-1.5 text-[9px] font-extrabold tracking-[0.1em] text-positive">HISTORICAL CONTEXT</div>
        <p className="text-[11px] leading-relaxed text-text2">
          {bp.name}&apos;s {avgTotal} average total over the last 3 seasons runs{' '}
          {parseFloat(avgTotal) >= 8.5 ? 'above' : 'near'} typical MLB scoring, with an over rate of {avgOver}%.
          Tonight&apos;s conditions ({bp.weather.condition.toLowerCase()}, {bp.weather.wind.speed}mph{' '}
          {bp.weather.wind.dir.toLowerCase()}) should be weighed against this baseline.
        </p>
      </div>
    </div>
  )
}
