import Link from 'next/link'
import { GameBreakdownClient } from '@/components/breakdown/GameBreakdownClient'
import { LiveGameComingSoon } from '@/components/breakdown/LiveGameComingSoon'
import { RealGameBreakdownClient } from '@/components/breakdown/real/RealGameBreakdownClient'
import { RealNFLGameBreakdownClient } from '@/components/breakdown/real-nfl/RealNFLGameBreakdownClient'
import { MLB_TEAM_COLORS } from '@/data/mlb/teamColors'
import { findGameById } from '@/lib/games/lookup'
import { getGameByGamePk } from '@/lib/mlb/api'
import { getRealGameBreakdown } from '@/lib/mlb/gameBreakdown'
import { getNFLAnalysisData } from '@/lib/nfl/gameBreakdown'

function formatGameTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })
}

export default async function GameDetailPage({ params }: { params: { id: string } }) {
  const result = findGameById(params.id)
  if (result) {
    return <GameBreakdownClient result={result} />
  }

  // Not a placeholder game — check if it's a real MLB Stats API gamePk.
  const gamePk = Number(params.id)
  if (Number.isInteger(gamePk) && gamePk > 0) {
    let breakdown = null
    try {
      breakdown = await getRealGameBreakdown(gamePk)
    } catch (err) {
      console.error(`[GameDetailPage] failed to build real breakdown for ${gamePk}:`, err)
    }

    if (breakdown) {
      return <RealGameBreakdownClient backHref="/games" breakdown={breakdown} />
    }

    let liveGame = null
    try {
      liveGame = await getGameByGamePk(gamePk)
    } catch (err) {
      console.error(`[GameDetailPage] failed to load live game ${gamePk}:`, err)
    }

    if (liveGame) {
      const state = liveGame.status.abstractGameState
      const statusLine = state === 'Preview' ? formatGameTime(liveGame.gameDate) : liveGame.status.detailedState
      const awayAbbr = liveGame.teams.away.team.abbreviation ?? liveGame.teams.away.team.name.slice(0, 3).toUpperCase()
      const homeAbbr = liveGame.teams.home.team.abbreviation ?? liveGame.teams.home.team.name.slice(0, 3).toUpperCase()

      return (
        <LiveGameComingSoon
          backHref="/games"
          awayAbbr={awayAbbr}
          homeAbbr={homeAbbr}
          awayColor={MLB_TEAM_COLORS[awayAbbr] ?? '#4d9fff'}
          homeColor={MLB_TEAM_COLORS[homeAbbr] ?? '#4d9fff'}
          statusLine={statusLine}
          venue={liveGame.venue?.name ?? ''}
          awayPitcher={liveGame.teams.away.probablePitcher?.fullName ?? 'TBD'}
          homePitcher={liveGame.teams.home.probablePitcher?.fullName ?? 'TBD'}
        />
      )
    }
  }

  // Not an MLB gamePk either — check if it's a real nflverse game_id (e.g. "2024_20_LA_PHI").
  if (/^\d{4}_\d{2}_[A-Z]{2,3}_[A-Z]{2,3}$/.test(params.id)) {
    let nflData = null
    try {
      nflData = await getNFLAnalysisData(params.id)
    } catch (err) {
      console.error(`[GameDetailPage] failed to build NFL breakdown for ${params.id}:`, err)
    }

    if (nflData) {
      return <RealNFLGameBreakdownClient backHref="/games" data={nflData} />
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <div className="text-4xl">🚧</div>
      <div className="text-sm font-black text-text">Full breakdown coming soon</div>
      <p className="max-w-[280px] text-xs leading-relaxed text-muted">
        We don&apos;t have a detailed breakdown built for this game yet — check the games list for
        matchups with full analysis.
      </p>
      <Link href="/games" className="rounded-full border border-accent/40 bg-accent/15 px-5 py-2 text-[11px] font-bold text-accent">
        ← Back to Games
      </Link>
    </div>
  )
}
