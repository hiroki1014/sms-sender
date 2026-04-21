'use client'

import { Badge } from '@/components/ui'

interface Conversation {
  phone: string
  display_name: string
  latest_message: string
  latest_at: string
  unread_count: number
  is_opted_out: boolean
}

interface ConversationListProps {
  conversations: Conversation[]
  selectedPhone: string | null
  onSelect: (phone: string) => void
  loading: boolean
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return '今'
  if (mins < 60) return `${mins}分前`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}時間前`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}日前`
  return new Date(iso).toLocaleDateString('ja-JP', { month: '2-digit', day: '2-digit' })
}

export default function ConversationList({
  conversations,
  selectedPhone,
  onSelect,
  loading,
}: ConversationListProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="spinner" />
      </div>
    )
  }

  if (conversations.length === 0) {
    return (
      <div className="flex items-center justify-center h-full px-4">
        <p className="text-sm text-gray-500 text-center">会話がありません</p>
      </div>
    )
  }

  return (
    <div className="overflow-y-auto flex-1">
      {conversations.map((conv) => (
        <button
          key={conv.phone}
          onClick={() => onSelect(conv.phone)}
          className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
            selectedPhone === conv.phone
              ? 'bg-accent-50 border-l-2 border-l-accent-500'
              : 'border-l-2 border-l-transparent'
          }`}
        >
          <div className="flex items-center justify-between mb-0.5">
            <span className={`text-sm truncate ${conv.unread_count > 0 ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
              {conv.display_name}
            </span>
            <span className="text-xs text-gray-400 ml-2 shrink-0">
              {relativeTime(conv.latest_at)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500 truncate">
              {conv.latest_message}
            </span>
            <div className="flex items-center gap-1 ml-2 shrink-0">
              {conv.is_opted_out && (
                <Badge variant="error">停止</Badge>
              )}
              {conv.unread_count > 0 && (
                <span className="bg-accent-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {conv.unread_count > 99 ? '99+' : conv.unread_count}
                </span>
              )}
            </div>
          </div>
        </button>
      ))}
    </div>
  )
}
