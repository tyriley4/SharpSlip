import Link from 'next/link'
import { BottomNav } from '@/components/layout/BottomNav'

export function DetailShell({
  backHref,
  title,
  children,
}: {
  backHref: string
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="mx-auto min-h-screen max-w-[540px] bg-background">
      <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-background/95 px-3.5 py-3.5 backdrop-blur">
        <Link href={backHref} className="text-lg text-text2">
          ←
        </Link>
        <span className="truncate text-[15px] font-bold text-text">{title}</span>
      </div>
      <main className="pb-24">{children}</main>
      <BottomNav />
    </div>
  )
}
