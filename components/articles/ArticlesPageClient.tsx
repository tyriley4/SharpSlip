'use client'

import { useMemo, useState } from 'react'
import { ArticleCard } from '@/components/articles/ArticleCard'
import { AppShell } from '@/components/layout/AppShell'
import { Input } from '@/components/ui/Input'
import { PillTabs } from '@/components/ui/PillTabs'
import type { Article } from '@/lib/articles/types'
import { SPORT_META } from '@/lib/sport/meta'

const SPORT_FILTERS = ['All', ...Object.values(SPORT_META).map((m) => m.label)]

export function ArticlesPageClient({ articles }: { articles: Article[] }) {
  const [sportFilter, setSportFilter] = useState('All')
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    return articles.filter((a) => {
      if (sportFilter !== 'All') {
        const meta = a.sport ? SPORT_META[a.sport as keyof typeof SPORT_META] : null
        if (meta?.label !== sportFilter) return false
      }
      if (query.trim() && !a.title.toLowerCase().includes(query.trim().toLowerCase())) return false
      return true
    })
  }, [articles, sportFilter, query])

  return (
    <AppShell>
      <div className="flex flex-col gap-4 px-3.5 pt-1 md:px-0 md:pt-0">
        <h1 className="text-lg font-extrabold text-text md:text-2xl">SharpSlip Insights</h1>

        <Input placeholder="Search articles…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <PillTabs options={SPORT_FILTERS} active={sportFilter} onChange={setSportFilter} />

        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card py-10 text-center text-xs text-muted">No articles match your search.</div>
        ) : (
          <div className="flex flex-col gap-2.5 md:grid md:grid-cols-3 md:gap-4">
            {filtered.map((a) => (
              <ArticleCard key={a.id} article={a} />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  )
}
