import Link from 'next/link'
import { EdgeResultCard } from '@/components/home/EdgeResultCard'
import { Drawer } from '@/components/ui/Drawer'
import { filterBestBets } from '@/lib/home/bestBets'
import type { TopEdgeResult } from '@/lib/home/topEdges'
import { useAccountData } from '@/lib/account/AccountDataContext'

export function BestBetsDrawer({ edges, onClose }: { edges: TopEdgeResult[]; onClose: () => void }) {
  const { settings } = useAccountData()
  const { results, personalized } = filterBestBets(edges, settings)

  return (
    <Drawer title="Best Bets for You" subtitle="Statistical insights matching your preferences" onClose={onClose}>
      {!personalized && (
        <div className="mb-3 rounded-xl border border-accent/25 bg-accent/[0.06] p-3 text-[11px] leading-relaxed text-text2">
          Set your preferences in{' '}
          <Link href="/account" className="font-semibold text-accent" onClick={onClose}>
            Account → Settings
          </Link>{' '}
          to personalize which insights appear here.
        </div>
      )}

      {results.length === 0 ? (
        <div className="rounded-[14px] border border-border bg-card3 py-10 text-center text-xs text-muted">
          No insights match your preferences today — check back later or adjust your settings.
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {results.map((r) => (
            <EdgeResultCard key={`${r.sport}-${r.gameId}-${r.edge.id}`} result={r} onClick={onClose} />
          ))}
        </div>
      )}
    </Drawer>
  )
}
