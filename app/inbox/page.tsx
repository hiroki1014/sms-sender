import { redirect } from 'next/navigation'
import { isAuthenticated } from '@/lib/auth'
import InboxClient from './InboxClient'

export default async function InboxPage() {
  const authenticated = await isAuthenticated()
  if (!authenticated) redirect('/')
  return <InboxClient />
}
