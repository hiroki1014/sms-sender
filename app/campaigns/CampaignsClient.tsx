'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import AppLayout from '@/components/AppLayout'
import { Button, Badge, Alert, Card } from '@/components/ui'
import { Table, TableHead, TableBody, Th, Td, Tr } from '@/components/ui'
import {
  Plus,
  Funnel,
  Trash,
  Megaphone,
  XCircle,
  Play
} from '@phosphor-icons/react'

interface Campaign {
  id: string
  name: string
  message_template: string
  status: 'draft' | 'sent' | 'scheduled' | 'sending'
  sent_at: string | null
  scheduled_at: string | null
  created_at: string
}

const statusLabels: Record<Campaign['status'], string> = {
  draft: '下書き',
  sent: '送信済み',
  scheduled: '予約済み',
  sending: '送信中',
}

const statusVariants: Record<Campaign['status'], 'warning' | 'success' | 'accent' | 'default'> = {
  draft: 'warning',
  sent: 'success',
  scheduled: 'accent',
  sending: 'default',
}

export default function CampaignsClient() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const fetchCampaigns = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)

      const res = await fetch(`/api/campaigns?${params}`)
      const data = await res.json()

      if (!res.ok) {
        setError(data.error)
        return
      }

      setCampaigns(data.campaigns)
    } catch {
      setError('キャンペーンの取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCampaigns()
  }, [statusFilter])

  const handleDelete = async (id: string) => {
    if (!confirm('このキャンペーンを削除しますか？')) return

    try {
      const res = await fetch(`/api/campaigns?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        fetchCampaigns()
      }
    } catch {
      setError('削除に失敗しました')
    }
  }

  const handleCancel = async (id: string) => {
    if (!confirm('この予約をキャンセルしますか？（キャンペーンは下書きに戻ります）')) return

    try {
      const res = await fetch(`/api/campaigns/${id}/cancel`, { method: 'POST' })
      if (res.ok) {
        fetchCampaigns()
      } else {
        const data = await res.json()
        setError(data.error || 'キャンセルに失敗しました')
      }
    } catch {
      setError('キャンセルに失敗しました')
    }
  }

  const handleRunNow = async (id: string) => {
    if (!confirm('この予約キャンペーンを今すぐ実行しますか？')) return

    try {
      const res = await fetch('/api/campaigns/run-scheduled', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      const data = await res.json()
      if (res.ok) {
        fetchCampaigns()
      } else {
        setError(data.error || '実行に失敗しました')
      }
    } catch {
      setError('実行に失敗しました')
    }
  }

  const formatDateTime = (iso: string) =>
    new Date(iso).toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })

  return (
    <AppLayout
      title="キャンペーン"
      subtitle={`${campaigns.length}件のキャンペーン`}
      actions={
        <Link href="/campaigns/new">
          <Button variant="primary" icon={<Plus className="w-4 h-4" />}>
            新規作成
          </Button>
        </Link>
      }
    >
      <Card>
        {/* Filters */}
        <div className="px-4 py-3 border-b border-gray-150 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Funnel className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-600">フィルター:</span>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 text-sm border border-gray-300 rounded hover:border-gray-400 focus:border-accent-400 focus:ring-2 focus:ring-accent-400/20 focus:outline-none"
          >
            <option value="">すべてのステータス</option>
            <option value="draft">下書き</option>
            <option value="sent">送信済み</option>
            <option value="scheduled">予約済み</option>
          </select>
        </div>

        {error && (
          <div className="p-4 border-b border-gray-150">
            <Alert variant="error">{error}</Alert>
          </div>
        )}

        {loading ? (
          <div className="py-12 text-center">
            <div className="spinner mx-auto mb-3" />
            <p className="text-sm text-gray-500">読み込み中...</p>
          </div>
        ) : campaigns.length === 0 ? (
          <div className="py-12 text-center">
            <Megaphone className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500 mb-3">キャンペーンがありません</p>
            <Link href="/campaigns/new">
              <Button variant="secondary" size="sm" icon={<Plus className="w-4 h-4" />}>
                新規作成
              </Button>
            </Link>
          </div>
        ) : (
          <Table>
            <TableHead>
              <tr>
                <Th>キャンペーン名</Th>
                <Th>ステータス</Th>
                <Th>作成日</Th>
                <Th>予約 / 送信日時</Th>
                <Th className="w-32">操作</Th>
              </tr>
            </TableHead>
            <TableBody>
              {campaigns.map((campaign) => (
                <Tr key={campaign.id}>
                  <Td>
                    <div className="font-medium text-gray-900">{campaign.name}</div>
                    <div className="text-xs text-gray-500 truncate max-w-xs">
                      {campaign.message_template.substring(0, 50)}...
                    </div>
                  </Td>
                  <Td>
                    <Badge variant={statusVariants[campaign.status]}>
                      {statusLabels[campaign.status]}
                    </Badge>
                  </Td>
                  <Td className="text-sm text-gray-500">
                    {new Date(campaign.created_at).toLocaleDateString('ja-JP')}
                  </Td>
                  <Td className="text-sm text-gray-500">
                    {campaign.status === 'scheduled' && campaign.scheduled_at
                      ? formatDateTime(campaign.scheduled_at)
                      : campaign.sent_at
                      ? formatDateTime(campaign.sent_at)
                      : '-'}
                  </Td>
                  <Td>
                    <div className="flex items-center gap-1">
                      {(campaign.status === 'scheduled' || campaign.status === 'sending') && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRunNow(campaign.id)}
                            icon={<Play className="w-4 h-4 text-accent-600" />}
                            title={campaign.status === 'sending' ? '再実行' : '今すぐ実行'}
                          />
                          {campaign.status === 'scheduled' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCancel(campaign.id)}
                              icon={<XCircle className="w-4 h-4 text-warning" />}
                              title="予約キャンセル"
                            />
                          )}
                        </>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(campaign.id)}
                        icon={<Trash className="w-4 h-4 text-error" />}
                        title="削除"
                      />
                    </div>
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
