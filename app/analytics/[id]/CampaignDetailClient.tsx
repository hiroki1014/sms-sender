'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import AppLayout from '@/components/AppLayout'
import { Alert, Badge, Card } from '@/components/ui'
import { Table, TableHead, TableBody, Th, Td, Tr } from '@/components/ui'
import { ArrowLeft, CursorClick, Envelope, PaperPlaneTilt, X, Clock } from '@phosphor-icons/react'

interface Recipient {
  contact_id: string | null
  phone_number: string
  contact_name: string | null
  send_status: 'success' | 'failed' | null
  delivery_status: string | null
  sent_at: string | null
  error_message: string | null
  click_count: number
  first_clicked_at: string | null
  last_clicked_at: string | null
}

interface CampaignStats {
  campaign_id: string
  campaign_name: string
  sent_at: string | null
  total_sent: number
  success_count: number
  failed_count: number
  delivered_count: number
  undelivered_count: number
  pending_count: number
  delivery_rate: number
  click_count: number
  unique_click_count: number
  click_rate: number
}

interface DetailData {
  campaign: CampaignStats
  recipients: Recipient[]
}

const DELIVERED = new Set(['delivered', 'read', 'sent'])
const UNDELIVERED = new Set(['undelivered', 'failed', 'canceled'])

function deliveryBadge(status: string | null) {
  if (!status) return <span className="text-xs text-gray-400">—</span>
  if (DELIVERED.has(status)) return <Badge variant="success">配信済</Badge>
  if (UNDELIVERED.has(status)) return <Badge variant="error">不達</Badge>
  return <Badge variant="warning">未確定</Badge>
}

function fmt(iso: string | null): string {
  if (!iso) return '-'
  return new Date(iso).toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function CampaignDetailClient({ campaignId }: { campaignId: string }) {
  const [data, setData] = useState<DetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/analytics?campaignId=${campaignId}`)
        const result = await res.json()
        if (!res.ok) {
          setError(result.error || '取得に失敗しました')
          return
        }
        setData(result)
      } catch {
        setError('取得に失敗しました')
      } finally {
        setLoading(false)
      }
    })()
  }, [campaignId])

  return (
    <AppLayout
      title={data?.campaign.campaign_name || 'キャンペーン詳細'}
      subtitle={data?.campaign.sent_at ? `送信日時: ${fmt(data.campaign.sent_at)}` : undefined}
      actions={
        <Link
          href="/analytics"
          className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4" />
          一覧に戻る
        </Link>
      }
    >
      {error && <Alert variant="error">{error}</Alert>}

      {loading ? (
        <div className="py-12 text-center">
          <div className="spinner mx-auto mb-3" />
        </div>
      ) : data ? (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <StatCard icon={<PaperPlaneTilt className="w-5 h-5" />} label="送信数" value={data.campaign.total_sent} subValue={`成功 ${data.campaign.success_count} / 失敗 ${data.campaign.failed_count}`} color="text-accent-500" />
            <StatCard icon={<Envelope className="w-5 h-5" />} label="到達率" value={`${data.campaign.delivery_rate}%`} subValue={`配信済 ${data.campaign.delivered_count} / 未確定 ${data.campaign.pending_count} / 不達 ${data.campaign.undelivered_count}`} color="text-success" />
            <StatCard icon={<CursorClick className="w-5 h-5" />} label="クリック数" value={`${data.campaign.click_count} (${data.campaign.unique_click_count}人)`} color="text-warning" />
            <StatCard icon={<Clock className="w-5 h-5" />} label="クリック率" value={`${data.campaign.click_rate}%`} color="text-accent-600" />
          </div>

          {/* Per-recipient */}
          <Card>
            <div className="px-4 py-3 border-b border-gray-150">
              <h2 className="font-medium text-gray-900">受信者別</h2>
            </div>
            {data.recipients.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-500">送信ログがありません</div>
            ) : (
              <Table>
                <TableHead>
                  <tr>
                    <Th>電話番号 / 名前</Th>
                    <Th>送信</Th>
                    <Th>到達</Th>
                    <Th className="text-right">クリック</Th>
                    <Th>最終クリック</Th>
                    <Th>送信日時</Th>
                  </tr>
                </TableHead>
                <TableBody>
                  {data.recipients.map((r, idx) => (
                    <Tr key={`${r.contact_id || 'anon'}-${idx}`}>
                      <Td>
                        <div className="font-mono text-sm text-gray-900">{r.phone_number}</div>
                        {r.contact_name && (
                          <div className="text-xs text-gray-500">{r.contact_name}</div>
                        )}
                      </Td>
                      <Td>
                        {r.send_status === 'success' ? (
                          <Badge variant="success">成功</Badge>
                        ) : r.send_status === 'failed' ? (
                          <Badge variant="error">失敗</Badge>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                        {r.error_message && (
                          <div className="text-xs text-error mt-0.5">
                            {r.error_message}
                          </div>
                        )}
                      </Td>
                      <Td>{deliveryBadge(r.delivery_status)}</Td>
                      <Td className="text-right font-mono text-sm">
                        {r.click_count > 0 ? (
                          <span className="text-warning font-medium">{r.click_count}</span>
                        ) : (
                          <span className="text-gray-400">0</span>
                        )}
                      </Td>
                      <Td className="text-sm text-gray-500">{fmt(r.last_clicked_at)}</Td>
                      <Td className="text-sm text-gray-500">{fmt(r.sent_at)}</Td>
                    </Tr>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </>
      ) : null}
    </AppLayout>
  )
}

function StatCard({
  icon, label, value, subValue, color,
}: {
  icon: React.ReactNode
  label: string
  value: string | number
  subValue?: string
  color: string
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className={color}>{icon}</div>
        <div>
          <div className="text-xs text-gray-500">{label}</div>
          <div className="text-xl font-semibold text-gray-900">{value}</div>
          {subValue && <div className="text-xs text-gray-400">{subValue}</div>}
        </div>
      </div>
    </Card>
  )
}
