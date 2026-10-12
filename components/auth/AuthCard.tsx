import Link from 'next/link'
import { ProfileButton } from '@/components/layout/ProfileButton'
import { Card } from '@/components/ui/Card'

export function AuthCard({
  title,
  children,
  footerText,
  footerLinkText,
  footerLinkHref,
}: {
  title: string
  children: React.ReactNode
  footerText: string
  footerLinkText: string
  footerLinkHref: string
}) {
  return (
    <main className="relative flex min-h-screen items-center justify-center bg-background px-4">
      <ProfileButton className="absolute right-3.5 top-3.5 md:right-6 md:top-5" />
      <Card className="w-full max-w-sm">
        <h1 className="mb-6 text-center text-2xl font-bold text-text">
          Sharp<span className="text-accent">Slip</span>
        </h1>
        <h2 className="mb-4 text-lg font-semibold text-text">{title}</h2>
        {children}
        <p className="mt-6 text-center text-sm text-text/60">
          {footerText}{' '}
          <Link href={footerLinkHref} className="text-accent hover:underline">
            {footerLinkText}
          </Link>
        </p>
      </Card>
    </main>
  )
}
