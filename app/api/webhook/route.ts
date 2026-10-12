import { NextResponse, type NextRequest } from 'next/server'
import Stripe from 'stripe'
import { PRO_PRICE_IDS } from '@/lib/stripe/pricing'
import { stripe } from '@/lib/stripe/server'
import { createAdminClient } from '@/lib/supabase/admin'

const PRO_PRICE_ID_SET = new Set(Object.values(PRO_PRICE_IDS))

function mapStripeStatus(status: Stripe.Subscription.Status) {
  switch (status) {
    case 'active':
    case 'trialing':
    case 'past_due':
    case 'canceled':
    case 'incomplete':
      return status
    case 'unpaid':
    case 'paused':
      return 'past_due'
    case 'incomplete_expired':
      return 'canceled'
  }
}

async function syncSubscription(subscription: Stripe.Subscription) {
  const customerId =
    typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id
  const priceId = subscription.items.data[0]?.price.id
  const tier = priceId && PRO_PRICE_ID_SET.has(priceId) ? 'pro' : 'free'
  const status = mapStripeStatus(subscription.status)
  const isActive = status === 'active' || status === 'trialing'

  const supabase = createAdminClient()

  await supabase
    .from('subscriptions')
    .update({ tier, status, updated_at: new Date().toISOString() })
    .eq('stripe_customer_id', customerId)

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('user_id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle()

  if (sub?.user_id) {
    await supabase
      .from('users')
      .update({ tier: isActive ? tier : 'free' })
      .eq('id', sub.user_id)
  }
}

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: `Webhook signature verification failed: ${message}` }, { status: 400 })
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      if (session.subscription) {
        const subscriptionId =
          typeof session.subscription === 'string' ? session.subscription : session.subscription.id
        const subscription = await stripe.subscriptions.retrieve(subscriptionId)
        await syncSubscription(subscription)
      }
      break
    }
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      await syncSubscription(event.data.object as Stripe.Subscription)
      break
    }
  }

  return NextResponse.json({ received: true })
}
