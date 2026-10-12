import { FieldDiagram } from '@/components/breakdown/ballpark/FieldDiagram'
import type { BallparkData } from '@/data/breakdown/ballparkTypes'

export function StadiumSection({ bp }: { bp: BallparkData }) {
  const w = bp.weather
  const windColor = w.wind.dir === 'IN' ? 'text-cold' : 'text-hot'
  const windBorder = w.wind.dir === 'IN' ? 'border-cold/20' : 'border-hot/20'
  const windBg = w.wind.dir === 'IN' ? 'bg-cold/[0.06]' : 'bg-hot/[0.06]'

  return (
    <div>
      <div className={`mb-3.5 rounded-2xl border p-3.5 ${windBorder} ${windBg}`}>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-3xl">{w.icon}</span>
            <div>
              <div className="text-xl font-black text-text">{w.temp}°F</div>
              <div className="text-[10px] text-text2">{w.condition}</div>
            </div>
          </div>
          <div className="rounded-[10px] border border-white/10 bg-black/20 px-3.5 py-2 text-center">
            <div className={`text-lg font-black ${windColor}`}>{w.wind.speed} mph</div>
            <div className={`text-[9px] font-extrabold ${windColor}`}>
              {w.wind.dir === 'IN' ? '⬇ BLOWING IN' : '⬆ BLOWING OUT'}
            </div>
            <div className="mt-0.5 text-[8px] text-muted">{w.wind.dirFull}</div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <div className="rounded-lg bg-black/20 py-1.5 text-center">
            <div className="text-xs font-bold text-text">{w.humidity}%</div>
            <div className="text-[8px] text-muted">Humidity</div>
          </div>
          <div className="rounded-lg bg-black/20 py-1.5 text-center">
            <div className="text-xs font-bold text-text">{w.dewPoint}°F</div>
            <div className="text-[8px] text-muted">Dew Point</div>
          </div>
          <div className="rounded-lg bg-black/20 py-1.5 text-center">
            <div className="text-xs font-bold text-text">{w.visibility} mi</div>
            <div className="text-[8px] text-muted">Visibility</div>
          </div>
        </div>
      </div>

      <div className="mb-2 text-[9px] font-extrabold tracking-[0.1em] text-muted">
        PARK FACTORS (100 = league avg)
      </div>
      <div className="mb-3.5 grid grid-cols-3 gap-2">
        {Object.values(bp.factors).map((f) => {
          const diff = f.val - 100
          const valColor = diff > 5 ? (f.good ? 'text-positive' : 'text-negative') : diff < -5 ? (f.good ? 'text-negative' : 'text-positive') : 'text-text2'
          return (
            <div key={f.label} className="rounded-xl border border-border bg-card p-2.5 text-center">
              <div className="mb-1 text-base">{f.icon}</div>
              <div className={`mb-0.5 text-lg font-black ${valColor}`}>{f.val}</div>
              <div className="mb-1 text-[9px] font-semibold text-text2">{f.label}</div>
              <div className={`text-[9px] font-bold ${diff > 0 ? 'text-positive' : diff < 0 ? 'text-negative' : 'text-muted'}`}>
                {diff > 0 ? '+' : ''}
                {diff}%
              </div>
            </div>
          )
        })}
      </div>

      <div className="mb-2 text-[9px] font-extrabold tracking-[0.1em] text-muted">FIELD DIMENSIONS</div>
      <div className="mb-3.5 rounded-2xl border border-border bg-card p-3.5">
        <div className="mb-3">
          <FieldDiagram dimensions={bp.dimensions} />
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {bp.dimensions.map((d) => (
            <div key={d.label} className="flex items-center justify-between rounded-lg bg-card3 px-2.5 py-1.5">
              <span className="text-[10px] text-text2">{d.loc}</span>
              <span className={`text-[11px] font-bold ${d.short ? 'text-warning' : 'text-text'}`}>{d.dist}ft</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
