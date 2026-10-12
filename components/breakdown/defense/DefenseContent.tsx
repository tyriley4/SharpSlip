'use client'

import { useState } from 'react'
import { BetTile } from '@/components/breakdown/BetTile'
import { PlayerLink } from '@/components/players/PlayerLink'
import { SegmentTabs } from '@/components/ui/PillTabs'
import type { TeamDefense } from '@/data/breakdown/defenseTypes'

function rankColor(rank: number): string {
  return rank <= 10 ? 'text-positive' : rank >= 23 ? 'text-negative' : 'text-text2'
}

export function DefenseContent({
  awayAbbr,
  homeAbbr,
  defense,
  teamColors,
}: {
  awayAbbr: string
  homeAbbr: string
  defense: { away: TeamDefense; home: TeamDefense }
  teamColors: Record<string, string>
}) {
  const [view, setView] = useState('Game Stats')
  const [team, setTeam] = useState(awayAbbr)

  const isAway = team === awayAbbr
  const data = isAway ? defense.away : defense.home
  const tc = teamColors[team] ?? '#4d9fff'

  return (
    <div className="flex flex-col gap-3 px-3.5 pt-3 md:px-8 md:pt-5">
      <SegmentTabs options={['Game Stats', 'Betting Stats']} active={view} onChange={setView} />

      <div className="grid grid-cols-2 gap-1.5">
        {[awayAbbr, homeAbbr].map((abbr) => {
          const active = team === abbr
          const c = teamColors[abbr] ?? '#4d9fff'
          return (
            <button
              key={abbr}
              onClick={() => setTeam(abbr)}
              className={`rounded-xl border-2 py-2.5 text-center text-[13px] font-bold ${active ? '' : 'border-border text-text2'}`}
              style={active ? { borderColor: c, background: `${c}22`, color: c } : undefined}
            >
              🛡 {abbr}
            </button>
          )
        })}
      </div>

      {view === 'Game Stats' && (
        <>
          <div className="grid grid-cols-2 gap-1.5 md:grid-cols-4">
            {data.units.map((u) => (
              <div key={u.label} className="rounded-xl border border-border bg-card p-2.5 text-center">
                <div className={`mb-0.5 text-base font-black ${u.good ? 'text-positive' : 'text-text'}`}>{u.value}</div>
                <div className="mb-1 text-[9px] font-semibold text-text2">{u.label}</div>
                <div className={`text-[9px] font-bold ${rankColor(u.rank)}`}>#{u.rank}</div>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto rounded-2xl border border-border bg-card">
            <div style={{ minWidth: 420 }}>
              <div className="border-b border-border px-3.5 py-2 text-[9px] font-extrabold tracking-[0.1em] text-muted">
                {team} LAST 3 GAMES
              </div>
              <div className="grid grid-cols-6 gap-1 border-b border-border bg-card3 px-3.5 py-2">
                {['OPP', 'DATE', 'PTS', 'PASS', 'RUSH', 'SACKS'].map((h) => (
                  <div key={h} className="text-[9px] font-bold text-muted">{h}</div>
                ))}
              </div>
              {data.last3.map((g, i) => (
                <div
                  key={i}
                  className={`grid grid-cols-6 items-center gap-1 px-3.5 py-2.5 ${i < data.last3.length - 1 ? 'border-b border-border' : ''}`}
                >
                  <div className="text-xs font-bold text-text">{g.opp}</div>
                  <div className="text-[10px] text-muted">{g.date}</div>
                  <div className="text-xs font-semibold text-text">{g.pts}</div>
                  <div className="text-xs text-text2">{g.pass}</div>
                  <div className="text-xs text-text2">{g.rush}</div>
                  <div className="text-xs font-semibold text-text">
                    {g.sacks} {g.to > 0 ? `· ${g.to} TO` : ''}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border p-3.5" style={{ borderColor: `${tc}55`, background: `${tc}0d` }}>
            <div className="mb-1.5 text-[9px] font-extrabold tracking-[0.1em] text-accent">🔑 KEY MATCHUP TONIGHT</div>
            <p className="text-[11px] leading-relaxed text-text2">{data.keyMatchup}</p>
          </div>

          <div>
            <div className="mb-2 text-[9px] font-bold tracking-[0.1em] text-muted">KEY DEFENDERS TO WATCH</div>
            <div className="flex flex-col gap-2">
              {data.defenders.map((d) => (
                <div key={d.name} className="rounded-xl border border-border bg-card p-2.5">
                  <div className="mb-0.5 flex items-center gap-1.5">
                    <PlayerLink name={d.name} className="text-[13px] font-bold text-text hover:text-accent hover:underline">
                      {d.name}
                    </PlayerLink>
                    <span className="rounded-md bg-card3 px-1.5 py-0.5 text-[9px] font-bold text-muted">{d.pos}</span>
                  </div>
                  <p className="text-[10px] leading-relaxed text-text2">{d.note}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {view === 'Betting Stats' && (
        <div className="rounded-2xl border border-border bg-card p-3.5">
          <div className="mb-2 text-[9px] font-extrabold tracking-[0.1em] text-muted">TEAM DEFENSE PROPS</div>
          <div className="grid grid-cols-2 gap-1.5">
            <BetTile {...data.bet.sacks} />
            <BetTile {...data.bet.ptsAllowed} />
          </div>
          <div className="mt-3.5 mb-2 text-[9px] font-extrabold tracking-[0.1em] text-muted">TURNOVERS &amp; ATS</div>
          <div className="grid grid-cols-2 gap-1.5">
            <BetTile {...data.bet.turnovers} />
            <BetTile {...data.bet.ats} />
          </div>
        </div>
      )}
    </div>
  )
}
