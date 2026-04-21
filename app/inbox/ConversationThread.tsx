'use client'

import { useState, useEffect, useRef } from 'react'
import { Badge, Button, Alert } from '@/components/ui'
import { PaperPlaneTilt } from '@phosphor-icons/react'

interface ThreadMessage {
  id: string
  direction: 'inbound' | 'outbound'
  body: string
  timestamp: string
  campaign_name?: string
  is_opt_out?: boolean
}

interface ContactInfo {
  name: string | null
  phone: string
  opted_out: boolean
}

interface ConversationThreadProps {
  phone: string
  onMessageSent: () => void
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('ja-JP', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function ConversationThread({ phone, onMessageSent }: ConversationThreadProps) {
  const [messages, setMessages] = useState<ThreadMessage[]>([])
  const [contact, setContact] = useState<ContactInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [replyText, setReplyText] = useState('')
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const fetchThread = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/inbox/conversations/${encodeURIComponent(phone)}`)
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || '取得に失敗しました')
        return
      }
      setMessages(data.messages)
      setContact(data.contact)
    } catch {
      setError('取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchThread()
    setReplyText('')
  }, [phone])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleReply = async () => {
    if (!replyText.trim() || sending) return
    setSending(true)
    setError('')
    try {
      const res = await fetch('/api/inbox/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number: phone, message: replyText.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || '送信に失敗しました')
        return
      }
      setReplyText('')
      await fetchThread()
      onMessageSent()
    } catch {
      setError('送信に失敗しました')
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleReply()
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="spinner" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-2 shrink-0">
        <span className="font-medium text-gray-900">
          {contact?.name || phone}
        </span>
        {contact?.name && (
          <span className="text-xs text-gray-400">{phone}</span>
        )}
        {contact?.opted_out && (
          <Badge variant="error">配信停止</Badge>
        )}
      </div>

      {error && (
        <div className="px-4 pt-2 shrink-0">
          <Alert variant="error">{error}</Alert>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">メッセージがありません</p>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[75%] rounded-lg px-3 py-2 ${
                  msg.direction === 'outbound'
                    ? 'bg-accent-50 text-gray-900'
                    : 'bg-gray-100 text-gray-900'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap break-words">{msg.body}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-gray-400">{formatTime(msg.timestamp)}</span>
                  {msg.campaign_name && (
                    <span className="text-xs text-gray-400">
                      {msg.campaign_name}
                    </span>
                  )}
                  {msg.is_opt_out && (
                    <Badge variant="error">停止</Badge>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Reply input */}
      <div className="px-4 py-3 border-t border-gray-200 shrink-0">
        {contact?.opted_out ? (
          <p className="text-sm text-gray-500 text-center">配信停止中のため返信できません</p>
        ) : (
          <div className="flex items-end gap-2">
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="メッセージを入力..."
              rows={1}
              className="flex-1 resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-accent-400 focus:ring-2 focus:ring-accent-400/20 focus:outline-none"
              style={{ maxHeight: '5rem' }}
            />
            <Button
              variant="primary"
              size="sm"
              onClick={handleReply}
              disabled={!replyText.trim() || sending}
              icon={<PaperPlaneTilt className="w-4 h-4" />}
            >
              {sending ? '送信中' : '送信'}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
