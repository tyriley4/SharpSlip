import { BetTile } from '@/components/breakdown/BetTile'
import type { QBPassingDetail } from '@/data/breakdown/passingTypes'

export function QBBettingPanel({ p }: { p: QBPassingDetail }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3.5">
      <div className="mb-2 text-[9px] font-extrabold tracking-[0.1em] text-muted">YARDAGE PROPS</div>
      <div className="mb-3.5 grid grid-cols-2 gap-1.5">
        <BetTile {...p.bet.passYds} />
        <BetTile {...p.bet.completions} />
      </div>

      <div className="mb-2 text-[9px] font-extrabold tracking-[0.1em] text-muted">TD &amp; INT PROPS</div>
      <div className="grid grid-cols-2 gap-1.5">
        <BetTile {...p.bet.tdOver} />
        <BetTile {...p.bet.interceptions} />
      </div>
    </div>
  )
}
