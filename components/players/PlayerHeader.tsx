'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { trackEvent } from '@/lib/analytics/posthog'
import { FavoritePlayerStar } from '@/components/account/FavoriteStarButton'
import type { PlayerRow } from '@/lib/players/types'

export function PlayerHeader({ player, teamColor }: { player: PlayerRow; teamColor: string }) {
  const router = useRouter()

  useEffect(() => {
    trackEvent('player_page_opened', { sport: player.sport, playerName: player.name })
  }, [player.sport, player.name])

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="h-1.5" style={{ background: teamColor }} />
      <div className="flex items-start justify-between gap-4 p-3.5 md:p-6">
        <div className="flex items-start gap-3 md:gap-4">
          <button
            onClick={() => router.back()}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border border-border bg-card3 text-base text-text2 transition-colors hover:border-border2 hover:text-text md:h-9 md:w-9"
          >
            ←
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-lg font-black text-text md:text-[28px]">{player.name}</h1>
              <span className="text-base md:text-xl">{player.is_hot ? '🔥' : '❄️'}</span>
              {player.sport !== 'cfb' && player.sport !== 'cbb' && <FavoritePlayerStar sport={player.sport} slug={player.slug} name={player.name} />}
            </div>
            <div className="mt-1 flex items-center gap-2">
              <span
                className="rounded-md px-1.5 py-0.5 text-[11px] font-bold"
                style={{ background: `${teamColor}22`, color: teamColor }}
              >
                {player.team}
              </span>
              <span className="text-[11px] font-semibold text-muted md:text-xs">{player.position}</span>
            </div>
          </div>
        </div>

        {player.headline_stat && (
          <div className="shrink-0 text-right">
            <div className="text-xl font-black text-accent md:text-3xl">{player.headline_stat}</div>
            <div className="text-[9px] font-bold uppercase tracking-[0.08em] text-muted md:text-[10px]">
              Season
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
