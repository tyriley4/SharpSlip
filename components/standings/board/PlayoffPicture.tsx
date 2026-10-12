import type { ConferencePicture, Tone } from '@/lib/standings/playoffs'
import type { SportStandings } from '@/lib/standings/types'
import { TeamLink } from '@/components/teams/TeamLink'
import { MagicBadge } from './MagicBadge'
import { TeamCircle } from './TeamRow'

const TONES: Record<Tone, { color: string; bg: string }> = {
  green: { color: '#00E5A0', bg: 'rgba(0,229,160,0.14)' },
  amber: { color: '#FFB800', bg: 'rgba(255,184,0,0.14)' },
  red: { color: '#EF4444', bg: 'rgba(239,68,68,0.14)' },
}

export function PlayoffPicture({
  title,
  picture,
  data,
  teamColors,
}: {
  title: string
  picture: ConferencePicture
  data: SportStandings
  teamColors: Record<string, string>
}) {
  const firstOut = picture.entries.findIndex((e) => e.status.tone === 'red')

  return (
    <section className="relative overflow-hidden rounded-[14px] border border-[#1F2229] bg-[#111318]">
      <div className="absolute inset-y-0 left-0 w-1" style={{ background: 'linear-gradient(180deg, #3B9EFF, #00E5A0)' }} />
      <div className="border-b border-[#1F2229] py-3 pl-5 pr-4">
        <h3 className="text-[15px] font-extrabold text-white">Playoff Picture — {title}</h3>
        <p className="mt-0.5 text-[11px] text-[#8B909A]">{picture.format}</p>
      </div>

      {picture.entries.length === 0 ? (
        <div className="px-5 py-6 text-center text-xs text-[#8B909A]">No games played yet — the playoff picture fills in as results come in.</div>
      ) : (
        <ol>
          {picture.entries.map((e, i) => {
            const tone = e.status.tone ? TONES[e.status.tone] : TONES.red
            const rec = data.tColumn ? `${e.row.w}-${e.row.l}-${e.row.t}` : `${e.row.w}-${e.row.l}`
            return (
              <li key={e.row.abbr}>
                {i === firstOut && firstOut > 0 && (
                  <div className="flex items-center gap-2 px-5 py-1">
                    <span className="h-px flex-1 border-t border-dashed border-[#EF4444]/40" />
                    <span className="text-[9px] font-bold tracking-widest text-[#EF4444]/80">CUTOFF</span>
                    <span className="h-px flex-1 border-t border-dashed border-[#EF4444]/40" />
                  </div>
                )}
                <div className="flex h-12 items-center gap-2.5 py-1 pl-5 pr-3 transition-colors duration-150 hover:bg-[#16191F]">
                  <TeamLink sport={data.sport} abbr={e.row.abbr} className="block rounded-full">
                    <TeamCircle abbr={e.row.abbr} color={teamColors[e.row.abbr] ?? '#3B9EFF'} size={30} />
                  </TeamLink>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <TeamLink sport={data.sport} abbr={e.row.abbr} className="truncate text-[13px] font-bold text-white hover:text-accent hover:underline">
                        {e.row.name}
                      </TeamLink>
                      <MagicBadge magic={e.status.magic} compact />
                    </div>
                    <div className="text-[11px] tabular-nums text-[#8B909A]">
                      {rec}
                      {data.unit === 2 && e.row.pts !== null ? ` · ${e.row.pts} pts` : ''}
                    </div>
                  </div>
                  {e.status.gapText && (e.status.tone === 'amber' || e.status.tone === 'red') && (
                    <span className="shrink-0 text-[11px] font-semibold tabular-nums text-[#8B909A]">{e.status.gapText}</span>
                  )}
                  <span
                    className="w-[58px] shrink-0 rounded-md py-0.5 text-center text-[10px] font-extrabold tracking-wide"
                    style={{ color: tone.color, background: tone.bg }}
                  >
                    {e.status.label}
                  </span>
                </div>
              </li>
            )
          })}
        </ol>
      )}
      <p className="border-t border-[#1F2229] py-2 pl-5 pr-4 text-[10px] leading-snug text-[#6B7079]">
        M = magic number to clinch · E = elimination number (shown within 10). Simplified: ignores tiebreakers and division seeding. WC gaps compare to the final wild-card cutoff.
      </p>
    </section>
  )
}
