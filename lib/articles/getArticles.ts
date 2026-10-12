import { createClient } from '@/lib/supabase/server'
import type { Article } from './types'

export async function getFeaturedArticles(limit = 3): Promise<Article[]> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('articles')
      .select('*')
      .eq('is_published', true)
      .order('published_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('[getFeaturedArticles] Supabase error:', error.message)
      return []
    }
    return (data as Article[]) ?? []
  } catch (err) {
    console.error('[getFeaturedArticles] unexpected failure:', err)
    return []
  }
}

export async function getAllArticles(): Promise<Article[]> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('articles')
      .select('*')
      .eq('is_published', true)
      .order('published_at', { ascending: false })

    if (error) {
      console.error('[getAllArticles] Supabase error:', error.message)
      return []
    }
    return (data as Article[]) ?? []
  } catch (err) {
    console.error('[getAllArticles] unexpected failure:', err)
    return []
  }
}

export async function getArticleBySlug(slug: string): Promise<Article | null> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase.from('articles').select('*').eq('slug', slug).eq('is_published', true).maybeSingle()

    if (error) {
      console.error(`[getArticleBySlug] Supabase error for "${slug}":`, error.message)
      return null
    }
    return (data as Article | null) ?? null
  } catch (err) {
    console.error(`[getArticleBySlug] unexpected failure for "${slug}":`, err)
    return null
  }
}

export async function getRelatedArticles(sport: string | null, excludeSlug: string, limit = 3): Promise<Article[]> {
  if (!sport) return []
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('articles')
      .select('*')
      .eq('is_published', true)
      .eq('sport', sport)
      .neq('slug', excludeSlug)
      .order('published_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('[getRelatedArticles] Supabase error:', error.message)
      return []
    }
    return (data as Article[]) ?? []
  } catch (err) {
    console.error('[getRelatedArticles] unexpected failure:', err)
    return []
  }
}
