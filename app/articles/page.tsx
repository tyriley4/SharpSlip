import { ArticlesPageClient } from '@/components/articles/ArticlesPageClient'
import { getAllArticles } from '@/lib/articles/getArticles'

export const revalidate = 300

export default async function ArticlesPage() {
  const articles = await getAllArticles()
  return <ArticlesPageClient articles={articles} />
}
