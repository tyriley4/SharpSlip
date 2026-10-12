import { AppShell } from '@/components/layout/AppShell'

export default function HomeLoading() {
  return (
    <AppShell>
      <div className="flex flex-col gap-5 px-3.5 pt-1 md:gap-8 md:px-0 md:pt-0">
        <div className="h-32 animate-pulse rounded-2xl border border-border bg-card md:h-40" />
        <div className="flex flex-col gap-5 md:grid md:grid-cols-2 md:gap-8">
          <div className="h-48 animate-pulse rounded-2xl border border-border bg-card" />
          <div className="h-48 animate-pulse rounded-2xl border border-border bg-card" />
        </div>
      </div>
    </AppShell>
  )
}
