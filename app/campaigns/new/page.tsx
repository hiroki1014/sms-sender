import { redirect } from 'next/navigation'
import { isAuthenticated } from '@/lib/auth'
import CampaignFormClient from './CampaignFormClient'

export default async function NewCampaignPage() {
  const authenticated = await isAuthenticated()

  if (!authenticated) {
    redirect('/')
  }

  return <CampaignFormClient />
}
