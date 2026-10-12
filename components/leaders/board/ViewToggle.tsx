'use client'

export type StatView = 'Game Stats' | 'Betting Stats'

/** Primary navigation between a board's game stats and its betting stats. */
export function ViewToggle({ value, onChange }: { value: StatView; onChange: (v: StatView) => void }) {
  const gameActive = value === 'Game Stats'
  const betActive = value === 'Betting Stats'

  return (
    <div className="grid flex-1 grid-cols-2 gap-1 rounded-2xl border border-border bg-card p-1" role="tablist" aria-label="Stat type">
      <button
        role="tab"
        aria-selected={gameActive}
        onClick={() => onChange('Game Stats')}
        className={`flex items-center justify-center gap-1.5 rounded-xl py-3 text-[13px] font-extrabold transition-all duration-200 ${
          gameActive ? 'bg-white text-bg shadow-[0_2px_8px_rgba(0,0,0,0.5)]' : 'text-text2 hover:text-text'
        }`}
      >
        <span>📊</span> Game Stats
      </button>
      <button
        role="tab"
        aria-selected={betActive}
        onClick={() => onChange('Betting Stats')}
        className={`flex items-center justify-center gap-1.5 rounded-xl py-3 text-[13px] font-extrabold transition-all duration-200 ${
          betActive
            ? 'bg-accent text-white shadow-[0_0_16px_rgba(59,158,255,0.45)]'
            : 'border border-accent/25 bg-accent/[0.06] text-accent hover:bg-accent/10'
        }`}
      >
        <span>🎯</span> Betting Stats
      </button>
    </div>
  )
}
