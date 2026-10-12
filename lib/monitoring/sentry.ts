import * as Sentry from '@sentry/nextjs'

/** A DSN that is missing or still "placeholder" means error reporting is off. */
export const sentryEnabled = (): boolean => {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN
  return !!dsn && dsn !== 'placeholder'
}

/** Reports an error to Sentry when configured; silently does nothing otherwise and never throws. */
export function reportError(error: unknown, context?: string): void {
  if (!sentryEnabled()) return
  try {
    Sentry.captureException(error, context ? { tags: { area: context } } : undefined)
  } catch {
    /* monitoring must never break the app */
  }
}
