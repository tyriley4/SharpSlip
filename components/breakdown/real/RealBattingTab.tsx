'use client'

import { useState } from 'react'
import { PlayerLink } from '@/components/players/PlayerLink'
import { PillTabs } from '@/components/ui/PillTabs'
import { MLB_TEAM_COLORS } from '@/data/mlb/teamColors'
import { avgColor } from '@/lib/breakdown/statColors'
import type { GameStatus, LeagueHittingAverages, ProbablePitcherStats, RealTeamLineup, TeamHittingContext } from '@/lib/mlb/gameBreakdown'

const SUB_TABS = ['Standard', 'Splits', 'Hot-Cold', 'Props']

type LineupPlayer = RealTeamLineup['players'][number]

function TeamSummary({ hitting, leagueAvg }: { hitting: TeamHittingContext | null; leagueAvg: LeagueHittingAverages | null }) {
  if (!hitting) return null
  const rows: { label: string; val: string; cmp: number | null }[] = [
    { label: 'AVG', val: hitting.avg, cmp: leagueAvg ? parseFloat(hitting.avg) - leagueAvg.avg : null },
    { label: 'OBP', val: hitting.obp, cmp: leagueAvg ? parseFloat(hitting.obp) - leagueAvg.obp : null },
    { label: 'SLG', val: hitting.slg, cmp: leagueAvg ? parseFloat(hitting.slg) - leagueAvg.slg : null },
    { label: 'HR', val: String(hitting.hr), cmp: leagueAvg ? hitting.hr - leagueAvg.hr : null },
    { label: 'R/G', val: hitting.runsPerGame.toFixed(2), cmp: leagueAvg ? hitting.runsPerGame - leagueAvg.runsPerGame : null },
  ]
  return (
    <div className="grid grid-cols-5 gap-1.5 rounded-xl border border-border bg-card p-2.5">
      {rows.map((s) => (
        <div key={s.label} className="text-center">
          <div className="text-[9px] text-muted">{s.label}</div>
          <div className="text-xs font-extrabold text-text">{s.val}</div>
          {s.cmp !== null && (
            <div className={`text-[8px] font-bold ${s.cmp >= 0 ? 'text-positive' : 'text-negative'}`}>
              {s.cmp >= 0 ? '▲' : '▼'} vs lg
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function StandardTable({ players, showToday }: { players: LineupPlayer[]; showToday: boolean }) {
  const cols = showToday ? '24px 2fr 36px 1fr 1fr 1fr 0.6fr 0.6fr 1fr' : '24px 2fr 36px 1fr 1fr 1fr 0.6fr 0.6fr'
  const headers = ['#', 'BATTER', 'POS', 'AVG', 'OBP', 'SLG', 'HR', 'RBI', ...(showToday ? ['TODAY'] : [])]
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <div style={{ minWidth: showToday ? 640 : 560 }}>
        <div className="grid gap-1 border-b border-border bg-card3 px-2.5 py-2" style={{ gridTemplateColumns: cols }}>
          {headers.map((h) => (
            <div key={h} className={`text-[9px] font-bold text-muted ${h === 'BATTER' ? 'text-left' : 'text-center'}`}>
              {h}
            </div>
          ))}
        </div>
        {players.map((p, i) => (
          <div
            key={p.id}
            className={`grid items-center gap-1 px-2.5 py-2 ${i < players.length - 1 ? 'border-b border-border' : ''}`}
            style={{ gridTemplateColumns: cols }}
          >
            <div className="text-center text-[10px] font-bold text-muted">{p.order}</div>
            <PlayerLink name={p.name} className="truncate text-[11px] font-semibold text-text hover:text-accent hover:underline">
              {p.name}
            </PlayerLink>
            <div className="text-center text-[10px] text-muted">{p.pos}</div>
            <div className={`text-center text-[11px] font-semibold ${avgColor(p.season.avg)}`}>{p.season.avg}</div>
            <div className="text-center text-[11px] text-text2">{p.season.obp}</div>
            <div className="text-center text-[11px] text-text2">{p.season.slg}</div>
            <div className="text-center text-[11px] font-semibold text-text">{p.season.hr}</div>
            <div className="text-center text-[11px] font-semibold text-text">{p.season.rbi}</div>
            {showToday && (
              <div className="text-center text-[10px] font-bold text-accent">
                {p.today ? `${p.today.h}-${p.today.ab}${p.today.hr ? ' 💣' : ''}` : '—'}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function SplitsTable({ players, oppHandLabel }: { players: LineupPlayer[]; oppHandLabel: string }) {
  const cols = '24px 2fr 1fr 1fr 1fr 0.6fr 0.6fr'
  return (
    <div>
      <div className="mb-2 text-[9px] font-bold tracking-[0.1em] text-muted">SEASON SPLITS VS {oppHandLabel}</div>
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <div style={{ minWidth: 520 }}>
          <div className="grid gap-1 border-b border-border bg-card3 px-2.5 py-2" style={{ gridTemplateColumns: cols }}>
            {['#', 'BATTER', 'AVG', 'OBP', 'SLG', 'HR', 'RBI'].map((h) => (
              <div key={h} className={`text-[9px] font-bold text-muted ${h === 'BATTER' ? 'text-left' : 'text-center'}`}>
                {h}
              </div>
            ))}
          </div>
          {players.map((p, i) => (
            <div
              key={p.id}
              className={`grid items-center gap-1 px-2.5 py-2 ${i < players.length - 1 ? 'border-b border-border' : ''}`}
              style={{ gridTemplateColumns: cols }}
            >
              <div className="text-center text-[10px] font-bold text-muted">{p.order}</div>
              <PlayerLink name={p.name} className="truncate text-[11px] font-semibold text-text hover:text-accent hover:underline">
                {p.name}
              </PlayerLink>
              {p.vsHand ? (
                <>
                  <div className={`text-center text-[11px] font-semibold ${avgColor(p.vsHand.avg)}`}>{p.vsHand.avg}</div>
                  <div className="text-center text-[11px] text-text2">{p.vsHand.obp}</div>
                  <div className="text-center text-[11px] text-text2">{p.vsHand.slg}</div>
                  <div className="text-center text-[11px] font-semibold text-text">{p.vsHand.hr}</div>
                  <div className="text-center text-[11px] font-semibold text-text">{p.vsHand.rbi}</div>
                </>
              ) : (
                <div className="text-center text-[10px] text-muted" style={{ gridColumn: 'span 5' }}>
                  No split data
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function hotColdTone(last7: string | null): { emoji: string; color: string } {
  if (!last7) return { emoji: '', color: 'text-text2' }
  const n = parseFloat(last7)
  if (n >= 0.3) return { emoji: '🔥', color: 'text-positive' }
  if (n < 0.2) return { emoji: '❄️', color: 'text-negative' }
  return { emoji: '', color: 'text-text2' }
}

function HotColdTable({ players }: { players: LineupPlayer[] }) {
  const cols = '24px 2fr 1fr 1fr'
  return (
    <div>
      <div className="mb-2 text-[9px] font-bold tracking-[0.1em] text-muted">LAST 7 DAYS VS SEASON</div>
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="grid gap-1 border-b border-border bg-card3 px-2.5 py-2" style={{ gridTemplateColumns: cols }}>
          {['#', 'BATTER', 'L7 AVG', 'SEASON AVG'].map((h) => (
            <div key={h} className={`text-[9px] font-bold text-muted ${h === 'BATTER' ? 'text-left' : 'text-center'}`}>
              {h}
            </div>
          ))}
        </div>
        {players.map((p, i) => {
          const tone = hotColdTone(p.last7Avg)
          return (
            <div
              key={p.id}
              className={`grid items-center gap-1 px-2.5 py-2 ${i < players.length - 1 ? 'border-b border-border' : ''}`}
              style={{ gridTemplateColumns: cols }}
            >
              <div className="text-center text-[10px] font-bold text-muted">{p.order}</div>
              <div className="flex min-w-0 items-center gap-1">
                {tone.emoji && <span className="text-[9px]">{tone.emoji}</span>}
                <PlayerLink name={p.name} className="truncate text-[11px] font-semibold text-text hover:text-accent hover:underline">
                  {p.name}
                </PlayerLink>
              </div>
              <div className={`text-center text-[11px] font-bold ${tone.color}`}>{p.last7Avg ?? '—'}</div>
              <div className="text-center text-[11px] text-text2">{p.season.avg}</div>
            </div>
          )
        })}
      </div>
      <div className="mt-2.5 rounded-[10px] border border-accent/20 bg-accent/10 p-2.5">
        <p className="text-[10px] leading-relaxed text-text2">
          🔥 = .300+ AVG over the last 7 days · ❄️ = below .200 over the last 7 days
        </p>
      </div>
    </div>
  )
}

function PropsTable({ players }: { players: LineupPlayer[] }) {
  const sorted = [...players].sort((a, b) => b.hitRate - a.hitRate)
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="grid gap-1 border-b border-border bg-card3 px-2.5 py-2" style={{ gridTemplateColumns: '2fr 1fr' }}>
        <div className="text-[9px] font-bold text-muted">BATTER</div>
        <div className="text-center text-[9px] font-bold text-muted">1+ HITS %</div>
      </div>
      {sorted.map((p, i) => {
        const tone = p.hitRate >= 65 ? 'text-positive' : p.hitRate < 45 ? 'text-negative' : 'text-text2'
        return (
          <div
            key={p.id}
            className={`grid items-center gap-1 px-2.5 py-2.5 ${i < sorted.length - 1 ? 'border-b border-border' : ''}`}
            style={{ gridTemplateColumns: '2fr 1fr' }}
          >
            <PlayerLink name={p.name} className="truncate text-[11px] font-semibold text-text hover:text-accent hover:underline">
              {p.name}
            </PlayerLink>
            <div className={`text-center text-sm font-extrabold ${tone}`}>{p.hitRate}%</div>
          </div>
        )
      })}
    </div>
  )
}

export function RealBattingTab({
  awayAbbr,
  homeAbbr,
  batting,
  teamHitting,
  leagueAvg,
  status,
  awayPitcher,
  homePitcher,
}: {
  awayAbbr: string
  homeAbbr: string
  batting: { away: RealTeamLineup; home: RealTeamLineup }
  teamHitting: { away: TeamHittingContext | null; home: TeamHittingContext | null }
  leagueAvg: LeagueHittingAverages | null
  status: GameStatus
  awayPitcher: ProbablePitcherStats | null
  homePitcher: ProbablePitcherStats | null
}) {
  const [team, setTeam] = useState<'away' | 'home'>('away')
  const [subTab, setSubTab] = useState('Standard')

  const isAway = team === 'away'
  const lineup = isAway ? batting.away : batting.home
  const hitting = isAway ? teamHitting.away : teamHitting.home
  const opposingPitcher = isAway ? homePitcher : awayPitcher
  const abbr = isAway ? awayAbbr : homeAbbr
  const oppHandLabel = opposingPitcher?.handedness === 'L' ? 'LHP' : 'RHP'
  const showToday = status !== 'Preview'

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

      {opposingPitcher && (
        <div className="flex items-center justify-between rounded-[10px] border border-border bg-card px-3 py-2">
          <span className="text-[11px] text-text2">
            <span className="font-semibold text-text">{abbr}</span> vs{' '}
            <PlayerLink name={opposingPitcher.name} className="font-bold text-accent hover:underline">{opposingPitcher.name}</PlayerLink>{' '}
            <span className="text-muted">
              ({opposingPitcher.era.toFixed(2)} ERA · {opposingPitcher.handedness}HP)
            </span>
          </span>
        </div>
      )}

      <TeamSummary hitting={hitting} leagueAvg={leagueAvg} />

      {!lineup.posted ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center text-xs text-muted">
          Lineup pending — check back closer to game time.
        </div>
      ) : (
        <div>
          <div className="mb-3">
            <PillTabs options={SUB_TABS} active={subTab} onChange={setSubTab} />
          </div>
          {subTab === 'Standard' && <StandardTable players={lineup.players} showToday={showToday} />}
          {subTab === 'Splits' && <SplitsTable players={lineup.players} oppHandLabel={oppHandLabel} />}
          {subTab === 'Hot-Cold' && <HotColdTable players={lineup.players} />}
          {subTab === 'Props' && <PropsTable players={lineup.players} />}
        </div>
      )}
    </div>
  )
}
