'use client'

export function VisualizeButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="Visualize data"
      className="flex h-11 min-w-[44px] shrink-0 items-center justify-center gap-2 rounded-full border border-accent/50 bg-card text-accent transition-all hover:border-accent hover:shadow-[0_0_14px_rgba(59,158,255,0.3)] md:px-4"
    >
      <span className="text-base leading-none">📈</span>
      <span className="hidden text-[12px] font-extrabold md:inline">Visualize</span>
    </button>
  )
}
