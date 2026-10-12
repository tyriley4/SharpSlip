'use client'

import { useEffect, useState } from 'react'
import type { CbbArenaData, CbbBettingLine, CbbDefenseData, CbbScoringData, CbbSummaryCard, CbbSummaryData } from '@/lib/cbb/tabs'

const API = '/api/cbb-breakdown'

function useTabData<T>(tab: string, gameId: string) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(false)
    fetch(`${API}/${tab}?gameId=${encodeURIComponent(gameId)}`)
      .then((r) => {
        if (!r.ok) throw new Error(`status ${r.status}`)
        return r.json()
      })
      .then((j: T) => !cancelled && setData(j))
      .catch((err) => {
        console.error(`[RealCBB ${tab}] fetch failed`, err)
        if (!cancelled) setError(true)
      })
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [tab, gameId])
  return { data, loading, error }
}

function Frame({ loading, error, label, note, children }: { loading: boolean; error: boolean; label: string; note?: string | null; children: React.ReactNode }) {
  if (loading) {
    return (
      <div className="px-3.5 pt-3 md:px-8 md:pt-5">
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-card py-14 text-xs text-muted">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-muted border-t-accent" />
          Loading {label}…
        </div>
      </div>
    )
  }
  if (error) {
    return (
      <div className="px-3.5 pt-3 md:px-8 md:pt-5">
        <div className="rounded-2xl border border-border bg-card py-10 text-center text-xs text-muted">{label} unavailable right now.</div>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-4 px-3.5 pt-3 md:px-8 md:pt-5">
      {note && <div className="rounded-xl border border-warning/25 bg-warning/[0.07] px-3.5 py-2.5 text-[11px] text-text2">{note}</div>}
      {children}
    </div>
  )
}

const H = ({ children }: { children: React.ReactNode }) => <div className="mb-2 text-[9px] font-extrabold tracking-[0.1em] text-muted">{children}</div>

function Cell({ label, value, good }: { label: string; value: React.ReactNode; good?: boolean }) {
  return (
    <div className="rounded-[10px] bg-card3 p-2 text-center">
      <div className="text-[9px] text-muted">{label}</div>
      <div className={`text-[12px] font-bold ${good ? 'text-positive' : 'text-text'}`}>{value}</div>
    </div>
  )
}

const Empty = ({ children }: { children: React.ReactNode }) => <div className="rounded-2xl border border-border bg-card py-8 text-center text-xs text-muted">{children}</div>

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

function BetRow({ l }: { l: CbbBettingLine }) {
  const total = l.wins + l.losses
  return (
    <div className="flex items-center justify-between border-b border-border py-1.5 text-[11px] last:border-b-0">
      <span className="text-text2">{l.label}</span>
      <span className="font-bold text-text">
        {total > 0 ? `${l.wins}-${l.losses}` : '—'} {total > 0 && <span className={l.pct >= 55 ? 'text-positive' : l.pct <= 45 ? 'text-negative' : 'text-muted'}>({l.pct.toFixed(0)}%)</span>}
      </span>
    </div>
  )
}

function SummaryTeam({ card }: { card: CbbSummaryCard | null; }) {
  if (!card) return <Empty>No games on record yet.</Empty>
  return (
    <div className="rounded-2xl border border-border bg-card p-3.5">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-base font-black text-text">{card.abbr}</span>
        <span className="stat-number text-lg text-text">
          {card.record.wins}-{card.record.losses}
        </span>
      </div>
      <div className="mb-3 flex gap-1">
        {card.form.map((r, i) => (
          <span key={i} className={`flex h-5 w-5 items-center justify-center rounded text-[9px] font-extrabold text-white ${r === 'W' ? 'bg-positive' : 'bg-negative'}`}>
            {r}
          </span>
        ))}
      </div>
      <div className="mb-1 text-[9px] font-bold text-muted">OFFENSE</div>
      <div className="mb-2 grid grid-cols-3 gap-1.5">
        <Cell label="Pts/G" value={card.offense.ppg.toFixed(1)} />
        <Cell label="FG%" value={`${card.offense.fgPct.toFixed(1)}`} />
        <Cell label="3P%" value={`${card.offense.tpPct.toFixed(1)}`} />
        <Cell label="FT%" value={`${card.offense.ftPct.toFixed(1)}`} />
        <Cell label="Ast/G" value={card.offense.astPg.toFixed(1)} />
        <Cell label="TO/G" value={card.offense.toPg.toFixed(1)} />
      </div>
      <div className="mb-1 text-[9px] font-bold text-muted">DEFENSE</div>
      <div className="mb-3 grid grid-cols-3 gap-1.5">
        <Cell label="Allowed/G" value={card.defense.papg.toFixed(1)} />
        <Cell label="Opp FG%" value={`${card.defense.oppFgPct.toFixed(1)}`} />
        <Cell label="Opp 3P%" value={`${card.defense.oppTpPct.toFixed(1)}`} />
        <Cell label="Reb/G" value={card.defense.rebPg.toFixed(1)} />
        <Cell label="Stl/G" value={card.defense.stlPg.toFixed(1)} />
        <Cell label="Blk/G" value={card.defense.blkPg.toFixed(1)} />
      </div>
      <div className="mb-3">
        {card.extras.map((e) => (
          <div key={e.label} className="flex items-center justify-between border-b border-border py-1.5 text-[11px] last:border-b-0">
            <span className="text-text2">{e.label}</span>
            <span className="font-bold text-text">{e.value}</span>
          </div>
        ))}
      </div>
      <div className="mb-1 text-[9px] font-bold text-muted">LAST 5</div>
      <div className="mb-3 overflow-hidden rounded-xl border border-border">
        {card.last5.map((g, i) => (
          <div key={i} className="grid grid-cols-[52px_1fr_28px_52px] items-center gap-1 border-b border-border px-2.5 py-1.5 text-[11px] last:border-b-0">
            <span className="text-muted">{g.date.slice(5)}</span>
            <span className="truncate text-text">
              {g.home ? 'vs' : '@'} {g.opp}
            </span>
            <span className={`text-center font-extrabold ${g.result === 'W' ? 'text-positive' : 'text-negative'}`}>{g.result}</span>
            <span className="text-right text-text2">{g.score}</span>
          </div>
        ))}
      </div>
      {card.betting && (
        <>
          <div className="mb-1 text-[9px] font-bold text-muted">BETTING RECORD</div>
          <BetRow l={card.betting.moneyline} />
          <BetRow l={card.betting.ats} />
          <BetRow l={card.betting.overUnder} />
          <BetRow l={card.betting.last5OverUnder} />
          <BetRow l={card.betting.home} />
          <BetRow l={card.betting.away} />
          <p className="mt-2 text-[9px] leading-relaxed text-muted">{card.betting.note}</p>
        </>
      )}
    </div>
  )
}

export function RealCBBSummaryTab({ gameId }: { gameId: string }) {
  const { data, loading, error } = useTabData<CbbSummaryData>('summary', gameId)
  return (
    <Frame loading={loading} error={error || (!loading && !data)} label="summary" note={data?.note}>
      <div className="grid gap-4 md:grid-cols-2">
        <SummaryTeam card={data?.away ?? null} />
        <SummaryTeam card={data?.home ?? null} />
      </div>
    </Frame>
  )
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

function ScoringTeam({ team }: { team: NonNullable<CbbScoringData['away']> }) {
  const p = team.profile
  return (
    <div className="rounded-2xl border border-border bg-card p-3.5">
      <div className="mb-2 text-base font-black text-text">{team.abbr}</div>
      <div className="mb-3 grid grid-cols-4 gap-1.5">
        <Cell label="Pts/G" value={p.ppg.toFixed(1)} />
        <Cell label="FG%" value={p.fgPct.toFixed(1)} />
        <Cell label="3P%" value={p.tpPct.toFixed(1)} />
        <Cell label="FT%" value={p.ftPct.toFixed(1)} />
        <Cell label="3PA/G" value={p.tpaPg.toFixed(1)} />
        <Cell label="Paint/G" value={p.paintPg.toFixed(1)} />
        <Cell label="Pace" value={p.pace.toFixed(1)} />
        <Cell label="Pts/100" value={p.offEff.toFixed(1)} />
      </div>
      <div className="mb-1 text-[9px] font-bold text-muted">TOP SCORERS</div>
      <div className="overflow-hidden rounded-xl border border-border">
        <div className="grid grid-cols-[1fr_44px_44px_44px_74px] gap-1 border-b border-border bg-card3 px-2.5 py-1.5 text-[9px] font-bold text-muted">
          <span>PLAYER</span>
          <span className="text-center">PPG</span>
          <span className="text-center">L5</span>
          <span className="text-center">3PM</span>
          <span className="text-center">OVER</span>
        </div>
        {team.scorers.map((s) => (
          <div key={s.id} className="grid grid-cols-[1fr_44px_44px_44px_74px] items-center gap-1 border-b border-border px-2.5 py-2 text-[11px] last:border-b-0">
            <span className="truncate font-semibold text-text">
              {s.name} {s.hot && <span title="Last 5 games well above season average">🔥</span>}
            </span>
            <span className="text-center font-bold text-text">{s.ppg.toFixed(1)}</span>
            <span className="text-center text-text2">{s.last5Ppg !== null ? s.last5Ppg.toFixed(1) : '—'}</span>
            <span className="text-center text-text2">{s.tpmPg.toFixed(1)}</span>
            <span className="text-center text-text2" title="Games over his season-average points mark">
              {s.propLine.line} · {s.propLine.hits}/{s.propLine.games}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-1.5 text-[9px] leading-relaxed text-muted">OVER = games he scored more than the mark (his season average rounded to a .5), as a hit count. Not a posted line.</p>
    </div>
  )
}

export function RealCBBScoringTab({ gameId }: { gameId: string }) {
  const { data, loading, error } = useTabData<CbbScoringData>('scoring', gameId)
  return (
    <Frame loading={loading} error={error || (!loading && !data)} label="scoring" note={data?.note}>
      {data && data.matchups.length > 0 && (
        <div>
          <H>OFFENSE VS DEFENSE</H>
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            {data.matchups.map((m) => (
              <div key={m.label} className="border-b border-border px-3 py-2 last:border-b-0">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-text">{m.label}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[9px] font-extrabold ${m.edge === 'even' ? 'bg-card3 text-muted' : 'bg-accent/15 text-accent'}`}>{m.edge === 'even' ? 'EVEN' : `EDGE ${m.edge === 'away' ? 'AWAY' : 'HOME'}`}</span>
                </div>
                <div className="mt-0.5 text-[10px] text-muted">{m.note}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {data?.away ? <ScoringTeam team={data.away} /> : <Empty>No games on record yet.</Empty>}
        {data?.home ? <ScoringTeam team={data.home} /> : <Empty>No games on record yet.</Empty>}
      </div>
    </Frame>
  )
}

// ---------------------------------------------------------------------------
// Defense
// ---------------------------------------------------------------------------

const gradeColor = (g: string) => (g.startsWith('A') ? '#00E5A0' : g.startsWith('B') ? '#A3E635' : g.startsWith('C') ? '#FFB800' : '#EF4444')

function DefenseTeam({ team }: { team: NonNullable<CbbDefenseData['away']> }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3.5">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-base font-black text-text">{team.abbr}</span>
        <span className="rounded-lg px-2.5 py-1 text-lg font-black" style={{ color: gradeColor(team.grade), background: `${gradeColor(team.grade)}1F` }} title="Grade from points allowed per 100 possessions">
          {team.grade}
        </span>
      </div>
      <div className="mb-3 grid grid-cols-3 gap-1.5">
        <Cell label="Allowed/G" value={team.papg.toFixed(1)} />
        <Cell label="Pts/100 allowed" value={team.defEff.toFixed(1)} />
        <Cell label="Opp FG%" value={team.oppFgPct.toFixed(1)} />
        <Cell label="Opp 3P%" value={team.oppTpPct.toFixed(1)} />
        <Cell label="Opp Reb/G" value={team.oppRebPg.toFixed(1)} />
        <Cell label="TO forced/G" value={team.toForcedPg.toFixed(1)} />
        <Cell label="Stl/G" value={team.stlPg.toFixed(1)} />
        <Cell label="Blk/G" value={team.blkPg.toFixed(1)} />
        <Cell label="vs Ranked" value={team.vsRanked.startsWith('No') ? '—' : team.vsRanked} />
      </div>
      <div className="mb-1 text-[9px] font-bold text-muted">DISRUPTORS</div>
      {team.disruptors.length === 0 ? (
        <p className="text-[11px] text-muted">Not enough games yet.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          {team.disruptors.map((d) => (
            <div key={d.name} className="grid grid-cols-[1fr_44px_44px_44px] items-center gap-1 border-b border-border px-2.5 py-1.5 text-[11px] last:border-b-0">
              <span className="truncate font-semibold text-text">{d.name}</span>
              <span className="text-center text-text2">{d.spg.toFixed(1)} stl</span>
              <span className="text-center text-text2">{d.bpg.toFixed(1)} blk</span>
              <span className="text-center text-text2">{d.rpg.toFixed(1)} reb</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function RealCBBDefenseTab({ gameId }: { gameId: string }) {
  const { data, loading, error } = useTabData<CbbDefenseData>('defense', gameId)
  return (
    <Frame loading={loading} error={error || (!loading && !data)} label="defense" note={data?.note}>
      <div className="grid gap-4 md:grid-cols-2">
        {data?.away ? <DefenseTeam team={data.away} /> : <Empty>No games on record yet.</Empty>}
        {data?.home ? <DefenseTeam team={data.home} /> : <Empty>No games on record yet.</Empty>}
      </div>
      <p className="px-1 text-[9px] leading-relaxed text-muted">Grades are approximate, from points allowed per 100 possessions (possessions estimated from field-goal attempts, offensive rebounds, turnovers and free throws).</p>
    </Frame>
  )
}

// ---------------------------------------------------------------------------
// Arena
// ---------------------------------------------------------------------------

const ratingColor = (r: number) => (r >= 8.5 ? '#00E5A0' : r >= 7 ? '#A3E635' : r >= 5.5 ? '#FFB800' : r >= 4 ? '#FF6B35' : '#8B909A')

export function RealCBBArenaTab({ gameId }: { gameId: string }) {
  const { data, loading, error } = useTabData<CbbArenaData>('arena', gameId)
  const atm = data?.atmosphere
  return (
    <Frame loading={loading} error={error || (!loading && !data)} label="arena data" note={data?.note}>
      {data && atm && (
        <>
          <div>
            <H>ARENA</H>
            <div className="rounded-2xl border border-border bg-card p-3.5">
              <div className="mb-1 text-base font-black text-text">{data.arena.name}</div>
              <div className="mb-3 text-[11px] text-muted">{data.arena.city ?? '—'}</div>
              <div className="grid grid-cols-2 gap-1.5">
                <Cell label="Capacity" value={data.arena.capacity ? data.arena.capacity.toLocaleString('en-US') : 'Not listed'} />
                <Cell label="Site" value={data.arena.neutral ? 'Neutral' : 'Home court'} />
              </div>
            </div>
          </div>
          <div>
            <H>ATMOSPHERE</H>
            <div className="rounded-2xl border border-border bg-card p-3.5">
              <div className="mb-2 flex items-baseline justify-between">
                <span className="text-base font-black" style={{ color: ratingColor(atm.rating) }}>{atm.label}</span>
                <span className="stat-number text-lg text-text">
                  {atm.rating.toFixed(1)}
                  <span className="text-[11px] text-muted"> / 10</span>
                </span>
              </div>
              <div className="mb-2 h-2 overflow-hidden rounded-full bg-card3">
                <div className="h-full rounded-full" style={{ width: `${atm.rating * 10}%`, background: ratingColor(atm.rating) }} />
              </div>
              <p className="text-[10px] leading-relaxed text-text2">{atm.note}</p>
            </div>
          </div>
          <div>
            <H>HOME COURT</H>
            <div className="rounded-2xl border border-border bg-card p-3.5">
              <div className="grid grid-cols-2 gap-1.5 md:grid-cols-5">
                <Cell label="Home win %" value={data.homeEdge.homeWinPct !== null ? `${data.homeEdge.homeWinPct.toFixed(0)}%` : '—'} />
                <Cell label="Home record" value={data.homeEdge.record ?? '—'} />
                <Cell label="Avg margin" value={data.homeEdge.avgMargin !== null ? `${data.homeEdge.avgMargin > 0 ? '+' : ''}${data.homeEdge.avgMargin}` : '—'} />
                <Cell label="ATS at home" value={data.homeEdge.ats ? `${data.homeEdge.ats.wins}-${data.homeEdge.ats.losses}` : '—'} />
                <Cell label="O/U at home" value={data.homeEdge.overUnder ? `${data.homeEdge.overUnder.wins}-${data.homeEdge.overUnder.losses}` : '—'} />
              </div>
              <p className="mt-2 text-[9px] leading-relaxed text-muted">Regular-season home games only (neutral sites excluded). ATS and O/U use real DraftKings closing lines.</p>
            </div>
          </div>
          <div>
            <H>HISTORY</H>
            {data.history.length === 0 ? (
              <Empty>No prior-season data available.</Empty>
            ) : (
              <div className="overflow-hidden rounded-xl border border-border bg-card">
                <div className="grid grid-cols-3 gap-1 border-b border-border bg-card3 px-2.5 py-2 text-[9px] font-bold text-muted">
                  <span>SEASON</span>
                  <span className="text-center">HOME RECORD</span>
                  <span className="text-center">AVG TOTAL</span>
                </div>
                {data.history.map((h) => (
                  <div key={h.season} className="grid grid-cols-3 gap-1 border-b border-border px-2.5 py-2 text-[11px] last:border-b-0">
                    <span className="text-text2">{h.season - 1}-{String(h.season).slice(2)}</span>
                    <span className="text-center text-text">{h.homeWins}-{h.homeLosses}</span>
                    <span className="text-center text-text">{h.avgTotalPoints}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <H>BET IMPACT</H>
            {data.betImpact.length === 0 ? (
              <Empty>No significant factors right now.</Empty>
            ) : (
              <div className="flex flex-col gap-2">
                {data.betImpact.map((c, i) => (
                  <div key={i} className="rounded-xl border border-accent/25 bg-accent/[0.06] p-3">
                    <div className="mb-1 text-[12px] font-bold text-text">{c.title}</div>
                    <p className="mb-1.5 text-[10px] leading-relaxed text-text2">{c.detail}</p>
                    <div className="flex flex-wrap gap-1">
                      {c.affects.map((a) => (
                        <span key={a} className="rounded-full border border-border bg-card3 px-2 py-0.5 text-[9px] font-semibold text-text2">{a}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </Frame>
  )
}
