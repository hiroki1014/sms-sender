'use client'

import { useState, useEffect } from 'react'
import AppLayout from '@/components/AppLayout'
import LogsTable from '@/components/LogsTable'
import { Button, Alert, Card } from '@/components/ui'
import { SmsLog } from '@/lib/supabase'
import { ArrowClockwise } from '@phosphor-icons/react'

export default function LogsClient() {
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

  return (
    <AppLayout
      title="送信ログ"
      subtitle="最新100件の送信履歴"
      actions={
        <Button
          variant="secondary"
          size="sm"
          onClick={fetchLogs}
          disabled={isLoading}
          loading={isLoading}
          icon={<ArrowClockwise className="w-4 h-4" />}
        >
          更新
        </Button>
      }
    >
      {error && (
        <div className="mb-6">
          <Alert variant="error">{error}</Alert>
        </div>
      )}

      <Card>
        {isLoading ? (
          <div className="py-12 text-center">
            <div className="spinner mx-auto mb-3" />
            <p className="text-sm text-gray-500">読み込み中...</p>
          </div>
        ) : (
          <LogsTable logs={logs} />
        )}
      </Card>
    </AppLayout>
  )
}
