'use client'

import { useState, useEffect } from 'react'
import AppLayout from '@/components/AppLayout'
import { Alert, Card } from '@/components/ui'
import { Table, TableHead, TableBody, Th, Td, Tr } from '@/components/ui'
import {
  ChartBar,
  PaperPlaneTilt,
  Check,
  X,
  CursorClick,
  Percent
} from '@phosphor-icons/react'

interface CampaignStats {
  campaign_id: string
  campaign_name: string
  sent_at: string | null
  total_sent: number
  success_count: number
  failed_count: number
  click_count: number
  unique_click_count: number
  click_rate: number
}

interface OverallStats {
  total_campaigns: number
  total_sent: number
  total_success: number
  total_failed: number
  total_clicks: number
  overall_click_rate: number
}

interface AnalyticsData {
  overall: OverallStats
  campaigns: CampaignStats[]
}

export default function AnalyticsClient() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchAnalytics = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/analytics')
      const result = await res.json()

      if (!res.ok) {
        setError(result.error)
        return
      }

      setData(result)
    } catch {
      setError('分析データの取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAnalytics()
  }, [])

  return (
    <AppLayout
      title="分析"
      subtitle="キャンペーンの効果測定"
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
      ) : !data ? (
        <div className="py-12 text-center">
          <ChartBar className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">データがありません</p>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <StatCard
              icon={<PaperPlaneTilt className="w-5 h-5" />}
              label="総送信数"
              value={data.overall.total_sent.toLocaleString()}
              color="text-accent-500"
            />
            <StatCard
              icon={<Check className="w-5 h-5" />}
              label="成功"
              value={data.overall.total_success.toLocaleString()}
              subValue={data.overall.total_sent > 0
                ? `${Math.round((data.overall.total_success / data.overall.total_sent) * 100)}%`
                : '0%'}
              color="text-success"
            />
            <StatCard
              icon={<CursorClick className="w-5 h-5" />}
              label="クリック数"
              value={data.overall.total_clicks.toLocaleString()}
              color="text-warning"
            />
            <StatCard
              icon={<Percent className="w-5 h-5" />}
              label="クリック率"
              value={`${data.overall.overall_click_rate}%`}
              color="text-accent-600"
            />
          </div>

          {/* Campaign Table */}
          <Card>
            <div className="px-4 py-3 border-b border-gray-150">
              <h2 className="font-medium text-gray-900">キャンペーン別統計</h2>
            </div>

            {data.campaigns.length === 0 ? (
              <div className="py-12 text-center">
                <ChartBar className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500">
                  送信済みのキャンペーンがありません
                </p>
              </div>
            ) : (
              <Table>
                <TableHead>
                  <tr>
                    <Th>キャンペーン名</Th>
                    <Th>送信日</Th>
                    <Th className="text-right">送信数</Th>
                    <Th className="text-right">成功</Th>
                    <Th className="text-right">失敗</Th>
                    <Th className="text-right">クリック</Th>
                    <Th className="text-right">クリック率</Th>
                  </tr>
                </TableHead>
                <TableBody>
                  {data.campaigns.map((campaign) => (
                    <Tr key={campaign.campaign_id}>
                      <Td>
                        <span className="font-medium text-gray-900">
                          {campaign.campaign_name}
                        </span>
                      </Td>
                      <Td className="text-sm text-gray-500">
                        {campaign.sent_at
                          ? new Date(campaign.sent_at).toLocaleDateString('ja-JP')
                          : '-'}
                      </Td>
                      <Td className="text-right font-mono text-sm">
                        {campaign.total_sent.toLocaleString()}
                      </Td>
                      <Td className="text-right font-mono text-sm text-success">
                        {campaign.success_count.toLocaleString()}
                      </Td>
                      <Td className="text-right font-mono text-sm text-error">
                        {campaign.failed_count.toLocaleString()}
                      </Td>
                      <Td className="text-right font-mono text-sm">
                        {campaign.click_count.toLocaleString()}
                        {campaign.unique_click_count !== campaign.click_count && (
                          <span className="text-xs text-gray-400 ml-1">
                            ({campaign.unique_click_count}人)
                          </span>
                        )}
                      </Td>
                      <Td className="text-right">
                        <span className={`font-mono text-sm font-medium ${
                          campaign.click_rate >= 10
                            ? 'text-success'
                            : campaign.click_rate >= 5
                            ? 'text-warning'
                            : 'text-gray-500'
                        }`}>
                          {campaign.click_rate}%
                        </span>
                      </Td>
                    </Tr>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </>
      )}
    </AppLayout>
  )
}

function StatCard({
  icon,
  label,
  value,
  subValue,
  color,
}: {
  icon: React.ReactNode
  label: string
  value: string
  subValue?: string
  color: string
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className={`${color}`}>{icon}</div>
        <div>
          <div className="text-xs text-gray-500">{label}</div>
          <div className="text-xl font-semibold text-gray-900">{value}</div>
          {subValue && (
            <div className="text-xs text-gray-400">{subValue}</div>
          )}
        </div>
      </div>
    </Card>
  )
}
