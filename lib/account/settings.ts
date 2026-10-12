import { createClient } from '@/lib/supabase/client'
import { BET_TYPE_PREFERENCES, DEFAULT_SETTINGS, type BetTypePreference, type UserSettings } from './types'

/** Reads the multi-select list, migrating the old single-value setting ('Player Prop' → 'Player Props'). */
function normalizeBetTypes(raw: Partial<UserSettings> & { betTypePreference?: string }): BetTypePreference[] {
  const valid = (v: unknown): v is BetTypePreference => (BET_TYPE_PREFERENCES as readonly string[]).includes(v as string)
  if (Array.isArray(raw.betTypePreferences)) return raw.betTypePreferences.filter(valid)
  const legacy = raw.betTypePreference === 'Player Prop' ? 'Player Props' : raw.betTypePreference
  return valid(legacy) ? [legacy] : []
}

export async function fetchSettings(userId: string): Promise<UserSettings> {
  const supabase = createClient()
  const { data, error } = await supabase.from('users').select('settings').eq('id', userId).single()

  if (error || !data?.settings || Object.keys(data.settings).length === 0) {
    if (error) console.error('[account/settings] fetchSettings failed:', error.message)
    return DEFAULT_SETTINGS
  }

  const raw = data.settings as Partial<UserSettings> & { betTypePreference?: string }
  return {
    sportsbook: raw.sportsbook ?? DEFAULT_SETTINGS.sportsbook,
    oddsFormat: raw.oddsFormat ?? DEFAULT_SETTINGS.oddsFormat,
    edgeThreshold: raw.edgeThreshold ?? DEFAULT_SETTINGS.edgeThreshold,
    notifications: { ...DEFAULT_SETTINGS.notifications, ...raw.notifications },
    betTypePreferences: normalizeBetTypes(raw),
    riskTolerance: raw.riskTolerance ?? DEFAULT_SETTINGS.riskTolerance,
  }
}

export async function saveSettings(userId: string, settings: UserSettings): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase.from('users').update({ settings }).eq('id', userId)
  if (error) {
    console.error('[account/settings] saveSettings failed:', error.message)
    return false
  }
  return true
}
