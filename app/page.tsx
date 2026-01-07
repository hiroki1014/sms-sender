import { redirect } from 'next/navigation'
import { isAuthenticated } from '@/lib/auth'
import LoginForm from '@/components/LoginForm'
import { PaperPlaneTilt } from '@phosphor-icons/react/dist/ssr'

export default async function LoginPage() {
  const authenticated = await isAuthenticated()

  if (authenticated) {
    redirect('/campaigns')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm">
        {/* Logo Card */}
        <div className="bg-white rounded-md border border-gray-200 p-8">
          {/* Icon + Title */}
          <div className="text-center mb-8">
            <div className="w-12 h-12 bg-accent-50 rounded-lg flex items-center justify-center mx-auto mb-4">
              <PaperPlaneTilt className="w-6 h-6 text-accent-500" weight="fill" />
            </div>
            <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">
              SMS一括送信
            </h1>
            <p className="mt-1.5 text-sm text-gray-500">
              ログインしてください
            </p>
          </div>

          <LoginForm />
        </div>

        {/* Footer */}
        <p className="mt-4 text-center text-xs text-gray-400">
          SMS Bulk Sender v1.0
        </p>
      </div>
    </div>
  )
}
