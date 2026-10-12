import { Suspense } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { PricingClient } from '@/components/pricing/PricingClient'
import { createClient } from '@/lib/supabase/server'

export default async function PricingPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const profile = user
    ? (await supabase.from('users').select('tier, is_admin').eq('id', user.id).single()).data
    : null

  return (
    <AppShell>
      <Suspense>
        <PricingClient isLoggedIn={!!user} profile={profile} />
      </Suspense>
    </AppShell>
  )
}
