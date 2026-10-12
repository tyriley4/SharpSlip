import Link from 'next/link'
import { Sidebar } from '@/components/layout/Sidebar'

export function LiveGameComingSoon({
  backHref,
  awayAbbr,
  homeAbbr,
  awayColor,
  homeColor,
  statusLine,
  venue,
  awayPitcher,
  homePitcher,
}: {
  backHref: string
  awayAbbr: string
  homeAbbr: string
  awayColor: string
  homeColor: string
  statusLine: string
  venue: string
  awayPitcher: string
  homePitcher: string
}) {
  return (
    <div className="mx-auto flex w-full max-w-[1400px] bg-background">
      <Sidebar />
      <div className="flex h-screen min-w-0 flex-1 flex-col">
        <div className="shrink-0 border-b border-border bg-card p-3.5 md:px-8 md:pt-6">
          <div className="flex items-center gap-3 md:gap-4">
            <Link
              href={backHref}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border border-border bg-card3 text-base text-text2 transition-colors hover:border-border2 hover:text-text md:h-9 md:w-9"
            >
              ←
            </Link>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 md:gap-2.5">
                <span className="text-[15px] font-black md:text-[26px]" style={{ color: awayColor }}>
                  {awayAbbr}
                </span>
                <span className="text-[11px] text-muted md:text-sm">@</span>
                <span className="text-[15px] font-black md:text-[26px]" style={{ color: homeColor }}>
                  {homeAbbr}
                </span>
                <span className="ml-1 truncate text-[10px] text-muted md:ml-2 md:text-sm">{statusLine}</span>
              </div>
              {(awayPitcher || homePitcher) && (
                <div className="mt-1 truncate text-[11px] text-text2 md:text-sm">
                  {awayPitcher} vs {homePitcher}
                  {venue ? ` · ${venue}` : ''}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center gap-4 overflow-y-auto px-6 py-14 text-center">
          <div className="text-4xl">🚧</div>
          <div className="text-sm font-black text-text md:text-base">Full Breakdown Coming Soon</div>
          <p className="max-w-[360px] text-xs leading-relaxed text-muted md:text-[13px]">
            Full game breakdown coming soon for live games — we&apos;re working on connecting real
            game data to our breakdown tabs.
          </p>
          <Link
            href={backHref}
            className="rounded-full border border-accent/40 bg-accent/15 px-5 py-2 text-[11px] font-bold text-accent transition-colors hover:bg-accent/25"
          >
            ← Back to Games
          </Link>
        </div>
      </div>
    </div>
  )
}
