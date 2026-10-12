import { AppShell } from '@/components/layout/AppShell'

export default function TeamLoading() {
  return (
    <AppShell>
      <div className="flex flex-col gap-4 px-3.5 pt-1 md:px-0 md:pt-0">
        <div className="h-40 animate-pulse rounded-2xl border border-border bg-card" />
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-[72px] animate-pulse rounded-xl border border-border bg-card" />
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-2xl border border-border bg-card" />
      </div>
    </AppShell>
  )
}
