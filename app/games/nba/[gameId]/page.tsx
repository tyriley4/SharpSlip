import Link from 'next/link'
import { RealNBAGameBreakdownClient } from '@/components/breakdown/real-nba/RealNBAGameBreakdownClient'
import { getNBAAnalysisData } from '@/lib/nba/gameBreakdown'

export default async function NBAGameDetailPage({ params }: { params: { gameId: string } }) {
  let data = null
  try {
    data = await getNBAAnalysisData(params.gameId)
  } catch (err) {
    console.error(`[NBAGameDetailPage] failed to build NBA breakdown for ${params.gameId}:`, err)
  }

  if (data) {
    return <RealNBAGameBreakdownClient backHref="/games" data={data} />
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <div className="text-4xl">🏀</div>
      <div className="text-sm font-black text-text">NBA data temporarily unavailable</div>
      <p className="max-w-[280px] text-xs leading-relaxed text-muted">
        We couldn&apos;t load this game&apos;s breakdown right now — the NBA stats provider may be rate limiting requests. Try again shortly.
      </p>
      <Link href="/games" className="rounded-full border border-accent/40 bg-accent/15 px-5 py-2 text-[11px] font-bold text-accent">
        ← Back to Games
      </Link>
    </div>
  )
}
