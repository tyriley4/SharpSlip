import { BetTile } from '@/components/breakdown/BetTile'
import type { StarterDetail } from '@/data/breakdown/pitchingTypes'

export function StarterBettingPanel({ p }: { p: StarterDetail }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3.5">
      <div className="mb-2 text-[9px] font-extrabold tracking-[0.1em] text-muted">STRIKEOUT PROPS</div>
      <div className="mb-3.5 grid grid-cols-2 gap-1.5">
        <BetTile rec={p.bet.kOver.rec} pct={p.bet.kOver.pct} label={p.bet.kOver.line} />
        <BetTile rec={p.bet.kUnder.rec} pct={p.bet.kUnder.pct} label={p.bet.kUnder.line} />
      </div>

      <div className="mb-2 text-[9px] font-extrabold tracking-[0.1em] text-muted">WIN &amp; DURABILITY PROPS</div>
      <div className="grid grid-cols-2 gap-1.5">
        <BetTile rec={p.bet.win.rec} pct={p.bet.win.pct} label={p.bet.win.line} />
        <BetTile rec={p.bet.outs.rec} pct={p.bet.outs.pct} label={p.bet.outs.line} />
      </div>

      <div className="mb-2 mt-3.5 text-[9px] font-extrabold tracking-[0.1em] text-muted">NRFI</div>
      <div className="grid grid-cols-1">
        <BetTile rec={p.bet.nrfi.rec} pct={p.bet.nrfi.pct} label={p.bet.nrfi.line} />
      </div>
    </div>
  )
}
