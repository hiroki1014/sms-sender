import { redirect } from 'next/navigation'
import { isAuthenticated } from '@/lib/auth'
import LoginForm from '@/components/LoginForm'

export default async function LoginPage() {
  const authenticated = await isAuthenticated()

  if (authenticated) {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow-md">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">SMS一括送信</h1>
          <p className="mt-2 text-gray-600">
            ログインしてください
          </p>
        </div>
        <LoginForm />
      </div>
    </div>
  )
}
