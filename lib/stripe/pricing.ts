export type BillingInterval = 'monthly' | 'yearly'

export const PRO_PRICE_IDS: Record<BillingInterval, string> = {
  monthly: (process.env.STRIPE_PRICE_PRO_MONTHLY ?? process.env.STRIPE_PRICE_ID_PRO_MONTHLY)!,
  yearly: (process.env.STRIPE_PRICE_PRO_YEARLY ?? process.env.STRIPE_PRICE_ID_PRO_YEARLY)!,
}

export const tiers = {
  free: {
    name: 'Free',
    description: 'Get a taste of SharpSlip research.',
    features: ['Daily game previews', 'Limited player pages', 'Community access'],
  },
  pro: {
    name: 'Pro',
    description: 'Full access to every breakdown, every tier.',
    features: [
      'Full MLB & NFL game breakdowns',
      'Complete player pages',
      'Sharp betting angles',
      'Priority support',
    ],
    price: {
      monthly: 9.99,
      yearly: 79.99,
    },
  },
} as const
