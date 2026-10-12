import Link from 'next/link'
import { ArticleCard } from '@/components/articles/ArticleCard'
import type { Article } from '@/lib/articles/types'
import type { Sport } from '@/lib/sport/SportContext'

export function FeaturedArticles({ articles, sportFilter }: { articles: Article[]; sportFilter: Sport | 'all' }) {
  const relevant = sportFilter === 'all' ? articles : articles.filter((a) => a.sport === sportFilter)
  if (relevant.length === 0) return null

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="section-header text-sm text-text md:text-base">SharpSlip Insights</h2>
        <Link href="/articles" className="text-[11px] font-semibold text-accent">
          See all →
        </Link>
      </div>
      <div className="flex gap-2.5 overflow-x-auto pb-1 [scrollbar-width:none] md:grid md:grid-cols-3 md:gap-4 md:overflow-visible [&::-webkit-scrollbar]:hidden">
        {relevant.slice(0, 3).map((a) => (
          <ArticleCard key={a.id} article={a} className="w-[220px] md:w-auto" />
        ))}
      </div>
    </div>
  )
}
