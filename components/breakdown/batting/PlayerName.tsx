import { PlayerLink } from '@/components/players/PlayerLink'
import type { BatterStats } from '@/data/breakdown/battingTypes'

export function PlayerName({ p }: { p: BatterStats }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1">
        {p.hot && <span className="text-[9px]">🔥</span>}
        {p.cold && <span className="text-[9px]">❄️</span>}
        <PlayerLink name={p.name} className="truncate text-[11px] font-semibold text-text hover:text-accent hover:underline">
          {p.name}
        </PlayerLink>
      </div>
      <div className="text-[9px] text-muted">
        {p.pos} · {p.bats}HH
      </div>
    </div>
  )
}
