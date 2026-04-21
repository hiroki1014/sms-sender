'use client'

import { useState, useEffect } from 'react'
import AppLayout from '@/components/AppLayout'
import { ChatCircle } from '@phosphor-icons/react'
import ConversationList from './ConversationList'
import ConversationThread from './ConversationThread'

interface Conversation {
  phone: string
  display_name: string
  latest_message: string
  latest_at: string
  unread_count: number
  is_opted_out: boolean
}

export default function InboxClient() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null)

  const fetchConversations = async () => {
    try {
      const res = await fetch('/api/inbox/conversations')
      const data = await res.json()
      if (res.ok) {
        setConversations(data.conversations)
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchConversations()
  }, [])

  const unreadCount = conversations.reduce((sum, c) => sum + c.unread_count, 0)

  const handleSelect = (phone: string) => {
    setSelectedPhone(phone)
    const conv = conversations.find(c => c.phone === phone)
    if (conv && conv.unread_count > 0) {
      setConversations(prev =>
        prev.map(c => c.phone === phone ? { ...c, unread_count: 0 } : c)
      )
    }
  }

  return (
    <AppLayout
      title="メッセージ"
      subtitle={unreadCount > 0 ? `${unreadCount}件の未読` : `${conversations.length}件の会話`}
    >
      <div className="flex h-[calc(100vh-8rem)] -mx-6 -mb-6 border-t border-gray-200">
        {/* Left panel */}
        <div className="w-80 border-r border-gray-200 flex flex-col bg-white shrink-0">
          <ConversationList
            conversations={conversations}
            selectedPhone={selectedPhone}
            onSelect={handleSelect}
            loading={loading}
          />
        </div>

        {/* Right panel */}
        <div className="flex-1 flex flex-col bg-white">
          {selectedPhone ? (
            <ConversationThread
              phone={selectedPhone}
              onMessageSent={fetchConversations}
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <ChatCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500">会話を選択してください</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
