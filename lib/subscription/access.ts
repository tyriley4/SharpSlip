export interface ProfileAccess {
  tier: string
  is_admin: boolean
}

export function hasProAccess(profile: ProfileAccess | null | undefined): boolean {
  if (!profile) return false
  return profile.is_admin || profile.tier === 'pro' || profile.tier === 'premium'
}
