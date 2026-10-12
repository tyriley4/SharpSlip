import { AppShell } from '@/components/layout/AppShell'

export default function StandingsLoading() {
  return (
    <AppShell>
      <div className="flex flex-col gap-3 px-3.5 pt-1 md:grid md:grid-cols-2 md:gap-6 md:px-0 md:pt-0">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-3">
            {Array.from({ length: 3 }).map((__, j) => (
              <div key={j} className="h-32 animate-pulse rounded-2xl border border-border bg-card" />
            ))}
          </div>
        ))}
      </div>
    </AppShell>
  )
}
