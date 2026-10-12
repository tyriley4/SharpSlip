'use client'

import Link from 'next/link'
import { SignOutButton } from '@/components/account/SignOutButton'
import { useAuth } from '@/lib/auth/AuthContext'

export function SidebarAuthStatus() {
  const { user, loading } = useAuth()

  if (loading) {
    return <div className="h-[72px] rounded-xl bg-card3" />
  }

  if (!user) {
    return (
      <div className="flex flex-col gap-2">
        <Link
          href="/login"
          className="rounded-lg border border-border py-2 text-center text-xs font-semibold text-text2 transition-colors hover:border-accent hover:text-text"
        >
          Log in
        </Link>
        <Link
          href="/signup"
          className="rounded-lg bg-accent py-2 text-center text-xs font-semibold text-white transition-opacity hover:opacity-90"
        >
          Sign up
        </Link>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-card p-2.5 transition-colors hover:border-border2">
      <div className="mb-2 flex items-center gap-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-accent2 text-[10px] font-black text-white">
          {user.email?.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[11px] font-semibold text-text">{user.email}</div>
          <Link href="/account" className="text-[10px] text-accent hover:underline">
            View account
          </Link>
        </div>
      </div>
      <SignOutButton />
    </div>
  )
}
