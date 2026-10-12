import { StatBox, StatRow } from '@/components/breakdown/StatBox'
import { PlayerLink } from '@/components/players/PlayerLink'
import type { QBPassingDetail } from '@/data/breakdown/passingTypes'

export function QBOverview({ p, oppAbbr, teamColor }: { p: QBPassingDetail; oppAbbr: string; teamColor: string }) {
  return (
    <div className="rounded-2xl bg-card p-3.5" style={{ border: `2px solid ${teamColor}` }}>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">{p.hot ? '🔥' : '❄️'}</span>
          <div>
            <div className="text-[9px] text-muted">Quarterback</div>
            <PlayerLink name={p.name} className="text-base font-black text-text hover:text-accent hover:underline">
              {p.name}
            </PlayerLink>
          </div>
        </div>
        <div className="text-right">
          <div className="mb-0.5 text-[9px] text-muted">vs {oppAbbr} tonight</div>
          <div className="text-[11px] font-bold text-accent">{p.overview.rating} Rating</div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        <StatBox label="Pass Yds" val={p.overview.passYds} good={parseFloat(p.overview.passYds) >= 250} />
        <StatBox label="TDs" val={p.overview.td} good={parseInt(p.overview.td) >= 22} />
        <StatBox label="INTs" val={p.overview.int} good={parseInt(p.overview.int) <= 8} />
        <StatBox label="Comp%" val={p.overview.compPct} good={parseFloat(p.overview.compPct) >= 65} />
        <StatBox label="Rating" val={p.overview.rating} good={parseFloat(p.overview.rating) >= 98} />
        <StatBox label="Sacks" val={p.overview.sacks} good={parseInt(p.overview.sacks) <= 24} />
      </div>
    </div>
  )
}

export function QBAdvanced({ p }: { p: QBPassingDetail }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3.5">
      <div className="mb-2.5 text-[9px] font-extrabold tracking-[0.1em] text-muted">ADVANCED PASSING</div>
      <StatRow label="Air Yards/G" value={p.advanced.airYards} />
      <StatRow label="YAC/G" value={p.advanced.yac} />
      <StatRow label="aDOT" value={p.advanced.aDot} />
      <StatRow label="Pressure%" value={p.advanced.pressurePct} />
      <StatRow label="CPOE" value={p.advanced.cpoe} />
      <StatRow label="Bad Throw%" value={p.advanced.badThrowPct} />
    </div>
  )
}

export function QBLast3({ p }: { p: QBPassingDetail }) {
  const avgYds = p.last3.reduce((s, g) => s + g.yds, 0) / p.last3.length
  const avgTd = p.last3.reduce((s, g) => s + g.td, 0) / p.last3.length
  const cols = '44px 60px 52px 44px 32px 32px 52px 56px'
  return (
    <div>
      <div className="mb-3 overflow-x-auto rounded-2xl border border-border bg-card">
        <div style={{ minWidth: 480 }}>
          <div className="border-b border-border px-3.5 py-2 text-[9px] font-extrabold tracking-[0.1em] text-muted">
            RECENT GAMES — {p.name.toUpperCase()}
          </div>
          <div className="grid gap-1 border-b border-border bg-card3 px-3.5 py-2" style={{ gridTemplateColumns: cols }}>
            {['OPP', 'DATE', 'COMP', 'YDS', 'TD', 'INT', 'RATING', 'Result'].map((h) => (
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
              <div className="text-xs text-text2">{g.comp}</div>
              <div className="text-xs font-semibold text-text">{g.yds}</div>
              <div className={`text-xs font-bold ${g.td >= 2 ? 'text-positive' : 'text-text2'}`}>{g.td}</div>
              <div className={`text-xs font-bold ${g.int >= 2 ? 'text-negative' : 'text-text2'}`}>{g.int}</div>
              <div className="text-xs text-text2">{g.rating}</div>
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
      </div>
      <div className="grid grid-cols-2 gap-2">
        <StatBox label="Avg Pass Yds" val={String(Math.round(avgYds))} good={avgYds >= 250} />
        <StatBox label="Avg Pass TD" val={String(Math.round(avgTd * 10) / 10)} good={avgTd >= 1.5} />
      </div>
    </div>
  )
}
