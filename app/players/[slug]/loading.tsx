import { AppShell } from '@/components/layout/AppShell'

export default function PlayerLoading() {
  return (
    <AppShell>
      <div className="flex flex-col gap-3 px-3.5 pt-1 md:gap-4 md:px-0 md:pt-0">
        <div className="h-24 animate-pulse rounded-2xl border border-border bg-card md:h-32" />
        <div className="h-64 animate-pulse rounded-2xl border border-border bg-card" />
      </div>
    </AppShell>
  )
}
