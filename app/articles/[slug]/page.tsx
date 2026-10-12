import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArticleCard } from '@/components/articles/ArticleCard'
import { AppShell } from '@/components/layout/AppShell'
import { getArticleBySlug, getRelatedArticles } from '@/lib/articles/getArticles'
import { sportMeta } from '@/lib/sport/meta'

export const revalidate = 300

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

export default async function ArticlePage({ params }: { params: { slug: string } }) {
  const article = await getArticleBySlug(params.slug)
  if (!article) notFound()

  const related = await getRelatedArticles(article.sport, article.slug)
  const meta = article.sport ? sportMeta(article.sport) : null
  const paragraphs = (article.content ?? '').split('\n\n').filter(Boolean)

  return (
    <AppShell>
      <div className="flex flex-col gap-4 px-3.5 pt-1 md:px-0 md:pt-0 md:max-w-2xl">
        <Link href="/articles" className="flex w-fit items-center gap-1.5 text-xs font-semibold text-muted hover:text-text">
          ← Back to Insights
        </Link>

        <div>
          <div className="mb-2 flex items-center gap-1.5">
            {meta && (
              <span className="rounded-full px-1.5 py-0.5 text-[9px] font-bold" style={{ background: `${meta.color}22`, color: meta.color }}>
                {meta.icon} {meta.label}
              </span>
            )}
            {article.category && <span className="rounded-full border border-border px-1.5 py-0.5 text-[9px] font-semibold text-muted">{article.category}</span>}
          </div>
          <h1 className="mb-2 text-xl font-black leading-tight text-text md:text-3xl">{article.title}</h1>
          <div className="flex items-center gap-2 text-[11px] text-muted">
            <span>{article.author}</span>
            <span>·</span>
            <span>{formatDate(article.published_at)}</span>
            <span>·</span>
            <span>{article.read_time_minutes} min read</span>
          </div>
        </div>

        <div className="flex flex-col gap-4 text-[14px] leading-relaxed text-text2 md:text-[15px]">
          {paragraphs.length > 0 ? paragraphs.map((p, i) => <p key={i}>{p}</p>) : <p className="text-muted">This article has no content yet.</p>}
        </div>

        {related.length > 0 && (
          <div className="mt-4 border-t border-border pt-4">
            <div className="mb-3 text-[10px] font-extrabold tracking-[0.1em] text-muted">MORE {meta?.label}</div>
            <div className="flex flex-col gap-2.5 md:grid md:grid-cols-3">
              {related.map((a) => (
                <ArticleCard key={a.id} article={a} />
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}
