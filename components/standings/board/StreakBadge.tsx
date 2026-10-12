const STYLES: Record<string, { color: string; bg: string }> = {
  W: { color: '#00E5A0', bg: 'rgba(0,229,160,0.12)' },
  L: { color: '#EF4444', bg: 'rgba(239,68,68,0.12)' },
  OTL: { color: '#FFB800', bg: 'rgba(255,184,0,0.12)' },
  T: { color: '#8B909A', bg: 'rgba(139,144,154,0.12)' },
}

/** W3 (green) / L4 (red) / OTL1 (amber) streak chip with a subtle tinted background. */
export function StreakBadge({ streak }: { streak: string }) {
  const m = /^(W|L|OTL|T)(\d+)$/.exec(streak)
  if (!m) return <span className="text-[#8B909A]">—</span>
  const s = STYLES[m[1]]
  return (
    <span className="rounded-md px-1.5 py-0.5 text-[11px] font-extrabold tabular-nums" style={{ color: s.color, background: s.bg }}>
      {streak}
    </span>
  )
}
