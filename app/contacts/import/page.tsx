import { redirect } from 'next/navigation'
import { isAuthenticated } from '@/lib/auth'
import ImportClient from './ImportClient'

export default async function ImportPage() {
  const authenticated = await isAuthenticated()

  if (!authenticated) {
    redirect('/')
  }

  return <ImportClient />
}
