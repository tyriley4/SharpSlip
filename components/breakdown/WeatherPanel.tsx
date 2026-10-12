import type { ImpactNote, WeatherStatus } from '@/lib/weather/api'

export interface WeatherPanelData {
  status: WeatherStatus
  reason?: string
  tempF: number | null
  feelsLikeF: number | null
  windMph: number | null
  windFrom: string | null
  windDirection?: 'out' | 'in' | 'cross' | null
  conditions: string | null
  humidityPct: number | null
  precipChancePct: number | null
  notes: ImpactNote[]
}

const TONE: Record<ImpactNote['tone'], string> = {
  over: 'border-win/30 bg-win/[0.07] text-win',
  under: 'border-cold/30 bg-cold/[0.07] text-cold',
  caution: 'border-warning/30 bg-warning/[0.07] text-warning',
}

const WIND_LABEL = { out: 'blowing out', in: 'blowing in', cross: 'crosswind' } as const

function Stat({ value, label, capitalize = false }: { value: React.ReactNode; label: string; capitalize?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 text-center">
      <div className={`text-sm font-black text-text ${capitalize ? 'capitalize' : ''}`}>{value}</div>
      <div className="text-[9px] text-muted">{label}</div>
    </div>
  )
}

/** Weather block shared by the MLB Ballpark and NFL Stadium tabs. Always renders something — never an error. */
export function WeatherPanel({ weather, indoor = false, indoorLabel }: { weather: WeatherPanelData; indoor?: boolean; indoorLabel?: string }) {
  if (indoor) {
    return <div className="rounded-2xl border border-border bg-card p-4 text-center text-xs text-muted">{indoorLabel ?? 'Indoor — weather neutral.'}</div>
  }
  if (weather.status === 'activating') {
    return (
      <div className="rounded-2xl border border-accent/25 bg-accent/[0.06] p-4 text-center text-xs text-text2" role="status">
        {weather.reason ?? 'Weather data activating — check back shortly'}
      </div>
    )
  }
  if (weather.status !== 'ok') {
    return <div className="rounded-2xl border border-border bg-card p-4 text-center text-xs text-muted">{weather.reason ?? 'Weather temporarily unavailable.'}</div>
  }
  const wind =
    weather.windMph === null
      ? '—'
      : `${weather.windMph.toFixed(0)} mph${weather.windFrom ? ` from ${weather.windFrom}` : ''}`
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-1.5 md:grid-cols-5">
        <Stat value={weather.tempF !== null ? `${weather.tempF.toFixed(0)}°F` : '—'} label={weather.feelsLikeF !== null ? `Temp · feels ${weather.feelsLikeF.toFixed(0)}°` : 'Temp'} />
        <Stat value={wind} label={weather.windDirection ? `Wind · ${WIND_LABEL[weather.windDirection]}` : 'Wind'} />
        <Stat value={weather.conditions ?? '—'} label="Conditions" capitalize />
        <Stat value={weather.precipChancePct !== null ? `${weather.precipChancePct}%` : '—'} label="Chance of rain/snow" />
        <Stat value={weather.humidityPct !== null ? `${weather.humidityPct}%` : '—'} label="Humidity" />
      </div>
      {weather.notes.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {weather.notes.map((n) => (
            <div key={n.text} className={`rounded-xl border px-3 py-2 text-[11px] font-semibold ${TONE[n.tone]}`}>
              {n.text}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
