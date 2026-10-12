'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { SignOutButton } from '@/components/account/SignOutButton'
import { computeBetStats } from '@/lib/account/betStats'
import { useBets } from '@/lib/account/BetsContext'

export interface ProfileData {
  email: string
  tier: string
  is_admin: boolean
  created_at: string
}

function initials(email: string): string {
  const local = email.split('@')[0] ?? email
  const parts = local.split(/[._\-+\s]+/).filter(Boolean)
  const letters = parts.length >= 2 ? parts[0][0] + parts[1][0] : local.slice(0, 2)
  return letters.toUpperCase()
}

function displayName(email: string): string {
  const local = email.split('@')[0] ?? email
  return local
    .split(/[._\-+]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ')
}

const sign = (n: number) => (n > 0 ? '+' : n < 0 ? '-' : '')

/** Dark premium profile header: avatar, name, tier pill, member-since, and the headline betting stats. */
export function ProfileCard({ profile }: { profile: ProfileData }) {
  const { bets } = useBets()
  const stats = useMemo(() => computeBetStats(bets), [bets])
  const pro = profile.tier === 'pro' || profile.is_admin
  const settled = stats.wins + stats.losses + stats.pushes > 0

  const items = [
    { label: 'Total Bets', value: String(stats.total), color: 'text-text' },
    { label: 'Win Rate', value: settled ? `${stats.winRate}%` : '—', color: !settled ? 'text-muted' : stats.winRate >= 55 ? 'text-win' : stats.winRate >= 50 ? 'text-text' : 'text-loss' },
    { label: 'ROI', value: settled ? `${sign(stats.roi)}${Math.abs(stats.roi)}%` : '—', color: !settled ? 'text-muted' : stats.roi > 0 ? 'text-win' : stats.roi < 0 ? 'text-loss' : 'text-text' },
    { label: 'Units Profit', value: settled ? `${sign(stats.units)}${Math.abs(stats.units)}u` : '—', color: !settled ? 'text-muted' : stats.units > 0 ? 'text-win' : stats.units < 0 ? 'text-loss' : 'text-text' },
  ]

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card" style={{ borderLeft: '4px solid #3B9EFF' }}>
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 md:p-5">
        <div className="flex min-w-0 items-center gap-3.5">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent2 text-lg font-black text-white shadow-[0_0_18px_rgba(59,158,255,0.35)]">
            {initials(profile.email)}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-[18px] font-extrabold leading-tight text-white">{displayName(profile.email)}</h1>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold tracking-wide ${
                  pro ? 'bg-accent text-white shadow-[0_0_12px_rgba(59,158,255,0.55)]' : 'bg-card3 text-muted'
                }`}
              >
                {profile.is_admin ? 'ADMIN' : profile.tier.toUpperCase()}
              </span>
            </div>
            <div className="truncate text-[12px] text-muted">{profile.email}</div>
            <div className="mt-0.5 text-[10px] text-muted">Member since {new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {!pro && (
            <Link href="/pricing" className="text-[12px] font-bold text-accent hover:underline">
              Upgrade to Pro →
            </Link>
          )}
          <SignOutButton />
        </div>
      </div>

      <div className="grid grid-cols-4 border-t border-border bg-card2">
        {items.map((it, i) => (
          <div key={it.label} className={`px-1.5 py-3 text-center md:py-4 ${i > 0 ? 'border-l border-border' : ''}`}>
            <div className={`stat-number text-[1.05rem] leading-tight md:text-2xl ${it.color}`}>{it.value}</div>
            <div className="mt-1 text-[9px] font-bold uppercase tracking-[0.08em] text-muted md:text-[10px]">{it.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
