import { redirect } from 'next/navigation'
import { isAuthenticated } from '@/lib/auth'
import CampaignsClient from './CampaignsClient'

export default async function CampaignsPage() {
  const authenticated = await isAuthenticated()

  if (!authenticated) {
    redirect('/')
  }

  return <CampaignsClient />
}
