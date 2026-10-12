import { StatBox, StatRow } from '@/components/breakdown/StatBox'
import { PlayerLink } from '@/components/players/PlayerLink'
import { lowIsGoodColor } from '@/lib/breakdown/statColors'
import type { StarterDetail } from '@/data/breakdown/pitchingTypes'

export function StarterOverview({ p, oppAbbr, teamColor }: { p: StarterDetail; oppAbbr: string; teamColor: string }) {
  return (
    <div>
      <div className="mb-3 rounded-2xl bg-card p-3.5" style={{ border: `2px solid ${teamColor}` }}>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base">{p.hot ? '🔥' : '❄️'}</span>
            <div>
              <div className="text-[9px] text-muted">Starting Pitcher</div>
              <PlayerLink name={p.name} className="text-base font-black text-text hover:text-accent hover:underline">
                {p.name}
              </PlayerLink>
            </div>
          </div>
          <div className="text-right">
            <div className="mb-0.5 text-[9px] text-muted">vs {oppAbbr} tonight</div>
            <div className="text-[11px] font-bold text-accent">
              {p.avgIP} avg IP · {p.qsPct} QS%
            </div>
          </div>
        </div>
        <div className="mb-2 grid grid-cols-4 gap-1.5">
          <StatBox label="ERA" val={p.era} good={parseFloat(p.era) < 3.5} />
          <StatBox label="FIP" val={p.fip} good={parseFloat(p.fip) < 3.5} />
          <StatBox label="xFIP" val={p.xfip} good={parseFloat(p.xfip) < 3.5} />
          <StatBox label="SIERA" val={p.siera} good={parseFloat(p.siera) < 3.5} />
        </div>
        <div className="grid grid-cols-5 gap-1.5">
          <StatBox label="K/9" val={p.k9} good={parseFloat(p.k9) > 9} />
          <StatBox label="BB/9" val={p.bb9} good={parseFloat(p.bb9) < 2.5} />
          <StatBox label="WHIP" val={p.whip} good={parseFloat(p.whip) < 1.15} />
          <StatBox label="CSW%" val={p.csw} good={parseFloat(p.csw) > 30} />
          <StatBox label="K-BB%" val={p.kbb} good={parseFloat(p.kbb) > 15} />
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-3.5">
        <div className="mb-2.5 text-[9px] font-extrabold tracking-[0.1em] text-muted">PITCH ARSENAL</div>
        <div className="flex flex-col gap-2">
          {Object.entries(p.arsenal).map(([pitch, pct]) => (
            <div key={pitch} className="flex items-center gap-2">
              <span className="w-9 shrink-0 text-[10px] font-bold text-text2">{pitch}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-border2">
                <div className="h-full rounded-full bg-accent" style={{ width: pct }} />
              </div>
              <span className="w-10 shrink-0 text-right text-[10px] font-semibold text-text2">{pct}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function StarterAdvanced({ p }: { p: StarterDetail }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3.5">
      <div className="mb-2.5 text-[9px] font-extrabold tracking-[0.1em] text-muted">QUALITY OF CONTACT ALLOWED</div>
      <StatRow label="Hard Hit%" value={p.contact.hardHit} />
      <StatRow label="Barrel%" value={p.contact.barrel} />
      <StatRow label="Avg Exit Velo" value={p.contact.exitVelo} />
      <StatRow label="Ground Ball%" value={p.contact.gb} />
      <StatRow label="Strand Rate" value={p.contact.strand} />
    </div>
  )
}

export function StarterSplits({ p }: { p: StarterDetail }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-2xl border border-border bg-card p-3.5">
        <div className="mb-2.5 text-[9px] font-extrabold tracking-[0.1em] text-muted">VS HANDEDNESS</div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-card3 p-2.5 text-center">
            <div className="mb-1 text-[9px] text-muted">vs LHH</div>
            <div className={`text-sm font-bold ${lowIsGoodColor(parseFloat(p.splits.vsLHH.era), 3.5, 4.5)}`}>
              {p.splits.vsLHH.era} ERA
            </div>
            <div className="text-[10px] text-text2">{p.splits.vsLHH.avg} AVG</div>
          </div>
          <div className="rounded-xl bg-card3 p-2.5 text-center">
            <div className="mb-1 text-[9px] text-muted">vs RHH</div>
            <div className={`text-sm font-bold ${lowIsGoodColor(parseFloat(p.splits.vsRHH.era), 3.5, 4.5)}`}>
              {p.splits.vsRHH.era} ERA
            </div>
            <div className="text-[10px] text-text2">{p.splits.vsRHH.avg} AVG</div>
          </div>
        </div>
      </div>
      <div className="rounded-2xl border border-border bg-card p-3.5">
        <div className="mb-2.5 text-[9px] font-extrabold tracking-[0.1em] text-muted">HOME / AWAY</div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-card3 p-2.5 text-center">
            <div className="mb-1 text-[9px] text-muted">Home ERA</div>
            <div className={`text-sm font-bold ${lowIsGoodColor(parseFloat(p.splits.homeEra), 3.5, 4.5)}`}>{p.splits.homeEra}</div>
          </div>
          <div className="rounded-xl bg-card3 p-2.5 text-center">
            <div className="mb-1 text-[9px] text-muted">Away ERA</div>
            <div className={`text-sm font-bold ${lowIsGoodColor(parseFloat(p.splits.awayEra), 3.5, 4.5)}`}>{p.splits.awayEra}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function StarterLast3({ p }: { p: StarterDetail }) {
  const avgK = p.last3.reduce((s, g) => s + g.k, 0) / p.last3.length
  const avgEr = p.last3.reduce((s, g) => s + g.er, 0) / p.last3.length
  const cols = '44px 60px 44px 36px 36px 36px 56px'
  return (
    <div>
      <div className="mb-3 overflow-hidden rounded-2xl border border-border bg-card">
        <div className="border-b border-border px-3.5 py-2 text-[9px] font-extrabold tracking-[0.1em] text-muted">
          RECENT OUTINGS — {p.name.toUpperCase()}
        </div>
        <div className="grid gap-1 border-b border-border bg-card3 px-3.5 py-2" style={{ gridTemplateColumns: cols }}>
          {['OPP', 'DATE', 'IP', 'ER', 'K', 'BB', 'Result'].map((h) => (
            <div key={h} className={`text-[9px] font-bold text-muted ${h === 'Result' ? 'text-center' : 'text-left'}`}>
              {h}
            </div>
          ))}
        </div>
        {p.last3.map((g, i) => (
          <div
            key={i}
            className={`grid items-center gap-1 px-3.5 py-2.5 ${i < p.last3.length - 1 ? 'border-b border-border' : ''}`}
            style={{ gridTemplateColumns: cols }}
          >
            <div className="text-xs font-bold text-text">{g.opp}</div>
            <div className="text-[10px] text-muted">{g.date}</div>
            <div className="text-xs text-text2">{g.ip}</div>
            <div className={`text-xs font-bold ${g.er >= 4 ? 'text-negative' : 'text-text'}`}>{g.er}</div>
            <div className={`text-xs font-bold ${g.k >= 7 ? 'text-positive' : 'text-text2'}`}>{g.k}</div>
            <div className="text-xs text-text2">{g.bb}</div>
            <div className="flex justify-center">
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-md text-[11px] font-extrabold text-white ${
                  g.result === 'W' ? 'bg-positive' : 'bg-negative'
                }`}
              >
                {g.result}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <StatBox label="Avg K/start" val={String(Math.round(avgK * 10) / 10)} good />
        <StatBox label="Avg ER/start" val={String(Math.round(avgEr * 10) / 10)} good={false} />
        <StatBox label="Avg IP" val={p.avgIP} good={parseFloat(p.avgIP) >= 6} />
      </div>
    </div>
  )
}

export function StarterVsLineup({ p }: { p: StarterDetail }) {
  const cols = '2fr 0.8fr 1fr 0.8fr 0.8fr 0.8fr 0.8fr'
  return (
    <div>
      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <div style={{ minWidth: 520 }}>
          <div className="border-b border-border px-3.5 py-2 text-[9px] font-extrabold tracking-[0.1em] text-muted">
            {p.name.toUpperCase()} VS TONIGHT&apos;S LINEUP
          </div>
          <div className="grid gap-1 border-b border-border bg-card3 px-3.5 py-2" style={{ gridTemplateColumns: cols }}>
            {['BATTER', 'POS', 'AVG', 'AB', 'H', 'HR', 'K'].map((h) => (
              <div key={h} className={`text-[9px] font-bold text-muted ${h === 'BATTER' ? 'text-left' : 'text-center'}`}>
                {h}
              </div>
            ))}
          </div>
          {p.vsLineup.map((b, i) => (
            <div
              key={b.name}
              className={`grid items-center gap-1 px-3.5 py-2.5 ${i < p.vsLineup.length - 1 ? 'border-b border-border' : ''}`}
              style={{ gridTemplateColumns: cols }}
            >
              <div className="truncate text-[11px] font-semibold text-text">{b.name}</div>
              <div className="text-center text-[10px] text-muted">{b.pos}</div>
              <div className="text-center text-[11px] font-semibold text-text2">{b.avg}</div>
              <div className="text-center text-[11px] text-text2">{b.ab}</div>
              <div className="text-center text-[11px] text-text2">{b.h}</div>
              <div className={`text-center text-[11px] font-bold ${b.hr > 0 ? 'text-negative' : 'text-text2'}`}>{b.hr}</div>
              <div className={`text-center text-[11px] font-bold ${b.k >= 5 ? 'text-positive' : 'text-text2'}`}>{b.k}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-2.5 rounded-[10px] border border-accent/20 bg-accent/10 p-2.5">
        <div className="mb-1 text-[9px] font-extrabold tracking-[0.1em] text-accent">STAT GUIDE</div>
        <p className="text-[10px] leading-relaxed text-text2">
          Career at-bats vs tonight&apos;s opposing lineup. Small samples — use as context, not a primary signal.
        </p>
      </div>
    </div>
  )
}
