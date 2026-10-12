import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import '@/styles/globals.css'
import { AccountDataProvider } from '@/lib/account/AccountDataContext'
import { Providers } from '@/app/providers'
import { AuthProvider } from '@/lib/auth/AuthContext'
import { ParlayProvider } from '@/lib/parlay/ParlayContext'
import { SportProvider } from '@/lib/sport/SportContext'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'SharpSlip',
  description: 'Sports betting research, game breakdowns, and player insights.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-background text-text`}>
        <Providers>
        <AuthProvider>
          <AccountDataProvider>
            <SportProvider>
              <ParlayProvider>{children}</ParlayProvider>
            </SportProvider>
          </AccountDataProvider>
        </AuthProvider>
        </Providers>
      </body>
    </html>
  )
}
