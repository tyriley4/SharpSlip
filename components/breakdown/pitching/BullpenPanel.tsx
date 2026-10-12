import { PlayerLink } from '@/components/players/PlayerLink'
import type { TeamBullpen } from '@/data/breakdown/pitchingTypes'

const STATUS_COLOR: Record<string, string> = {
  rested: 'text-positive',
  used: 'text-warning',
  taxed: 'text-negative',
}

const TREND_ICON: Record<string, string> = { up: '↑', down: '↓', neutral: '→' }
const TREND_COLOR: Record<string, string> = { up: 'text-positive', down: 'text-negative', neutral: 'text-muted' }

export function BullpenPanel({ abbr, bullpen, teamColor }: { abbr: string; bullpen: TeamBullpen; teamColor: string }) {
  const healthColor = bullpen.health >= 75 ? 'bg-positive' : bullpen.health >= 55 ? 'bg-warning' : 'bg-negative'
  const healthText = bullpen.health >= 75 ? 'text-positive' : bullpen.health >= 55 ? 'text-warning' : 'text-negative'

  return (
    <div className="flex flex-col gap-3.5">
      <div className="rounded-2xl border border-border bg-card p-3.5">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-bold text-text">{abbr} Bullpen Health</span>
          <span className={`text-xs font-extrabold ${healthText}`}>{bullpen.status}</span>
        </div>
        <div className="mb-1 h-2 overflow-hidden rounded-full bg-border2">
          <div className={`h-full rounded-full ${healthColor}`} style={{ width: `${bullpen.health}%` }} />
        </div>
        <div className="mb-3 text-right text-[10px] text-muted">{bullpen.health}/100</div>
        <div className="grid grid-cols-4 gap-1.5">
          <div className="rounded-lg bg-card3 py-2 text-center">
            <div className="text-[13px] font-bold text-text">{bullpen.teamStats.era}</div>
            <div className="mt-0.5 text-[8px] text-muted">ERA (#{bullpen.teamStats.eraRank})</div>
          </div>
          <div className="rounded-lg bg-card3 py-2 text-center">
            <div className="text-[13px] font-bold text-text">{bullpen.teamStats.whip}</div>
            <div className="mt-0.5 text-[8px] text-muted">WHIP (#{bullpen.teamStats.whipRank})</div>
          </div>
          <div className="rounded-lg bg-card3 py-2 text-center">
            <div className="text-[13px] font-bold text-text">{bullpen.teamStats.k9}</div>
            <div className="mt-0.5 text-[8px] text-muted">K/9 (#{bullpen.teamStats.k9Rank})</div>
          </div>
          <div className="rounded-lg bg-card3 py-2 text-center">
            <div className="text-[13px] font-bold text-text">{bullpen.teamStats.oppAvg}</div>
            <div className="mt-0.5 text-[8px] text-muted">Opp AVG</div>
          </div>
        </div>
      </div>

      <div>
        <div className="mb-2 text-[9px] font-extrabold tracking-[0.1em] text-muted">RELIEF CORPS</div>
        <div className="flex flex-col gap-2">
          {bullpen.pitchers.map((r) => (
            <div key={r.name} className="rounded-2xl bg-card p-3" style={{ border: `1px solid ${teamColor}33` }}>
              <div className="mb-1.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-card3 px-1.5 py-0.5 text-[9px] font-bold text-text2">{r.role}</span>
                  <PlayerLink name={r.name} className="text-xs font-bold text-text hover:text-accent hover:underline">{r.name}</PlayerLink>
                  <span className="text-[9px] text-muted">{r.hand}</span>
                </div>
                <span className={`text-[9px] font-bold ${STATUS_COLOR[r.status]}`}>{r.status.toUpperCase()}</span>
              </div>
              <div className="mb-1.5 flex items-center gap-3 text-[10px] text-muted">
                <span>{r.lastUsed}</span>
                <span>· {r.rest}</span>
              </div>
              <div className="mb-1.5 grid grid-cols-4 gap-1.5">
                <div className="text-center">
                  <div className="text-[11px] font-bold text-text2">{r.era}</div>
                  <div className="text-[8px] text-muted">ERA</div>
                </div>
                <div className="text-center">
                  <div className="text-[11px] font-bold text-text2">{r.whip}</div>
                  <div className="text-[8px] text-muted">WHIP</div>
                </div>
                <div className="text-center">
                  <div className="text-[11px] font-bold text-text2">{r.k9}</div>
                  <div className="text-[8px] text-muted">K/9</div>
                </div>
                <div className="text-center">
                  <div className="text-[11px] font-bold text-text2">{r.hold}</div>
                  <div className="text-[8px] text-muted">Hold%</div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex gap-1">
                  {r.last5.map((res, i) => (
                    <div
                      key={i}
                      className={`h-[7px] w-[7px] rounded-full ${res === 'W' ? 'bg-positive' : 'bg-negative'}`}
                    />
                  ))}
                </div>
                <span className={`text-[10px] font-bold ${TREND_COLOR[r.trend]}`}>
                  {TREND_ICON[r.trend]} {r.trend}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
