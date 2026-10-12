/** Next.js instrumentation hook: loads the Sentry server/edge configs (Sentry stays off unless a DSN is set). */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') await import('./sentry.server.config')
  if (process.env.NEXT_RUNTIME === 'edge') await import('./sentry.edge.config')
}
