import { AppShell } from '@/components/layout/AppShell'

export default function LeadersLoading() {
  return (
    <AppShell>
      <div className="flex flex-col gap-3 px-3.5 pt-1 md:px-0 md:pt-0">
        <div className="h-9 w-full max-w-sm animate-pulse rounded-xl bg-card3" />
        <div className="h-80 animate-pulse rounded-2xl border border-border bg-card" />
      </div>
    </AppShell>
  )
}
