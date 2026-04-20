import { redirect } from 'next/navigation'
import { isAuthenticated } from '@/lib/auth'
import CampaignDetailClient from './CampaignDetailClient'

export default async function CampaignDetailPage({ params }: { params: { id: string } }) {
  const authenticated = await isAuthenticated()
  if (!authenticated) redirect('/')
  return <CampaignDetailClient campaignId={params.id} />
}
