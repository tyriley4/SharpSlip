'use client'

import { buildLeg, signed, type GameSel, type LegDraft, type LegMarket } from '@/lib/account/legs'
import { defaultRole, propCategories, propThresholds, roleOptions } from '@/lib/account/props'
import type { BetSport } from '@/lib/account/types'
import { PlayerPicker } from './PlayerPicker'
import { FieldLabel, Pill, TextInput } from './ui'

function OverUnder({ side, onChange }: { side: 'over' | 'under'; onChange: (s: 'over' | 'under') => void }) {
  return (
    <div className="grid grid-cols-2 gap-1.5 rounded-xl border border-border bg-card3 p-1">
      {(['over', 'under'] as const).map((s) => (
        <button
          key={s}
          type="button"
          aria-pressed={side === s}
          onClick={() => onChange(s)}
          className={`rounded-lg py-2 text-[12px] font-extrabold capitalize transition-colors ${side === s ? 'bg-accent text-white' : 'text-text2 hover:text-text'}`}
        >
          {s === 'over' ? '⬆ Over' : '⬇ Under'}
        </button>
      ))}
    </div>
  )
}

function TeamChoice({ game, value, onChange, spreadLine }: { game: GameSel; value: LegDraft['team']; onChange: (t: 'away' | 'home') => void; spreadLine?: string }) {
  const line = parseFloat(spreadLine ?? '')
  return (
    <div className="grid grid-cols-2 gap-2">
      {(['away', 'home'] as const).map((side) => {
        const abbr = side === 'away' ? game.away : game.home
        const active = value === side
        return (
          <button
            key={side}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(side)}
            className={`rounded-xl border px-3 py-3 text-left transition-colors ${active ? 'border-accent bg-accent/10' : 'border-border bg-card3 hover:border-border2'}`}
          >
            <div className="text-[9px] font-bold uppercase tracking-wide text-muted">{side === 'away' ? 'Away' : 'Home'}</div>
            <div className="text-[15px] font-extrabold text-text">
              {abbr}
              {spreadLine !== undefined && !Number.isNaN(line) && <span className="ml-1.5 text-accent">{signed(line)}</span>}
            </div>
          </button>
        )
      })}
    </div>
  )
}

/** Step 3 for one leg: the fields that change with the market (moneyline, spread, total or player prop). */
export function LegDetails({
  sport,
  game,
  market,
  draft,
  onChange,
}: {
  sport: BetSport
  game: GameSel | null
  market: LegMarket
  draft: LegDraft
  onChange: (patch: Partial<LegDraft>) => void
}) {
  const oddsField = (
    <div>
      <FieldLabel>Odds (American)</FieldLabel>
      <TextInput inputMode="numeric" value={draft.odds} onChange={(e) => onChange({ odds: e.target.value })} placeholder="-110 or +145" />
    </div>
  )

  if (market !== 'Player Prop' && !game) {
    return <p className="rounded-xl border border-border bg-card3 px-3 py-4 text-center text-[11px] text-muted">Pick a game above to choose a side.</p>
  }

  if (market === 'Moneyline' && game) {
    return (
      <div className="flex flex-col gap-3">
        <div>
          <FieldLabel>Who wins?</FieldLabel>
          <TeamChoice game={game} value={draft.team} onChange={(team) => onChange({ team })} />
        </div>
        {oddsField}
      </div>
    )
  }

  if (market === 'Spread' && game) {
    return (
      <div className="flex flex-col gap-3">
        <div>
          <FieldLabel>Team and spread</FieldLabel>
          <TeamChoice game={game} value={draft.team} onChange={(team) => onChange({ team })} spreadLine={draft.spreadLine} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <FieldLabel>Spread</FieldLabel>
            <TextInput inputMode="decimal" value={draft.spreadLine} onChange={(e) => onChange({ spreadLine: e.target.value })} placeholder="-1.5 or +3" />
          </div>
          {oddsField}
        </div>
      </div>
    )
  }

  if (market === 'Total') {
    return (
      <div className="flex flex-col gap-3">
        <div>
          <FieldLabel>Over / Under</FieldLabel>
          <OverUnder side={draft.side} onChange={(side) => onChange({ side })} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <FieldLabel>Line</FieldLabel>
            <TextInput inputMode="decimal" value={draft.totalLine} onChange={(e) => onChange({ totalLine: e.target.value })} placeholder="8.5" />
          </div>
          {oddsField}
        </div>
      </div>
    )
  }

  // Player prop
  const roles = roleOptions(sport)
  const role = draft.role
  const categories = propCategories(sport, role)
  const thresholds = draft.category ? propThresholds(sport, role, draft.category) : []

  return (
    <div className="flex flex-col gap-3">
      {roles.length > 0 && (
        <div>
          <FieldLabel>Player type</FieldLabel>
          <div className="flex gap-1.5">
            {roles.map((r) => (
              <Pill key={r.id} active={role === r.id} onClick={() => onChange({ role: r.id, category: '', propLine: '' })}>
                {r.label}
              </Pill>
            ))}
          </div>
        </div>
      )}

      <div>
        <FieldLabel>Player</FieldLabel>
        <PlayerPicker
          sport={sport}
          game={game}
          value={draft.player}
          onChange={(player) => onChange({ player })}
          onPick={(p) => {
            // MLB / NHL players come with a role; switch the category list to match.
            const nextRole = roles.length > 0 && (p.role === 'pitcher' || p.role === 'hitter' || p.role === 'skater' || p.role === 'goalie') ? p.role : defaultRole(sport)
            onChange({ player: p.name, role: nextRole, ...(nextRole !== role ? { category: '', propLine: '' } : {}) })
          }}
        />
      </div>

      <div>
        <FieldLabel>Prop</FieldLabel>
        <div className="flex flex-wrap gap-1.5">
          {categories.map((c) => (
            <Pill key={c.value} active={draft.category === c.value} onClick={() => onChange({ category: c.value, propLine: '' })}>
              {c.label}
            </Pill>
          ))}
        </div>
      </div>

      {draft.category && (
        <div>
          <FieldLabel>Line</FieldLabel>
          <div className="flex flex-wrap items-center gap-1.5">
            {thresholds.map((t) => (
              <Pill key={t} active={draft.propLine === String(t)} onClick={() => onChange({ propLine: String(t) })}>
                {t}+
              </Pill>
            ))}
            <input
              inputMode="decimal"
              value={thresholds.some((t) => String(t) === draft.propLine) ? '' : draft.propLine}
              onChange={(e) => onChange({ propLine: e.target.value })}
              placeholder="Custom"
              aria-label="Custom line"
              className="w-[84px] rounded-full border border-border bg-card3 px-3 py-1.5 text-[11px] font-semibold text-text placeholder:text-muted focus:border-accent focus:outline-none"
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 items-end gap-2">
        <div>
          <FieldLabel>Over / Under</FieldLabel>
          <OverUnder side={draft.side} onChange={(side) => onChange({ side })} />
        </div>
        {oddsField}
      </div>
    </div>
  )
}

export { buildLeg }
