import { createClient } from '@/lib/supabase/server'
import type { PlayerRow } from '@/lib/players/types'

export async function getPlayerBySlug(slug: string): Promise<PlayerRow | null> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase.from('players').select('*').eq('slug', slug).maybeSingle()
    if (error) {
      console.error(`[getPlayerBySlug] Supabase error for "${slug}":`, error.message)
      return null
    }
    return (data as PlayerRow | null) ?? null
  } catch (err) {
    console.error(`[getPlayerBySlug] unexpected failure for "${slug}":`, err)
    return null
  }
}
