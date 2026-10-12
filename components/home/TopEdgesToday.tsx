import Link from 'next/link'
import { EdgeResultCard } from '@/components/home/EdgeResultCard'
import type { TopEdgeResult } from '@/lib/home/topEdges'
import type { Sport } from '@/lib/sport/SportContext'

export function TopEdgesToday({ edges, sportFilter }: { edges: TopEdgeResult[]; sportFilter: Sport | 'all' }) {
  const relevant = sportFilter === 'all' ? edges : edges.filter((e) => e.sport === sportFilter)

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h2 className="section-header text-sm text-text md:text-base">Today&apos;s Top Edges</h2>
        <p className="text-[11px] text-muted">Auto-generated from real stats</p>
      </div>

      {relevant.length === 0 ? (
        <div className="rounded-[14px] border border-border bg-card py-10 text-center text-xs text-muted">No qualifying insights for today&apos;s games yet.</div>
      ) : (
        <div className="flex gap-2.5 overflow-x-auto pb-1 [scrollbar-width:none] lg:flex-col lg:overflow-visible [&::-webkit-scrollbar]:hidden">
          {relevant.map((r) => (
            <EdgeResultCard key={`${r.sport}-${r.gameId}-${r.edge.id}`} result={r} className="w-[260px] shrink-0 lg:w-auto" />
          ))}
        </div>
      )}

      <Link href="/edges" className="text-[11px] font-semibold text-accent">
        See all edges →
      </Link>
    </div>
  )
}
