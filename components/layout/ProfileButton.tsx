'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth/AuthContext'
import { createClient } from '@/lib/supabase/client'

const tierCache = new Map<string, boolean>()

function initialsOf(name: string | undefined, email: string | undefined): string {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (words.length >= 2) return (words[0][0] + words[words.length - 1][0]).toUpperCase()
  if (words.length === 1 && words[0].length >= 2) return words[0].slice(0, 2).toUpperCase()
  const local = (email ?? '').split('@')[0]
  const parts = local.split(/[._\-+\s]+/).filter(Boolean)
  return (parts.length >= 2 ? parts[0][0] + parts[1][0] : local.slice(0, 2)).toUpperCase() || '?'
}

/** Whether the signed-in user is on the Pro tier (or an admin). Fails quietly to "not pro". */
function useIsPro(userId: string | undefined): boolean {
  const [pro, setPro] = useState(userId ? (tierCache.get(userId) ?? false) : false)
  useEffect(() => {
    if (!userId) {
      setPro(false)
      return
    }
    if (tierCache.has(userId)) {
      setPro(tierCache.get(userId) as boolean)
      return
    }
    let cancelled = false
    createClient()
      .from('users')
      .select('tier, is_admin')
      .eq('id', userId)
      .single()
      .then(
        ({ data }: { data: { tier?: string; is_admin?: boolean } | null }) => {
          const isPro = data?.tier === 'pro' || !!data?.is_admin
          tierCache.set(userId, isPro)
          if (!cancelled) setPro(isPro)
        },
        () => undefined
      )
    return () => {
      cancelled = true
    }
  }, [userId])
  return pro
}

/** Top-right profile shortcut on every page: initials when signed in (gold ring for Pro), a person icon when not. Always opens /account. */
export function ProfileButton({ className = '' }: { className?: string }) {
  const { user, loading } = useAuth()
  const pro = useIsPro(user?.id)
  const meta = (user?.user_metadata ?? {}) as { full_name?: string; name?: string }
  const signedIn = !!user && !loading

  return (
    <Link
      href="/account"
      aria-label={signedIn ? 'Your account' : 'Account — log in or sign up'}
      data-profile-button
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[12px] font-extrabold transition-opacity hover:opacity-90 ${
        signedIn ? 'bg-accent text-white' : 'border border-border bg-[#111318] text-text2'
      } ${signedIn && pro ? 'ring-2 ring-[#F5C542]/80 ring-offset-2 ring-offset-background' : ''} ${className}`}
    >
      {signedIn ? (
        initialsOf(meta.full_name ?? meta.name, user?.email)
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" />
        </svg>
      )}
    </Link>
  )
}
