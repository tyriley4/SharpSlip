'use client'

import { useState } from 'react'
import { buildLeg, EMPTY_DRAFT, type GameSel, type LegDraft, type LegMarket } from '@/lib/account/legs'
import { defaultRole } from '@/lib/account/props'
import { BET_SPORTS, type BetLeg, type BetSport } from '@/lib/account/types'
import { GamePicker } from './GamePicker'
import { LegDetails } from './LegDetails'
import { FieldLabel, Pill } from './ui'

const SPORT_LABEL: Record<BetSport, string> = { mlb: 'MLB', nfl: 'NFL', nba: 'NBA', nhl: 'NHL' }

/** Builds one leg of a parlay or teaser: sport → game → market → details, then "Add leg". */
export function LegBuilder({
  markets,
  defaultSport,
  defaultGame,
  onAdd,
  addLabel = '+ Add Leg',
}: {
  markets: LegMarket[]
  defaultSport: BetSport
  defaultGame: GameSel | null
  onAdd: (leg: BetLeg) => void
  addLabel?: string
}) {
  const [sport, setSport] = useState<BetSport>(defaultSport)
  const [game, setGame] = useState<GameSel | null>(defaultGame)
  const [market, setMarket] = useState<LegMarket>(markets[0])
  const [draft, setDraft] = useState<LegDraft>({ ...EMPTY_DRAFT, role: defaultRole(defaultSport) })
  const [error, setError] = useState<string | null>(null)

  function submit() {
    const built = buildLeg(sport, game, market, draft)
    if ('error' in built) {
      setError(built.error)
      return
    }
    setError(null)
    onAdd(built.leg)
    // Keep the sport and game (parlays often stack several legs from one game) but clear the pick itself.
    setDraft({ ...EMPTY_DRAFT, role: defaultRole(sport) })
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card2 p-3.5">
      <div>
        <FieldLabel>Sport</FieldLabel>
        <div className="flex flex-wrap gap-1.5">
          {BET_SPORTS.map((s) => (
            <Pill
              key={s}
              active={sport === s}
              onClick={() => {
                setSport(s)
                setGame(null)
                setDraft({ ...EMPTY_DRAFT, role: defaultRole(s) })
              }}
            >
              {SPORT_LABEL[s]}
            </Pill>
          ))}
        </div>
      </div>

      <GamePicker sport={sport} value={game} onChange={setGame} />

      <div>
        <FieldLabel>Market</FieldLabel>
        <div className="flex flex-wrap gap-1.5">
          {markets.map((m) => (
            <Pill
              key={m}
              active={market === m}
              onClick={() => {
                setMarket(m)
                setDraft((d) => ({ ...d, team: '', player: d.player }))
              }}
            >
              {m}
            </Pill>
          ))}
        </div>
      </div>

      <LegDetails sport={sport} game={game} market={market} draft={draft} onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))} />

      {error && <p className="text-[11px] font-semibold text-negative">{error}</p>}

      <button type="button" onClick={submit} className="rounded-xl border border-accent bg-accent/15 py-2.5 text-[12px] font-extrabold text-accent transition-colors hover:bg-accent/25">
        {addLabel}
      </button>
    </div>
  )
}
