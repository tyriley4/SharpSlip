import Link from 'next/link'
import { RealNHLGameBreakdownClient } from '@/components/breakdown/real-nhl/RealNHLGameBreakdownClient'
import { getNHLAnalysisData } from '@/lib/nhl/gameBreakdown'

export default async function NHLGameDetailPage({ params }: { params: { gameId: string } }) {
  let data = null
  try {
    data = await getNHLAnalysisData(params.gameId)
  } catch (err) {
    console.error(`[NHLGameDetailPage] failed to build NHL breakdown for ${params.gameId}:`, err)
  }

  if (data) {
    return <RealNHLGameBreakdownClient backHref="/games" data={data} />
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <div className="text-4xl">🏒</div>
      <div className="text-sm font-black text-text">NHL data temporarily unavailable</div>
      <p className="max-w-[280px] text-xs leading-relaxed text-muted">
        We couldn&apos;t load this game&apos;s breakdown right now. Try again shortly.
      </p>
      <Link href="/games" className="rounded-full border border-accent/40 bg-accent/15 px-5 py-2 text-[11px] font-bold text-accent">
        ← Back to Games
      </Link>
    </div>
  )
}
