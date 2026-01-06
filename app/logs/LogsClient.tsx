'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import LogsTable from '@/components/LogsTable'
import { SmsLog } from '@/lib/supabase'

export default function LogsClient() {
  const router = useRouter()
  const [logs, setLogs] = useState<SmsLog[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchLogs = async () => {
    setIsLoading(true)
    setError('')

    try {
      const res = await fetch('/api/logs')
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'ログの取得に失敗しました')
        return
      }

      setLogs(data.logs)
    } catch {
      setError('エラーが発生しました')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchLogs()
  }, [])

  const handleLogout = async () => {
    await fetch('/api/auth', { method: 'DELETE' })
    router.push('/')
    router.refresh()
  }

  return (
    <div className="min-h-screen">
      <header className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">送信ログ</h1>
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              SMS送信
            </Link>
            <button
              onClick={handleLogout}
              className="text-sm text-gray-600 hover:text-gray-800"
            >
              ログアウト
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-medium text-gray-900">
              送信履歴（最新100件）
            </h2>
            <button
              onClick={fetchLogs}
              disabled={isLoading}
              className="px-3 py-1 text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50"
            >
              {isLoading ? '読み込み中...' : '更新'}
            </button>
          </div>

          {error && (
            <div className="p-4 bg-red-50 border-b border-red-200 text-red-700">
              {error}
            </div>
          )}

          {isLoading ? (
            <div className="p-8 text-center text-gray-500">読み込み中...</div>
          ) : (
            <LogsTable logs={logs} />
          )}
        </div>
      </main>
    </div>
  )
}
