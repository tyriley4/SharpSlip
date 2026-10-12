export interface Article {
  id: string
  title: string
  slug: string
  sport: string | null
  category: string | null
  excerpt: string | null
  content: string | null
  author: string
  published_at: string
  is_published: boolean
  read_time_minutes: number
  created_at: string
}
