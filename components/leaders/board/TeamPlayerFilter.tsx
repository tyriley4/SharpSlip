'use client'

import { ALL_TEAMS, type TeamFilterController } from './teamFilter'

/**
 * Two-level filter. Level 1 picks a team (narrowing the board to its players); once a team is chosen,
 * level 2 lists that team's players so specific ones can be highlighted and compared.
 */
export function TeamPlayerFilter({
  teams,
  playerOptions,
  controller,
}: {
  teams: { abbr: string; name: string }[]
  /** Players currently on the board for the chosen team (the leaderboard pool). */
  playerOptions: string[]
  controller: TeamFilterController
}) {
  const { value, setTeam, togglePlayer, clear } = controller
  const active = value.team !== ALL_TEAMS

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-end gap-2">
        <label className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="text-[9px] font-bold uppercase tracking-wide text-muted">Team</span>
          <select
            value={value.team}
            onChange={(e) => setTeam(e.target.value)}
            className="w-full rounded-lg border border-border bg-card3 px-3 py-2 text-[12px] font-semibold text-text focus:border-accent focus:outline-none [color-scheme:dark]"
          >
            <option value={ALL_TEAMS}>All Teams</option>
            {teams.map((t) => (
              <option key={t.abbr} value={t.abbr}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        {active && (
          <button type="button" onClick={clear} className="shrink-0 rounded-lg border border-border bg-card px-3 py-2 text-[11px] font-bold text-text2 hover:border-border2 hover:text-text">
            Clear
          </button>
        )}
      </div>

      {active && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[9px] font-bold uppercase tracking-wide text-muted">
            Players — tap to highlight and compare{value.players.length > 0 ? ` (${value.players.length} selected)` : ''}
          </span>
          {playerOptions.length === 0 ? (
            <p className="text-[11px] text-muted">No {value.team} players on this board yet.</p>
          ) : (
            <div className="flex max-h-[132px] flex-wrap gap-1.5 overflow-y-auto pr-1">
              {playerOptions.map((name) => {
                const on = value.players.includes(name)
                return (
                  <button
                    key={name}
                    type="button"
                    aria-pressed={on}
                    onClick={() => togglePlayer(name)}
                    className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors ${
                      on ? 'border-accent bg-accent/15 text-accent' : 'border-border bg-card text-text2 hover:border-border2 hover:text-text'
                    }`}
                  >
                    <span className={`flex h-3 w-3 items-center justify-center rounded-sm border text-[8px] ${on ? 'border-accent bg-accent text-white' : 'border-border2'}`}>{on ? '✓' : ''}</span>
                    {name}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
