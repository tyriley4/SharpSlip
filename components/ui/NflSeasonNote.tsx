/** Shows the NFL season being displayed, or an "updating" note when current-season data isn't available yet. */
export function NflSeasonNote({ season, updating, className = '' }: { season: number; updating: boolean; className?: string }) {
  if (updating) {
    return (
      <div className={`rounded-xl border border-accent/25 bg-accent/[0.06] px-3.5 py-2.5 text-[11px] leading-relaxed text-text2 ${className}`}>
        Season data updating — check back after this week&apos;s games. Showing {season} data in the meantime.
      </div>
    )
  }
  return <div className={`text-[11px] font-semibold text-muted ${className}`}>{season} NFL Season</div>
}
