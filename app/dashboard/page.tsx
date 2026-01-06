import { redirect } from 'next/navigation'
import { isAuthenticated } from '@/lib/auth'
import DashboardClient from './DashboardClient'

export default async function DashboardPage() {
  const authenticated = await isAuthenticated()

  if (!authenticated) {
    redirect('/')
  }

  return <DashboardClient />
}
