import { redirect } from 'next/navigation'
import { isAuthenticated } from '@/lib/auth'
import AnalyticsClient from './AnalyticsClient'

export default async function AnalyticsPage() {
  const authenticated = await isAuthenticated()

  if (!authenticated) {
    redirect('/')
  }

  return <AnalyticsClient />
}
