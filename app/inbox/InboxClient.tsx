'use client'

import { useState, useEffect } from 'react'
import AppLayout from '@/components/AppLayout'
import { Alert, Badge, Card } from '@/components/ui'
import { Table, TableHead, TableBody, Th, Td, Tr } from '@/components/ui'
import { ChatCircle } from '@phosphor-icons/react'

interface IncomingMessage {
  id: string
  twilio_sid: string | null
  from_number: string
  to_number: string
  body: string
  contact_id: string | null
  contact_name: string | null
  received_at: string
  is_opt_out: boolean
}

function fmt(iso: string): string {
  return new Date(iso).toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function InboxClient() {
  const [messages, setMessages] = useState<IncomingMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      try {
        const res = await fetch('/api/inbox')
        const data = await res.json()
        if (!res.ok) {
          setError(data.error || '取得に失敗しました')
          return
        }
        setMessages(data.messages)
      } catch {
        setError('取得に失敗しました')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  return (
    <AppLayout
      title="受信メッセージ"
      subtitle={`${messages.length}件の受信`}
    >
      {error && (
        <div className="mb-4">
          <Alert variant="error">{error}</Alert>
        </div>
      )}

      <Card>
        {loading ? (
          <div className="py-12 text-center">
            <div className="spinner mx-auto mb-3" />
            <p className="text-sm text-gray-500">読み込み中...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="py-12 text-center">
            <ChatCircle className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">受信メッセージがありません</p>
          </div>
        ) : (
          <Table>
            <TableHead>
              <tr>
                <Th>送信元</Th>
                <Th>本文</Th>
                <Th>受信日時</Th>
                <Th>ステータス</Th>
              </tr>
            </TableHead>
            <TableBody>
              {messages.map((msg) => (
                <Tr key={msg.id}>
                  <Td>
                    <div className="font-mono text-sm text-gray-900">{msg.from_number}</div>
                    {msg.contact_name && (
                      <div className="text-xs text-gray-500">{msg.contact_name}</div>
                    )}
                  </Td>
                  <Td>
                    <div className="text-sm text-gray-700 whitespace-pre-wrap max-w-md">
                      {msg.body}
                    </div>
                  </Td>
                  <Td className="text-sm text-gray-500">{fmt(msg.received_at)}</Td>
                  <Td>
                    {msg.is_opt_out ? (
                      <Badge variant="error">配信停止</Badge>
                    ) : (
                      <Badge variant="default">通常</Badge>
                    )}
                  </Td>
                </Tr>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </AppLayout>
  )
}
