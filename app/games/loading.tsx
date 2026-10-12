import { AppShell } from '@/components/layout/AppShell'

export default function GamesLoading() {
  return (
    <AppShell>
      <div className="flex flex-col gap-4 px-3.5 pt-1 md:gap-6 md:px-0 md:pt-0">
        <div className="h-6 w-40 animate-pulse rounded-md bg-card3" />
        <div className="flex flex-col gap-2.5 md:grid md:grid-cols-2 md:gap-4 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-[92px] animate-pulse rounded-2xl border border-border bg-card" />
          ))}
        </div>
      </div>
    </AppShell>
  )
}
