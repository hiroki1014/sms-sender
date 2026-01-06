import { redirect } from 'next/navigation'
import { isAuthenticated } from '@/lib/auth'
import ContactsClient from './ContactsClient'

export default async function ContactsPage() {
  const authenticated = await isAuthenticated()

  if (!authenticated) {
    redirect('/')
  }

  return <ContactsClient />
}
