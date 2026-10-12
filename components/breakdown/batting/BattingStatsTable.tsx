import { PlayerName } from '@/components/breakdown/batting/PlayerName'
import { avgColor, hardColor, lowIsGoodColor, highIsGoodColor, opsColor, wrcColor } from '@/lib/breakdown/statColors'
import type { BatterStats } from '@/data/breakdown/battingTypes'

function TableHeader({ cols, headers }: { cols: string; headers: string[] }) {
  return (
    <div className="grid gap-1 border-b border-border bg-card3 px-2.5 py-2" style={{ gridTemplateColumns: cols }}>
      {headers.map((h) => (
        <div key={h} className={`text-[9px] font-bold text-muted ${h === 'BATTER' ? 'text-left' : 'text-center'}`}>
          {h}
        </div>
      ))}
    </div>
  )
}

function StatGuide({ text }: { text: string }) {
  return (
    <div className="mt-2.5 rounded-[10px] border border-accent/20 bg-accent/10 p-2.5">
      <div className="mb-1 text-[9px] font-extrabold tracking-[0.1em] text-accent">STAT GUIDE</div>
      <p className="text-[10px] leading-relaxed text-text2">{text}</p>
    </div>
  )
}

export function BattingStandardTable({ lineup }: { lineup: BatterStats[] }) {
  const cols = '2fr 1fr 1fr 1fr 1fr 0.8fr 0.8fr 0.8fr'
  return (
    <div>
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <div style={{ minWidth: 560 }}>
          <TableHeader cols={cols} headers={['BATTER', 'AVG', 'OBP', 'SLG', 'OPS', 'HR', 'RBI', 'K%']} />
          {lineup.map((p, i) => (
            <div
              key={p.name}
              className={`grid items-center gap-1 px-2.5 py-2 ${i < lineup.length - 1 ? 'border-b border-border' : ''}`}
              style={{ gridTemplateColumns: cols }}
            >
              <PlayerName p={p} />
              <div className={`text-center text-[11px] font-semibold ${avgColor(p.std.avg)}`}>{p.std.avg}</div>
              <div className="text-center text-[11px] text-text2">{p.std.obp}</div>
              <div className="text-center text-[11px] text-text2">{p.std.slg}</div>
              <div className={`text-center text-[11px] font-semibold ${opsColor(p.std.ops)}`}>{p.std.ops}</div>
              <div className="text-center text-[11px] font-semibold text-text">{p.std.hr}</div>
              <div className="text-center text-[11px] font-semibold text-text">{p.std.rbi}</div>
              <div className={`text-center text-[11px] font-semibold ${lowIsGoodColor(p.adv.kpct, 18, 26)}`}>{p.adv.kpct}%</div>
            </div>
          ))}
        </div>
      </div>
      <StatGuide text="AVG .300+ elite · OPS .850+ strong · .680 or below weak · Green = above avg · Red = below avg" />
    </div>
  )
}

export function BattingAdvancedTable({ lineup }: { lineup: BatterStats[] }) {
  const contactCols = '2fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr'
  const disciplineCols = '2fr 1fr 1fr 1fr 1fr'
  return (
    <div>
      <div className="mb-2 text-[9px] font-bold tracking-[0.1em] text-muted">QUALITY OF CONTACT</div>
      <div className="mb-3.5 overflow-x-auto rounded-xl border border-border bg-card">
        <div style={{ minWidth: 620 }}>
          <TableHeader cols={contactCols} headers={['BATTER', 'wOBA', 'wRC+', 'xBA', 'xSLG', 'Hard%', 'Barrel%', 'Sprint']} />
          {lineup.map((p, i) => (
            <div
              key={p.name}
              className={`grid items-center gap-1 px-2.5 py-2 ${i < lineup.length - 1 ? 'border-b border-border' : ''}`}
              style={{ gridTemplateColumns: contactCols }}
            >
              <PlayerName p={p} />
              <div className={`text-center text-[11px] font-semibold ${opsColor(p.adv.woba)}`}>{p.adv.woba}</div>
              <div className={`text-center text-[11px] font-bold ${wrcColor(p.adv.wrc)}`}>{p.adv.wrc}</div>
              <div className={`text-center text-[11px] ${avgColor(p.adv.xba)}`}>{p.adv.xba}</div>
              <div className="text-center text-[11px] text-text2">{p.adv.xslg}</div>
              <div className={`text-center text-[11px] font-semibold ${hardColor(p.adv.hard)}`}>{p.adv.hard}%</div>
              <div className={`text-center text-[11px] font-semibold ${p.adv.barrel >= 8 ? 'text-positive' : p.adv.barrel <= 4 ? 'text-negative' : 'text-text2'}`}>
                {p.adv.barrel}%
              </div>
              <div className="text-center text-[11px] text-text2">{p.adv.sprintSpeed}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-2 text-[9px] font-bold tracking-[0.1em] text-muted">PLATE DISCIPLINE</div>
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <TableHeader cols={disciplineCols} headers={['BATTER', 'K%', 'BB%', 'Chase%', 'Whiff%']} />
        {lineup.map((p, i) => (
          <div
            key={p.name}
            className={`grid items-center gap-1 px-2.5 py-2 ${i < lineup.length - 1 ? 'border-b border-border' : ''}`}
            style={{ gridTemplateColumns: disciplineCols }}
          >
            <PlayerName p={p} />
            <div className={`text-center text-[11px] font-semibold ${lowIsGoodColor(p.adv.kpct, 18, 26)}`}>{p.adv.kpct}%</div>
            <div className={`text-center text-[11px] font-semibold ${highIsGoodColor(p.adv.bbpct, 10, 6)}`}>{p.adv.bbpct}%</div>
            <div className={`text-center text-[11px] font-semibold ${lowIsGoodColor(p.adv.chase, 24, 34)}`}>{p.adv.chase}%</div>
            <div className={`text-center text-[11px] font-semibold ${lowIsGoodColor(p.adv.whiff, 20, 30)}`}>{p.adv.whiff}%</div>
          </div>
        ))}
      </div>
      <StatGuide text="wRC+ 100 = avg · Hard Hit% 45%+ = elite · Chase% lower = better · Whiff% lower = better · K% 15% or below = elite contact" />
    </div>
  )
}

export function BattingSplitsTable({ lineup }: { lineup: BatterStats[] }) {
  const cols = '2fr 1fr 1fr 1fr 1fr 1fr 1fr'
  return (
    <div>
      <div className="mb-2 text-[9px] font-bold tracking-[0.1em] text-muted">
        HANDEDNESS SPLITS (VS LHP / VS RHP)
      </div>
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <div style={{ minWidth: 480 }}>
          <TableHeader cols={cols} headers={['BATTER', 'vsL AVG', 'vsL OPS', 'vsR AVG', 'vsR OPS', 'Home OPS', 'Away OPS']} />
          {lineup.map((p, i) => (
            <div
              key={p.name}
              className={`grid items-center gap-1 px-2.5 py-2 ${i < lineup.length - 1 ? 'border-b border-border' : ''}`}
              style={{ gridTemplateColumns: cols }}
            >
              <PlayerName p={p} />
              <div className={`text-center text-[11px] ${avgColor(p.splits.vslAvg)}`}>{p.splits.vslAvg}</div>
              <div className={`text-center text-[11px] font-semibold ${opsColor(p.splits.vslOps)}`}>{p.splits.vslOps}</div>
              <div className={`text-center text-[11px] ${avgColor(p.splits.vsrAvg)}`}>{p.splits.vsrAvg}</div>
              <div className={`text-center text-[11px] font-semibold ${opsColor(p.splits.vsrOps)}`}>{p.splits.vsrOps}</div>
              <div className={`text-center text-[11px] font-semibold ${opsColor(p.splits.homeOps)}`}>{p.splits.homeOps}</div>
              <div className={`text-center text-[11px] font-semibold ${opsColor(p.splits.awayOps)}`}>{p.splits.awayOps}</div>
            </div>
          ))}
        </div>
      </div>
      <StatGuide text="vs RHP splits are most relevant for tonight's matchup. Home/Away OPS shows venue-driven performance shifts." />
    </div>
  )
}

export function BattingHotColdTable({ lineup }: { lineup: BatterStats[] }) {
  const cols = '2fr 1fr 1fr 1fr 1fr 1fr'
  return (
    <div>
      <div className="mb-2 text-[9px] font-bold tracking-[0.1em] text-muted">LAST 7 / LAST 14 DAYS</div>
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <TableHeader cols={cols} headers={['BATTER', 'L7 AVG', 'L7 HR', 'L7 RBI', 'L14 AVG', 'L14 HR']} />
        {lineup.map((p, i) => (
          <div
            key={p.name}
            className={`grid items-center gap-1 px-2.5 py-2 ${i < lineup.length - 1 ? 'border-b border-border' : ''}`}
            style={{ gridTemplateColumns: cols }}
          >
            <PlayerName p={p} />
            <div className={`text-center text-[11px] font-semibold ${avgColor(p.hotcold.l7avg)}`}>{p.hotcold.l7avg}</div>
            <div className="text-center text-[11px] font-semibold text-text">{p.hotcold.l7hr}</div>
            <div className="text-center text-[11px] font-semibold text-text">{p.hotcold.l7rbi}</div>
            <div className={`text-center text-[11px] ${avgColor(p.hotcold.l14avg)}`}>{p.hotcold.l14avg}</div>
            <div className="text-center text-[11px] text-text2">{p.hotcold.l14hr}</div>
          </div>
        ))}
      </div>
      <StatGuide text="🔥 = hitting well above season averages over the trailing window · ❄️ = cooling off vs season norms" />
    </div>
  )
}
