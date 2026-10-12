import Link from 'next/link'
import { sportMeta } from '@/lib/sport/meta'
import type { Article } from '@/lib/articles/types'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function ArticleCard({ article, className = '' }: { article: Article; className?: string }) {
  const meta = article.sport ? sportMeta(article.sport) : null

  return (
    <Link
      href={`/articles/${article.slug}`}
      className={`block shrink-0 rounded-[14px] border border-border bg-card p-3.5 transition-colors hover:border-border2 ${className}`}
      style={meta ? { borderTop: `3px solid ${meta.color}` } : undefined}
    >
      <div className="mb-2 flex items-center gap-1.5">
        {meta && (
          <span className="rounded-full px-1.5 py-0.5 text-[9px] font-bold" style={{ background: `${meta.color}22`, color: meta.color }}>
            {meta.icon} {meta.label}
          </span>
        )}
        {article.category && <span className="rounded-full border border-border px-1.5 py-0.5 text-[9px] font-semibold text-muted">{article.category}</span>}
      </div>
      <h3 className="mb-1.5 text-[14px] font-extrabold leading-snug text-text">{article.title}</h3>
      {article.excerpt && <p className="mb-2.5 line-clamp-3 text-[11px] leading-relaxed text-text2">{article.excerpt}</p>}
      <div className="flex items-center gap-2 text-[10px] text-muted">
        <span>{formatDate(article.published_at)}</span>
        <span>·</span>
        <span>{article.read_time_minutes} min read</span>
      </div>
    </Link>
  )
}
