import Link from 'next/link'
import { AccountView } from '@/components/account/AccountView'
import { AppShell } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { createClient } from '@/lib/supabase/server'

export default async function AccountPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const profile = user
    ? (
        await supabase
          .from('users')
          .select('email, tier, is_admin, created_at')
          .eq('id', user.id)
          .single()
      ).data
    : null

  return (
    <AppShell>
      <div className="flex flex-col gap-4 px-3.5 pt-1 md:px-0 md:pt-0">
        {profile ? (
          <AccountView profile={profile} />
        ) : (
          <Card className="flex flex-col gap-3 md:max-w-sm">
            <p className="text-sm text-text2">Log in to see your account and picks.</p>
            <Link href="/login">
              <Button>Log in</Button>
            </Link>
            <Link href="/signup" className="text-center text-sm font-medium text-accent">
              Create an account
            </Link>
          </Card>
        )}
      </div>
    </AppShell>
  )
}
