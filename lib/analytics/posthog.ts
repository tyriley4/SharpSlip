import PostHog from 'posthog-js'

/** A key that is missing or still the placeholder means analytics is switched off. */
const real = (v: string | undefined): v is string => !!v && v !== 'placeholder'

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST

let started = false
let warned = false

function configured(): boolean {
  if (real(KEY)) return true
  if (!warned && typeof window !== 'undefined') {
    warned = true
    console.info('PostHog not configured')
  }
  return false
}

export const initPostHog = () => {
  if (typeof window === 'undefined' || started || !configured()) return
  try {
    PostHog.init(KEY as string, {
      api_host: real(HOST) ? HOST : 'https://app.posthog.com',
      capture_pageview: false,
      capture_pageleave: true,
      // Handy in development for inspecting what is captured.
      loaded: (ph) => {
        if (process.env.NODE_ENV === 'development') (window as unknown as { posthog?: unknown }).posthog = ph
      },
    })
    started = true
  } catch {
    /* analytics must never break the app */
  }
}

export const trackEvent = (event: string, properties?: Record<string, unknown>) => {
  if (typeof window === 'undefined' || !configured()) return
  try {
    if (process.env.NODE_ENV === 'development') {
      const w = window as unknown as { __phEvents?: unknown[] }
      ;(w.__phEvents ??= []).push({ event, properties })
    }
    if (!started) initPostHog()
    if (started) PostHog.capture(event, properties)
  } catch {
    /* analytics must never break the app */
  }
}

export const trackPageView = (path: string) => {
  if (typeof window === 'undefined' || !configured()) return
  try {
    if (!started) initPostHog()
    if (started) PostHog.capture('$pageview', { $current_url: window.location.origin + path })
  } catch {
    /* ignore */
  }
}
