'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { tiers, type BillingInterval } from '@/lib/stripe/pricing'
import { hasProAccess, type ProfileAccess } from '@/lib/subscription/access'

export function PricingClient({
  isLoggedIn,
  profile,
}: {
  isLoggedIn: boolean
  profile: ProfileAccess | null
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [interval, setInterval] = useState<BillingInterval>('monthly')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isPro = hasProAccess(profile)
  const success = searchParams.get('success') === 'true'
  const canceled = searchParams.get('canceled') === 'true'

  async function handleUpgrade() {
    if (!isLoggedIn) {
      router.push('/login')
      return
    }

    setError(null)
    setLoading(true)

    const res = await fetch('/api/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ interval }),
    })

    const data = await res.json()

    if (!res.ok) {
      setError(data.error ?? 'Something went wrong')
      setLoading(false)
      return
    }

    window.location.href = data.url
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-center text-3xl font-bold text-text">Choose your plan</h1>
      <p className="mt-2 text-center text-text/60">
        Full MLB and NFL breakdowns, whenever you need them.
      </p>

      {success && (
        <p className="mt-6 rounded-lg border border-accent/30 bg-accent/10 p-3 text-center text-sm text-accent">
          You&apos;re all set — welcome to Pro.
        </p>
      )}
      {canceled && (
        <p className="mt-6 rounded-lg border border-white/10 bg-card p-3 text-center text-sm text-text/60">
          Checkout canceled — no charge was made.
        </p>
      )}
      {profile?.is_admin && (
        <p className="mt-6 rounded-lg border border-accent/30 bg-accent/10 p-3 text-center text-sm text-accent">
          You have admin access — full access regardless of plan.
        </p>
      )}

      <div className="mt-8 flex justify-center gap-2">
        <button
          onClick={() => setInterval('monthly')}
          className={`rounded-full px-4 py-1.5 text-sm ${
            interval === 'monthly' ? 'bg-accent text-background' : 'bg-card text-text/70'
          }`}
        >
          Monthly
        </button>
        <button
          onClick={() => setInterval('yearly')}
          className={`rounded-full px-4 py-1.5 text-sm ${
            interval === 'yearly' ? 'bg-accent text-background' : 'bg-card text-text/70'
          }`}
        >
          Yearly
        </button>
      </div>

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        <Card>
          <h2 className="text-lg font-semibold text-text">{tiers.free.name}</h2>
          <p className="mt-1 text-sm text-text/60">{tiers.free.description}</p>
          <p className="mt-4 text-2xl font-bold text-text">$0</p>
          <ul className="mt-4 space-y-2 text-sm text-text/70">
            {tiers.free.features.map((f) => (
              <li key={f}>• {f}</li>
            ))}
          </ul>
          {!isPro && (
            <p className="mt-6 text-center text-sm text-text/50">Current plan</p>
          )}
        </Card>

        <Card className="border-accent/40">
          <h2 className="text-lg font-semibold text-text">{tiers.pro.name}</h2>
          <p className="mt-1 text-sm text-text/60">{tiers.pro.description}</p>
          <p className="mt-4 text-2xl font-bold text-text">
            ${tiers.pro.price[interval]}
            <span className="text-sm font-normal text-text/50">
              /{interval === 'monthly' ? 'mo' : 'yr'}
            </span>
          </p>
          <ul className="mt-4 space-y-2 text-sm text-text/70">
            {tiers.pro.features.map((f) => (
              <li key={f}>• {f}</li>
            ))}
          </ul>
          {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
          {isPro ? (
            <p className="mt-6 text-center text-sm text-accent">Current plan</p>
          ) : (
            <Button className="mt-6" onClick={handleUpgrade} disabled={loading}>
              {loading ? 'Redirecting...' : 'Upgrade to Pro'}
            </Button>
          )}
        </Card>
      </div>
    </div>
  )
}
