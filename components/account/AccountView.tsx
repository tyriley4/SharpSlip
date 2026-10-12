'use client'

import { AccountTabs } from '@/components/account/AccountTabs'
import { ProfileCard, type ProfileData } from '@/components/account/ProfileCard'
import { BetsProvider } from '@/lib/account/BetsContext'

/** Signed-in Account page: profile header (with live bet stats) above the Bet Tracker / Favorites / Settings tabs. */
export function AccountView({ profile }: { profile: ProfileData }) {
  return (
    <BetsProvider>
      <div className="flex flex-col gap-4">
        <ProfileCard profile={profile} />
        <AccountTabs />
      </div>
    </BetsProvider>
  )
}
