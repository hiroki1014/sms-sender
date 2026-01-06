'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui'
import { Alert } from '@/components/ui'
import { LockKey, ArrowRight } from '@phosphor-icons/react'

export default function LoginForm() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || '認証に失敗しました')
        return
      }

      router.push('/dashboard')
      router.refresh()
    } catch {
      setError('エラーが発生しました')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-gray-700">
          パスワード
        </label>
        <div className="relative">
          <LockKey className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 text-sm bg-white border border-gray-300 rounded transition-all duration-150 placeholder:text-gray-400 hover:border-gray-400 focus:border-accent-400 focus:ring-2 focus:ring-accent-400/20 focus:outline-none"
            placeholder="パスワードを入力"
            required
          />
        </div>
      </div>

      {error && (
        <Alert variant="error">{error}</Alert>
      )}

      <Button
        type="submit"
        loading={isLoading}
        className="w-full h-10"
        icon={!isLoading ? <ArrowRight className="w-4 h-4" /> : undefined}
      >
        {isLoading ? 'ログイン中...' : 'ログイン'}
      </Button>
    </form>
  )
}
