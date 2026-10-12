import * as Sentry from '@sentry/nextjs'

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN
const enabled = !!dsn && dsn !== 'placeholder'

Sentry.init({
  dsn: enabled ? dsn : undefined,
  tracesSampleRate: 0.1,
  debug: false,
  enabled,
})
