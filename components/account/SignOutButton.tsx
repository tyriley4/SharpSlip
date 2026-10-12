'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function SignOutButton() {
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <button
      onClick={handleSignOut}
      className="rounded-lg border border-border bg-card3 px-3 py-1.5 text-xs font-semibold text-text2 transition-colors hover:border-border2 hover:text-text"
    >
      Sign out
    </button>
  )
}
