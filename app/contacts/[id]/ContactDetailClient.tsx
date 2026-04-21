'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import AppLayout from '@/components/AppLayout'
import { Badge, Card, Alert } from '@/components/ui'
import {
  PaperPlaneTilt,
  ChatCircle,
  CursorClick,
  ArrowLeft,
} from '@phosphor-icons/react'

interface TimelineEntry {
  type: 'sent' | 'received' | 'clicked'
  timestamp: string
  campaign_name?: string
  message?: string
  delivery_status?: string
  body?: string
  is_opt_out?: boolean
  original_url?: string
}

interface ContactInfo {
  id: string
  name: string | null
  phone_number: string
  tags: string[]
  opted_out: boolean
  created_at: string
  url: string | null
  gender: string | null
  list_type: string | null
  status: string | null
  prefecture: string | null
  notes: string | null
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

const deliveryLabels: Record<string, { label: string; variant: 'success' | 'error' | 'warning' | 'default' }> = {
  delivered: { label: '到達', variant: 'success' },
  sent: { label: '送信済', variant: 'success' },
  read: { label: '既読', variant: 'success' },
  queued: { label: '待機中', variant: 'default' },
  sending: { label: '送信中', variant: 'default' },
  accepted: { label: '受付', variant: 'default' },
  undelivered: { label: '未到達', variant: 'error' },
  failed: { label: '失敗', variant: 'error' },
}

const typeConfig = {
  sent: { icon: PaperPlaneTilt, color: 'text-accent-500', bg: 'bg-accent-50', label: '送信' },
  received: { icon: ChatCircle, color: 'text-green-500', bg: 'bg-green-50', label: '受信' },
  clicked: { icon: CursorClick, color: 'text-orange-500', bg: 'bg-orange-50', label: 'クリック' },
}

export default function ContactDetailClient() {
  const params = useParams()
  const id = params.id as string

  const [contact, setContact] = useState<ContactInfo | null>(null)
  const [timeline, setTimeline] = useState<TimelineEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchTimeline = async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/contacts/${id}/timeline`)
        const data = await res.json()
        if (!res.ok) {
          setError(data.error || '取得に失敗しました')
          return
        }
        setContact(data.contact)
        setTimeline(data.timeline)
      } catch {
        setError('取得に失敗しました')
      } finally {
        setLoading(false)
      }
    }
    fetchTimeline()
  }, [id])

  const groupedByDate = timeline.reduce<Record<string, TimelineEntry[]>>((acc, entry) => {
    const date = formatDate(entry.timestamp)
    if (!acc[date]) acc[date] = []
    acc[date].push(entry)
    return acc
  }, {})

  return (
    <AppLayout
      title={contact?.name || contact?.phone_number || '顧客詳細'}
      subtitle={contact?.name ? contact.phone_number : undefined}
      actions={
        <Link href="/contacts">
          <button className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            顧客一覧
          </button>
        </Link>
      }
    >
      {error && (
        <div className="mb-4">
          <Alert variant="error">{error}</Alert>
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center">
          <div className="spinner mx-auto mb-3" />
          <p className="text-sm text-gray-500">読み込み中...</p>
        </div>
      ) : (
        <>
          {/* Contact info */}
          <Card>
            <div className="px-4 py-3 space-y-2">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="font-mono text-sm text-gray-700">{contact?.phone_number}</span>
                {contact?.opted_out && <Badge variant="error">配信停止</Badge>}
                {contact?.tags?.map(tag => (
                  <Badge key={tag} variant="default">{tag}</Badge>
                ))}
                <span className="text-xs text-gray-400 ml-auto">
                  登録: {contact?.created_at ? formatDate(contact.created_at) : '-'}
                </span>
              </div>
              {(contact?.list_type || contact?.prefecture || contact?.gender || contact?.url) && (
                <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
                  {contact?.list_type && <span>{contact.list_type}</span>}
                  {contact?.prefecture && <span>{contact.prefecture}</span>}
                  {contact?.gender && <span>{contact.gender}</span>}
                  {contact?.url && (
                    <a href={contact.url} target="_blank" rel="noopener noreferrer" className="text-accent-600 hover:underline truncate max-w-xs">
                      {contact.url}
                    </a>
                  )}
                </div>
              )}
              {contact?.notes && (
                <p className="text-xs text-gray-500">{contact.notes}</p>
              )}
            </div>
          </Card>

          {/* Timeline */}
          <div className="mt-4 space-y-6">
            {Object.keys(groupedByDate).length === 0 ? (
              <Card>
                <div className="py-8 text-center text-sm text-gray-500">
                  まだ履歴がありません
                </div>
              </Card>
            ) : (
              Object.entries(groupedByDate).map(([date, entries]) => (
                <div key={date}>
                  <div className="text-xs font-medium text-gray-400 mb-2 px-1">{date}</div>
                  <Card>
                    <div className="divide-y divide-gray-100">
                      {entries.map((entry, idx) => {
                        const config = typeConfig[entry.type]
                        const Icon = config.icon
                        return (
                          <div key={`${entry.type}-${idx}`} className="px-4 py-3 flex gap-3">
                            <div className={`w-8 h-8 rounded-full ${config.bg} flex items-center justify-center shrink-0 mt-0.5`}>
                              <Icon className={`w-4 h-4 ${config.color}`} weight="fill" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-xs font-medium text-gray-500">{config.label}</span>
                                {entry.campaign_name && (
                                  <span className="text-xs text-gray-400">{entry.campaign_name}</span>
                                )}
                                {entry.type === 'sent' && entry.delivery_status && deliveryLabels[entry.delivery_status] && (
                                  <Badge variant={deliveryLabels[entry.delivery_status].variant}>
                                    {deliveryLabels[entry.delivery_status].label}
                                  </Badge>
                                )}
                                {entry.is_opt_out && (
                                  <Badge variant="error">停止</Badge>
                                )}
                                <span className="text-xs text-gray-400 ml-auto shrink-0">
                                  {formatTime(entry.timestamp)}
                                </span>
                              </div>
                              {entry.type === 'sent' && entry.message && (
                                <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">{entry.message}</p>
                              )}
                              {entry.type === 'received' && entry.body && (
                                <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">{entry.body}</p>
                              )}
                              {entry.type === 'clicked' && entry.original_url && (
                                <p className="text-sm text-accent-600 truncate">{entry.original_url}</p>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </Card>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </AppLayout>
  )
}
