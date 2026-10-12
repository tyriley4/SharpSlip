import Link from 'next/link'
import { RealCFBGameBreakdownClient } from '@/components/breakdown/real-cfb/RealCFBGameBreakdownClient'
import { getCfbAnalysis, type CfbAnalysisData } from '@/lib/cfb/engine'

export default async function CfbGamePage({ params }: { params: { gameId: string } }) {
  let data: CfbAnalysisData | null = null
  try {
    data = await getCfbAnalysis(params.gameId)
  } catch (err) {
    console.error(`[CfbGamePage] failed to build breakdown for ${params.gameId}:`, err)
  }

  if (!data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <div className="text-4xl">🏈</div>
        <div className="text-sm font-black text-text">Game breakdown temporarily unavailable</div>
        <p className="max-w-[300px] text-xs leading-relaxed text-muted">ESPN didn&apos;t return data for this game. Try again in a minute, or pick another game from the slate.</p>
        <Link href="/games" className="rounded-full border border-accent/40 bg-accent/15 px-5 py-2 text-[11px] font-bold text-accent">
          ← Back to Games
        </Link>
      </div>
    )
  }
  return <RealCFBGameBreakdownClient backHref="/games" data={data} />
}
