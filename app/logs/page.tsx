import { redirect } from 'next/navigation'
import { isAuthenticated } from '@/lib/auth'
import LogsClient from './LogsClient'

export default async function LogsPage() {
  const authenticated = await isAuthenticated()

  if (!authenticated) {
    redirect('/')
  }

  return <LogsClient />
}
