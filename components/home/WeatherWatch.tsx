import { MatchupLinks } from '@/components/teams/MatchupLinks'
import { CardOverlayLink } from '@/components/ui/CardOverlayLink'
import { sportMeta } from '@/lib/sport/meta'
import type { WeatherWatchCard } from '@/lib/home/weather'
import type { Sport } from '@/lib/sport/SportContext'

function conditionIcon(conditions: string | null, precipConcern: boolean): string {
  if (precipConcern) return '🌧️'
  const c = (conditions ?? '').toLowerCase()
  if (c.includes('snow')) return '❄️'
  if (c.includes('cloud')) return '☁️'
  if (c.includes('clear') || c.includes('sun')) return '☀️'
  return '🌤️'
}

function WeatherCard({ card }: { card: WeatherWatchCard }) {
  const meta = sportMeta(card.sport)
  return (
    <div className="relative block w-[230px] shrink-0 rounded-[14px] border border-border bg-card p-3.5 transition-colors hover:border-border2 md:w-auto">
      <CardOverlayLink href={card.href} label={`${card.matchup} game breakdown`} />
      <div className="pointer-events-none mb-2 flex items-center justify-between">
        <span className="rounded-full px-1.5 py-0.5 text-[9px] font-bold" style={{ background: `${meta.color}22`, color: meta.color }}>
          {meta.icon} {meta.label}
        </span>
        <span className="text-lg">{conditionIcon(card.conditions, card.precipConcern)}</span>
      </div>
      <div className="pointer-events-none mb-0.5 text-[13px] font-bold text-text">
        <MatchupLinks sport={card.sport} matchup={card.matchup} />
      </div>
      <div className="pointer-events-none mb-2 text-[10px] text-muted">{card.venue}</div>
      {card.tempF !== null ? (
        <div className="pointer-events-none mb-2 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-text2">
          <span>{card.tempF.toFixed(0)}°F</span>
          {card.windMph !== null && (
            <span>
              {card.windMph.toFixed(0)} mph{card.windFrom ? ` from ${card.windFrom}` : ''}
              {card.windDirection ? ` · ${card.windDirection === 'cross' ? 'cross' : `blowing ${card.windDirection}`}` : ''}
            </span>
          )}
          {card.precipChancePct !== null && <span>{card.precipChancePct}% precip</span>}
        </div>
      ) : null}
      <div className="pointer-events-none rounded-lg bg-accent/10 px-2.5 py-1.5 text-[10px] font-semibold text-accent">{card.impactNote}</div>
    </div>
  )
}

export function WeatherWatch({ cards, sportFilter }: { cards: WeatherWatchCard[]; sportFilter: Sport | 'all' }) {
  const relevant = sportFilter === 'all' ? cards : cards.filter((c) => c.sport === sportFilter)
  if (relevant.length === 0) return null

  return (
    <div className="flex flex-col gap-3">
      <h2 className="section-header text-sm text-text md:text-base">Weather Watch</h2>
      <div className="flex gap-2.5 overflow-x-auto pb-1 [scrollbar-width:none] md:grid md:grid-cols-2 md:gap-3 md:overflow-visible [&::-webkit-scrollbar]:hidden">
        {relevant.map((card) => (
          <WeatherCard key={`${card.sport}-${card.gameId}`} card={card} />
        ))}
      </div>
    </div>
  )
}
