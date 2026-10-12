'use client'

import { useRouter } from 'next/navigation'

export function PlayerComingSoon({ slug, team }: { slug: string; team?: string }) {
  const router = useRouter()
  const displayName = slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')

  return (
    <div className="px-6 py-14 text-center">
      <button
        onClick={() => router.back()}
        className="mx-auto mb-6 flex h-8 w-8 items-center justify-center rounded-[10px] border border-border bg-card3 text-base text-text2 transition-colors hover:border-border2 hover:text-text"
      >
        ←
      </button>
      <div className="mb-4 text-5xl">🏃</div>
      <div className="mb-1 text-lg font-black text-text">{displayName}</div>
      {team && (
        <div className="mb-3 inline-block rounded-md bg-card3 px-2 py-0.5 text-[11px] font-bold text-text2">
          {team}
        </div>
      )}
      <div className="mb-2 text-sm font-extrabold text-text">Player Profile Coming Soon</div>
      <div className="mx-auto mb-6 max-w-[320px] text-xs leading-relaxed text-muted">
        We don&apos;t have a full profile for <span className="font-semibold text-text2">{displayName}</span> yet.
        We&apos;re building out our player database — check back soon for stats, prop trends, and matchup history.
      </div>
      <div className="inline-block rounded-full border border-accent/40 bg-accent/15 px-5 py-2 text-[11px] font-bold text-accent">
        In Development
      </div>
    </div>
  )
}
