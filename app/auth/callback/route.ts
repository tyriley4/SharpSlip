import { NextResponse, type NextRequest } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null

  const supabase = createClient()
  let error: string | null = null

  if (code) {
    ;({ error } = await supabase.auth.exchangeCodeForSession(code).then(
      (r) => ({ error: r.error?.message ?? null }),
      (e) => ({ error: e instanceof Error ? e.message : 'Unknown error' })
    ))
  } else if (tokenHash && type) {
    ;({ error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type }).then(
      (r) => ({ error: r.error?.message ?? null }),
      (e) => ({ error: e instanceof Error ? e.message : 'Unknown error' })
    ))
  } else {
    error = 'Missing confirmation parameters'
  }

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error)}`)
  }

  return NextResponse.redirect(`${origin}/`)
}
