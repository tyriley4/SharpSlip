'use client'

import { LiveMLBGameCard } from '@/components/games/LiveMLBGameCard'
import { LiveNBAGameCard } from '@/components/games/LiveNBAGameCard'
import { LiveNFLGameCard } from '@/components/games/LiveNFLGameCard'
import { CollegeSlateView } from '@/components/games/CollegeSlateView'
import { LiveNHLGameCard } from '@/components/games/LiveNHLGameCard'
import { AppShell } from '@/components/layout/AppShell'
import { DataUnavailable } from '@/components/ui/DataUnavailable'
import { NflSeasonNote } from '@/components/ui/NflSeasonNote'
import type { LiveMlbGame } from '@/lib/mlb/mappers'
import type { CollegeSlate } from '@/lib/college/slate'
import type { LiveNbaGame } from '@/lib/nba/mappers'
import type { LiveNflGame } from '@/lib/nfl/mappers'
import type { LiveNhlGame } from '@/lib/nhl/mappers'
import { NBA_PRESEASON_BANNER } from '@/lib/edges/seasonText'
import { useSport } from '@/lib/sport/SportContext'

export function GamesPageClient({
  mlbGames,
  nflGames,
  nflSeason,
  nflDataUpdating,
  nflWeek,
  nbaGames,
  nbaPreseason,
  nhlGames,
  cfbSlate,
  cbbSlate,
}: {
  mlbGames: LiveMlbGame[] | null
  nflGames: LiveNflGame[] | null
  nflSeason: number
  nflDataUpdating: boolean
  nflWeek: string | null
  nbaGames: LiveNbaGame[] | null
  /** True before the October 20 opener: preseason games are hidden and a banner explains why. */
  nbaPreseason: boolean
  nhlGames: LiveNhlGame[] | null
  cfbSlate: CollegeSlate | null
  cbbSlate: CollegeSlate | null
}) {
  const { sport } = useSport()
  const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  return (
    <AppShell>
      {sport === 'mlb' && (
        <div className="flex flex-col gap-4 px-3.5 pt-1 md:gap-6 md:px-0 md:pt-0">
          <div>
            <h1 className="text-base font-extrabold text-text md:text-2xl">Today&apos;s Slate</h1>
            <p className="mt-0.5 text-[11px] text-muted md:mt-1 md:text-[13px]">{today}</p>
          </div>
          {mlbGames === null ? (
            <DataUnavailable label="MLB schedule" />
          ) : mlbGames.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card px-6 py-14 text-center text-xs text-muted">
              No MLB games scheduled today.
            </div>
          ) : (
            <div className="flex flex-col gap-2.5 md:grid md:grid-cols-2 md:gap-4 xl:grid-cols-3">
              {mlbGames.map((g) => (
                <LiveMLBGameCard key={g.id} game={g} />
              ))}
            </div>
          )}
        </div>
      )}

      {sport === 'nfl' && (
        <div className="flex flex-col gap-4 px-3.5 pt-1 md:gap-6 md:px-0 md:pt-0">
          <div>
            <h1 className="text-base font-extrabold text-text md:text-2xl">{nflWeek ? `Week ${nflWeek} Games` : 'NFL Games'}</h1>
            <p className="mt-0.5 text-[11px] text-muted md:mt-1 md:text-[13px]">
              {nflSeason} NFL Season{nflWeek ? ` · Week ${nflWeek}` : ''}
            </p>
          </div>
          {nflDataUpdating && <NflSeasonNote season={nflSeason} updating />}
          {nflGames === null ? (
            <DataUnavailable label="NFL schedule" />
          ) : nflGames.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card px-6 py-14 text-center text-xs text-muted">
              No NFL game data available.
            </div>
          ) : (
            <div className="flex flex-col gap-2.5 md:grid md:grid-cols-2 md:gap-4 xl:grid-cols-3">
              {nflGames.map((g) => (
                <LiveNFLGameCard key={g.id} game={g} />
              ))}
            </div>
          )}
        </div>
      )}

      {sport === 'cfb' && <CollegeSlateView slate={cfbSlate} sport="cfb" />}

      {sport === 'cbb' && <CollegeSlateView slate={cbbSlate} sport="cbb" />}

      {sport === 'nba' && (
        <div className="flex flex-col gap-4 px-3.5 pt-1 md:gap-6 md:px-0 md:pt-0">
          <div>
            <h1 className="text-base font-extrabold text-text md:text-2xl">Today&apos;s NBA Slate</h1>
            <p className="mt-0.5 text-[11px] text-muted md:mt-1 md:text-[13px]">{today}</p>
          </div>
          {nbaPreseason && (
            <div className="rounded-xl border border-accent/25 bg-accent/[0.06] px-3.5 py-3 text-[12px] leading-snug text-text2">🏀 {NBA_PRESEASON_BANNER}</div>
          )}
          {nbaGames === null ? (
            <DataUnavailable label="NBA schedule" />
          ) : nbaGames.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card px-6 py-14 text-center text-xs text-muted">
              No NBA games scheduled today.
            </div>
          ) : (
            <div className="flex flex-col gap-2.5 md:grid md:grid-cols-2 md:gap-4 xl:grid-cols-3">
              {nbaGames.map((g) => (
                <LiveNBAGameCard key={g.id} game={g} />
              ))}
            </div>
          )}
        </div>
      )}

      {sport === 'nhl' && (
        <div className="flex flex-col gap-4 px-3.5 pt-1 md:gap-6 md:px-0 md:pt-0">
          <div>
            <h1 className="text-base font-extrabold text-text md:text-2xl">Today&apos;s NHL Slate</h1>
            <p className="mt-0.5 text-[11px] text-muted md:mt-1 md:text-[13px]">{today}</p>
          </div>
          {nhlGames === null ? (
            <DataUnavailable label="NHL schedule" />
          ) : nhlGames.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card px-6 py-14 text-center text-xs text-muted">
              No NHL games scheduled today.
            </div>
          ) : (
            <div className="flex flex-col gap-2.5 md:grid md:grid-cols-2 md:gap-4 xl:grid-cols-3">
              {nhlGames.map((g) => (
                <LiveNHLGameCard key={g.id} game={g} />
              ))}
            </div>
          )}
        </div>
      )}
    </AppShell>
  )
}
