import { NextResponse, type NextRequest } from 'next/server'
import { PRO_PRICE_IDS, type BillingInterval } from '@/lib/stripe/pricing'
import { stripe } from '@/lib/stripe/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user || !user.email) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { interval } = (await request.json()) as { interval?: BillingInterval }

  if (interval !== 'monthly' && interval !== 'yearly') {
    return NextResponse.json({ error: 'Invalid billing interval' }, { status: 400 })
  }

  const { data: existing } = await supabase
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .not('stripe_customer_id', 'is', null)
    .limit(1)
    .maybeSingle()

  let customerId = existing?.stripe_customer_id as string | undefined

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { supabase_user_id: user.id },
    })
    customerId = customer.id

    await supabase.from('subscriptions').insert({
      user_id: user.id,
      stripe_customer_id: customerId,
      tier: 'free',
      status: 'incomplete',
    })
  }

  const origin = request.headers.get('origin') ?? new URL(request.url).origin

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: PRO_PRICE_IDS[interval], quantity: 1 }],
    success_url: `${origin}/pricing?success=true`,
    cancel_url: `${origin}/pricing?canceled=true`,
    metadata: { supabase_user_id: user.id },
  })

  return NextResponse.json({ url: session.url })
}
