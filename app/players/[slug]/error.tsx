'use client'

import { SectionError } from '@/components/ui/SectionError'

export default function RouteError({ error }: { error: Error & { digest?: string } }) {
  return <SectionError error={error} area="route-error" />
}
