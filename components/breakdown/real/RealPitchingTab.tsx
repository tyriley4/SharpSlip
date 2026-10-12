'use client'

import { useEffect, useState } from 'react'
import { PlayerLink } from '@/components/players/PlayerLink'
import { PillTabs, SegmentTabs } from '@/components/ui/PillTabs'
import { MLB_TEAM_COLORS } from '@/data/mlb/teamColors'
import type { PitchingTabData } from '@/lib/mlb/pitchingBreakdown'

const STARTER_SUB_TABS = ['Overview', 'Advanced', 'Last 5 Starts', 'vs Lineup']

function erColor(er: number): string {
  if (er <= 1) return 'text-positive'
  if (er <= 3) return 'text-warning'
  return 'text-negative'
}

function restColor(days: number | null): string {
  if (days === null) return 'text-muted'
  if (days >= 2) return 'text-positive'
  if (days === 1) return 'text-warning'
  return 'text-negative'
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function StatChip({ label, val }: { label: string; val: string }) {
  return (
    <div className="rounded-[10px] border border-border bg-card3 p-2 text-center">
      <div className="mb-0.5 text-[9px] text-muted">{label}</div>
      <div className="text-[13px] font-black text-text">{val}</div>
    </div>
  )
}

function ThresholdRow({ label, rows }: { label: string; rows: { threshold: number; hitRate: number; wins: number; losses: number }[] }) {
  return (
    <div className="mb-3">
      <div className="mb-1.5 text-[9px] font-bold uppercase tracking-wide text-muted">{label}</div>
      <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {rows.map((r) => {
          const tone = r.hitRate >= 65 ? 'text-positive' : r.hitRate < 45 ? 'text-negative' : 'text-text2'
          return (
            <div key={r.threshold} className="shrink-0 rounded-xl border border-border bg-card3 p-2 text-center" style={{ minWidth: 68 }}>
              <div className="text-[10px] font-bold text-muted">{r.threshold}+</div>
              <div className={`text-sm font-black ${tone}`}>{r.hitRate}%</div>
              <div className="text-[9px] text-muted">
                {r.wins}-{r.losses}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function RealPitchingTab({ gamePk, awayAbbr, homeAbbr }: { gamePk: number; awayAbbr: string; homeAbbr: string }) {
  const [team, setTeam] = useState<'away' | 'home'>('away')
  const [group, setGroup] = useState<'Starters' | 'Bullpen'>('Starters')
  const [view, setView] = useState<'Game Stats' | 'Betting Stats'>('Game Stats')
  const [starterSubTab, setStarterSubTab] = useState('Overview')

  const [cache, setCache] = useState<Record<string, PitchingTabData>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  const cacheKey = team
  const data = cache[cacheKey]

  useEffect(() => {
    if (cache[cacheKey]) return
    let cancelled = false
    setLoading(true)
    setError(false)

    fetch(`/api/breakdown/pitching?gamePk=${gamePk}&team=${team}`)
      .then((res) => {
        if (!res.ok) throw new Error(`status ${res.status}`)
        return res.json()
      })
      .then((json: PitchingTabData) => {
        if (cancelled) return
        setCache((prev) => ({ ...prev, [cacheKey]: json }))
      })
      .catch((err) => {
        console.error('[RealPitchingTab] fetch failed', err)
        if (!cancelled) setError(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, gamePk, team])

  const abbr = team === 'away' ? awayAbbr : homeAbbr

  return (
    <div className="flex flex-col gap-3 px-3.5 pt-3 md:px-8 md:pt-5">
      <div className="grid grid-cols-2 gap-1.5">
        {(['away', 'home'] as const).map((side) => {
          const sideAbbr = side === 'away' ? awayAbbr : homeAbbr
          const active = team === side
          const tc = MLB_TEAM_COLORS[sideAbbr] ?? '#4d9fff'
          return (
            <button
              key={side}
              onClick={() => setTeam(side)}
              className={`rounded-xl border-2 py-2.5 text-center text-[13px] font-bold ${active ? '' : 'border-border text-text2'}`}
              style={active ? { borderColor: tc, background: `${tc}22`, color: tc } : undefined}
            >
              ⚾ {sideAbbr}
            </button>
          )
        })}
      </div>

      <SegmentTabs options={['Starters', 'Bullpen']} active={group} onChange={(v) => setGroup(v as 'Starters' | 'Bullpen')} />
      <SegmentTabs options={['Game Stats', 'Betting Stats']} active={view} onChange={(v) => setView(v as 'Game Stats' | 'Betting Stats')} />

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-card py-14 text-xs text-muted">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-muted border-t-accent" />
          Loading {abbr} pitching…
        </div>
      ) : error || !data ? (
        <div className="rounded-2xl border border-border bg-card py-10 text-center text-xs text-muted">Pitching data unavailable.</div>
      ) : group === 'Starters' ? (
        view === 'Game Stats' ? (
          <StartersGameStats data={data} subTab={starterSubTab} setSubTab={setStarterSubTab} abbr={abbr} />
        ) : (
          <StartersBettingStats data={data} />
        )
      ) : view === 'Game Stats' ? (
        <BullpenGameStats arms={data.bullpenArms} />
      ) : (
        <BullpenBettingStats data={data} abbr={abbr} />
      )}
    </div>
  )
}

function StartersGameStats({
  data,
  subTab,
  setSubTab,
  abbr,
}: {
  data: PitchingTabData
  subTab: string
  setSubTab: (v: string) => void
  abbr: string
}) {
  if (!data.starter) {
    return <div className="rounded-2xl border border-border bg-card py-10 text-center text-xs text-muted">No probable starter announced for {abbr} yet.</div>
  }
  const s = data.starter

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-2xl border border-border bg-card p-3.5">
        <div className="mb-1 flex items-center gap-2">
          <PlayerLink name={s.name} team={s.team} className="text-sm font-black text-text hover:text-accent hover:underline">
            {s.name}
          </PlayerLink>
          <span className="rounded-md bg-card3 px-1.5 py-0.5 text-[9px] font-bold text-muted">{s.handedness}HP</span>
          <span className="text-[10px] text-muted">
            {s.wins}-{s.losses}
          </span>
        </div>
      </div>

      <PillTabs options={STARTER_SUB_TABS} active={subTab} onChange={setSubTab} />

      {subTab === 'Overview' && (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-3 gap-1.5 md:grid-cols-6">
            <StatChip label="ERA" val={s.era.toFixed(2)} />
            <StatChip label="FIP" val={s.fip.toFixed(2)} />
            <StatChip label="WHIP" val={s.whip.toFixed(2)} />
            <StatChip label="K/9" val={s.k9.toFixed(1)} />
            <StatChip label="BB/9" val={s.bb9.toFixed(1)} />
            <StatChip label="K%" val={`${s.kPct}%`} />
          </div>
          <div className="rounded-xl border border-border bg-card p-3">
            <div className="mb-1.5 text-[9px] font-bold uppercase tracking-wide text-muted">AVG Against</div>
            <div className="text-sm font-black text-text">{s.avgAgainst}</div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-border bg-card p-3">
              <div className="mb-1 text-[9px] font-bold uppercase tracking-wide text-muted">Home / Away ERA</div>
              <div className="text-sm font-bold text-text">
                {s.homeEra?.toFixed(2) ?? '—'} / {s.awayEra?.toFixed(2) ?? '—'}
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-3">
              <div className="mb-1 text-[9px] font-bold uppercase tracking-wide text-muted">AVG vs L / vs R</div>
              <div className="text-sm font-bold text-text">
                {s.avgVsLeft ?? '—'} / {s.avgVsRight ?? '—'}
              </div>
            </div>
          </div>
        </div>
      )}

      {subTab === 'Advanced' && (
        <div className="flex flex-col gap-3">
          {!data.advanced ? (
            <div className="rounded-2xl border border-border bg-card py-8 text-center text-xs text-muted">Advanced data unavailable.</div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-1.5">
                <StatChip label="FIP" val={data.advanced.fip?.toFixed(2) ?? '—'} />
                <StatChip label="xFIP" val={data.advanced.xfip?.toFixed(2) ?? '—'} />
                <StatChip label="WAR" val={data.advanced.war?.toFixed(1) ?? '—'} />
              </div>
              <div>
                <div className="mb-1.5 text-[9px] font-bold uppercase tracking-wide text-muted">Pitch Mix</div>
                {data.advanced.pitchMix.length === 0 ? (
                  <div className="rounded-xl border border-border bg-card p-4 text-center text-[11px] text-muted">No Statcast pitch data yet this season.</div>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {data.advanced.pitchMix.map((p) => (
                      <div key={p.code} className="flex items-center gap-2 rounded-xl border border-border bg-card p-2.5">
                        <span className="w-24 shrink-0 text-[11px] font-semibold text-text">{p.label}</span>
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-border2">
                          <div className="h-full rounded-full bg-accent" style={{ width: `${p.pct}%` }} />
                        </div>
                        <span className="w-10 shrink-0 text-right text-[11px] font-bold text-text">{p.pct}%</span>
                        <span className="w-14 shrink-0 text-right text-[10px] text-muted">{p.avgVelo} mph</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <p className="text-[10px] leading-relaxed text-muted">
                Ground ball%/fly ball%/line drive% and per-pitch whiff rate aren&apos;t exposed by the free MLB Stats API, so they&apos;re
                omitted here rather than estimated.
              </p>
            </>
          )}
        </div>
      )}

      {subTab === 'Last 5 Starts' && (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="grid grid-cols-7 gap-1 border-b border-border bg-card3 px-2.5 py-2 text-[9px] font-bold text-muted">
            <span>DATE</span>
            <span>OPP</span>
            <span className="text-center">IP</span>
            <span className="text-center">H</span>
            <span className="text-center">ER</span>
            <span className="text-center">BB</span>
            <span className="text-center">K</span>
          </div>
          {data.last5.map((g, i) => (
            <div key={i} className={`grid grid-cols-7 gap-1 px-2.5 py-2 text-[11px] ${i < data.last5.length - 1 ? 'border-b border-border' : ''}`}>
              <span className="text-text2">{shortDate(g.date)}</span>
              <span className="text-text2">{g.opp}</span>
              <span className="text-center text-text">{g.ip}</span>
              <span className="text-center text-text">{g.h}</span>
              <span className={`text-center font-bold ${erColor(g.er)}`}>{g.er}</span>
              <span className="text-center text-text">{g.bb}</span>
              <span className="text-center text-text">{g.k}</span>
            </div>
          ))}
        </div>
      )}

      {subTab === 'vs Lineup' && (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          {data.vsLineup.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted">Lineup not posted yet.</div>
          ) : (
            <>
              <div className="grid grid-cols-5 gap-1 border-b border-border bg-card3 px-2.5 py-2 text-[9px] font-bold text-muted">
                <span>#</span>
                <span className="col-span-2">BATTER</span>
                <span className="text-center">AVG</span>
                <span className="text-center">OBP/SLG</span>
              </div>
              {data.vsLineup.map((r, i) => (
                <div key={r.order} className={`grid grid-cols-5 items-center gap-1 px-2.5 py-2 text-[11px] ${i < data.vsLineup.length - 1 ? 'border-b border-border' : ''}`}>
                  <span className="text-muted">{r.order}</span>
                  <PlayerLink name={r.name} className="col-span-2 truncate font-semibold text-text hover:text-accent hover:underline">
                    {r.name}
                  </PlayerLink>
                  <span className="text-center font-semibold text-text">{r.avg}</span>
                  <span className="text-center text-text2">
                    {r.obp}/{r.slg}
                  </span>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function StartersBettingStats({ data }: { data: PitchingTabData }) {
  if (!data.starterBetting || !data.starter) {
    return <div className="rounded-2xl border border-border bg-card py-10 text-center text-xs text-muted">Betting stats unavailable.</div>
  }
  const b = data.starterBetting

  return (
    <div className="flex flex-col gap-1">
      <div className="mb-2 rounded-xl border border-accent/25 bg-accent/[0.06] p-3">
        <div className="mb-1 text-[9px] font-bold uppercase tracking-wide text-accent">NRFI Rate</div>
        <div className="text-lg font-black text-text">
          <PlayerLink name={data.starter.name} className="hover:text-accent hover:underline">{data.starter.name}</PlayerLink>: {data.nrfi.thisStarter.rate}%{' '}
          <span className="text-[11px] font-normal text-muted">({data.nrfi.thisStarter.sample} starts)</span>
        </div>
        {data.nrfi.combined !== null && (
          <div className="mt-1 text-[11px] text-text2">Combined (both starters): {data.nrfi.combined}%</div>
        )}
      </div>

      <ThresholdRow label={`Strikeouts (${b.gamesPlayed}G sample)`} rows={b.strikeouts} />
      <ThresholdRow label="Outs Recorded" rows={b.outs} />
      <ThresholdRow label="Hits Allowed" rows={b.hitsAllowed} />
      <ThresholdRow label="Earned Runs" rows={b.earnedRuns} />
    </div>
  )
}

function BullpenGameStats({ arms }: { arms: PitchingTabData['bullpenArms'] }) {
  if (arms.length === 0) {
    return <div className="rounded-2xl border border-border bg-card py-10 text-center text-xs text-muted">No bullpen data available.</div>
  }
  return (
    <div className="flex flex-col gap-2">
      {arms.map((a) => (
        <div key={a.id} className="rounded-xl border border-border bg-card p-3">
          <div className="mb-1.5 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <PlayerLink name={a.name} className="text-[12px] font-bold text-text hover:text-accent hover:underline">
                {a.name}
              </PlayerLink>
              <span className="rounded-md bg-card3 px-1.5 py-0.5 text-[9px] font-bold text-muted">{a.handedness}HP</span>
            </div>
            <span className="rounded-full border border-accent/40 bg-accent/15 px-2 py-0.5 text-[9px] font-bold text-accent">{a.role}</span>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            <StatChip label="ERA" val={a.era.toFixed(2)} />
            <StatChip label="WHIP" val={a.whip.toFixed(2)} />
            <StatChip label="K/9" val={a.k9.toFixed(1)} />
            <StatChip label="APP" val={String(a.appearances)} />
          </div>
          <div className="mt-2 flex items-center justify-between text-[10px]">
            <span className={`font-bold ${restColor(a.daysRest)}`}>
              {a.daysRest === null ? 'No recent outing' : a.daysRest === 0 ? 'Pitched yesterday/today' : `${a.daysRest}d rest`}
            </span>
            <span className="text-muted">
              Last: {a.lastOutingDate ? shortDate(a.lastOutingDate) : '—'} {a.lastOutingIp ? `(${a.lastOutingIp} IP)` : ''}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

function BullpenBettingStats({ data, abbr }: { data: PitchingTabData; abbr: string }) {
  const b = data.bullpenBetting
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2">
        <StatChip label={`${abbr} Bullpen ERA (Season)`} val={b.seasonEra?.toFixed(2) ?? '—'} />
        <StatChip label="Bullpen ERA (Last 7 Days)" val={b.last7Era?.toFixed(2) ?? '—'} />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <StatChip label="Blown Saves" val={String(b.blownSaves)} />
        <StatChip label="Save %" val={b.savePct !== null ? `${b.savePct}%` : '—'} />
        <StatChip label="Hold %" val={b.holdPct !== null ? `${b.holdPct}%` : '—'} />
      </div>
    </div>
  )
}
