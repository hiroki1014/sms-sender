import { NextRequest, NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth'
import { getSupabase } from '@/lib/supabase'

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

interface OverallStats {
  total_campaigns: number
  total_sent: number
  total_success: number
  total_failed: number
  total_delivered: number
  total_undelivered: number
  total_pending: number
  overall_delivery_rate: number
  total_clicks: number
  overall_click_rate: number
}

const DELIVERED_STATUSES = new Set(['delivered', 'read'])
const UNDELIVERED_STATUSES = new Set(['undelivered', 'failed', 'canceled'])

export async function GET(request: NextRequest) {
  try {
    const authenticated = await isAuthenticated()
    if (!authenticated) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const campaignId = searchParams.get('campaignId')

    const supabase = getSupabase()

    if (campaignId) {
      // 特定キャンペーンの詳細統計
      const stats = await getCampaignDetailStats(supabase, campaignId)
      return NextResponse.json(stats)
    } else {
      // 全体の概要統計
      const stats = await getOverallStats(supabase)
      return NextResponse.json(stats)
    }
  } catch (error) {
    console.error('Analytics error:', error)
    return NextResponse.json({ error: '分析データの取得に失敗しました' }, { status: 500 })
  }
}

async function getOverallStats(supabase: ReturnType<typeof getSupabase>): Promise<{
  overall: OverallStats
  campaigns: CampaignStats[]
}> {
  // キャンペーン一覧を取得
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, name, sent_at, status')
    .eq('status', 'sent')
    .order('sent_at', { ascending: false })

  if (!campaigns || campaigns.length === 0) {
    return {
      overall: {
        total_campaigns: 0,
        total_sent: 0,
        total_success: 0,
        total_failed: 0,
        total_delivered: 0,
        total_undelivered: 0,
        total_pending: 0,
        overall_delivery_rate: 0,
        total_clicks: 0,
        overall_click_rate: 0,
      },
      campaigns: [],
    }
  }

  const campaignIds = campaigns.map(c => c.id)

  // SMS送信統計を取得
  const { data: smsLogs } = await supabase
    .from('sms_logs')
    .select('campaign_id, status, delivery_status')
    .in('campaign_id', campaignIds)

  // クリック統計を取得（short_urlsとclick_logsをJOIN）
  const { data: shortUrls } = await supabase
    .from('short_urls')
    .select('id, campaign_id')
    .in('campaign_id', campaignIds)

  const shortUrlIds = shortUrls?.map(s => s.id) || []

  const { data: clickLogs } = shortUrlIds.length > 0
    ? await supabase
        .from('click_logs')
        .select('short_url_id')
        .in('short_url_id', shortUrlIds)
    : { data: [] }

  // キャンペーンごとの統計を計算
  const campaignStats: CampaignStats[] = campaigns.map(campaign => {
    const campaignLogs = smsLogs?.filter(l => l.campaign_id === campaign.id) || []
    const successCount = campaignLogs.filter(l => l.status === 'success').length
    const failedCount = campaignLogs.filter(l => l.status === 'failed').length
    const totalSent = campaignLogs.length

    // 到達率（Twilio Status Callback ベース）
    const deliveredCount = campaignLogs.filter(
      l => l.delivery_status && DELIVERED_STATUSES.has(l.delivery_status)
    ).length
    const undeliveredCount = campaignLogs.filter(
      l => l.delivery_status && UNDELIVERED_STATUSES.has(l.delivery_status)
    ).length
    const pendingCount = successCount - deliveredCount - undeliveredCount

    // このキャンペーンのshort_urlsに紐づくクリック数
    const campaignShortUrlIds = shortUrls?.filter(s => s.campaign_id === campaign.id).map(s => s.id) || []
    const campaignClicks = clickLogs?.filter(c => campaignShortUrlIds.includes(c.short_url_id)) || []
    const clickCount = campaignClicks.length
    const uniqueClickCount = new Set(campaignClicks.map(c => c.short_url_id)).size

    return {
      campaign_id: campaign.id,
      campaign_name: campaign.name,
      sent_at: campaign.sent_at,
      total_sent: totalSent,
      success_count: successCount,
      failed_count: failedCount,
      delivered_count: deliveredCount,
      undelivered_count: undeliveredCount,
      pending_count: Math.max(0, pendingCount),
      delivery_rate: successCount > 0 ? Math.round((deliveredCount / successCount) * 100) : 0,
      click_count: clickCount,
      unique_click_count: uniqueClickCount,
      click_rate: successCount > 0 ? Math.round((uniqueClickCount / successCount) * 100) : 0,
    }
  })

  // 全体統計を計算
  const totalSent = campaignStats.reduce((sum, c) => sum + c.total_sent, 0)
  const totalSuccess = campaignStats.reduce((sum, c) => sum + c.success_count, 0)
  const totalFailed = campaignStats.reduce((sum, c) => sum + c.failed_count, 0)
  const totalDelivered = campaignStats.reduce((sum, c) => sum + c.delivered_count, 0)
  const totalUndelivered = campaignStats.reduce((sum, c) => sum + c.undelivered_count, 0)
  const totalPending = campaignStats.reduce((sum, c) => sum + c.pending_count, 0)
  const totalClicks = campaignStats.reduce((sum, c) => sum + c.click_count, 0)
  const totalUniqueClicks = campaignStats.reduce((sum, c) => sum + c.unique_click_count, 0)

  return {
    overall: {
      total_campaigns: campaigns.length,
      total_sent: totalSent,
      total_success: totalSuccess,
      total_failed: totalFailed,
      total_delivered: totalDelivered,
      total_undelivered: totalUndelivered,
      total_pending: totalPending,
      overall_delivery_rate: totalSuccess > 0 ? Math.round((totalDelivered / totalSuccess) * 100) : 0,
      total_clicks: totalClicks,
      overall_click_rate: totalSuccess > 0 ? Math.round((totalUniqueClicks / totalSuccess) * 100) : 0,
    },
    campaigns: campaignStats,
  }
}

interface RecipientDetail {
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

async function getCampaignDetailStats(
  supabase: ReturnType<typeof getSupabase>,
  campaignId: string
): Promise<{
  campaign: CampaignStats
  recipients: RecipientDetail[]
}> {
  // キャンペーン情報
  const { data: campaign, error: campaignError } = await supabase
    .from('campaigns')
    .select('id, name, sent_at')
    .eq('id', campaignId)
    .single()

  if (campaignError || !campaign) {
    throw new Error('Campaign not found')
  }

  // SMS送信統計
  const { data: smsLogs } = await supabase
    .from('sms_logs')
    .select('id, status, contact_id, phone_number, delivery_status, sent_at, error_message')
    .eq('campaign_id', campaignId)
    .order('sent_at', { ascending: false })

  const successCount = smsLogs?.filter(l => l.status === 'success').length || 0
  const failedCount = smsLogs?.filter(l => l.status === 'failed').length || 0
  const deliveredCount =
    smsLogs?.filter(l => l.delivery_status && DELIVERED_STATUSES.has(l.delivery_status)).length || 0
  const undeliveredCount =
    smsLogs?.filter(l => l.delivery_status && UNDELIVERED_STATUSES.has(l.delivery_status)).length || 0
  const pendingCount = Math.max(0, successCount - deliveredCount - undeliveredCount)

  // 短縮URL情報 (sms_log_id を含めて取得 — CSV送信の場合は contact_id が無いため sms_log_id 経由で紐付け)
  const { data: shortUrls } = await supabase
    .from('short_urls')
    .select('id, contact_id, sms_log_id')
    .eq('campaign_id', campaignId)

  const shortUrlIds = shortUrls?.map(s => s.id) || []

  // クリックログ
  const { data: clickLogs } = shortUrlIds.length > 0
    ? await supabase
        .from('click_logs')
        .select('short_url_id, clicked_at')
        .in('short_url_id', shortUrlIds)
        .order('clicked_at', { ascending: true })
    : { data: [] }

  // 顧客情報を取得
  const contactIds = Array.from(new Set(shortUrls?.map(s => s.contact_id).filter(Boolean) || []))
  const { data: contacts } = contactIds.length > 0
    ? await supabase
        .from('contacts')
        .select('id, name, phone_number')
        .in('id', contactIds)
    : { data: [] }

  // 顧客ごとのクリック統計
  const clicksByShortUrl = new Map<string, { count: number; first: string; last: string }>()
  clickLogs?.forEach(click => {
    const existing = clicksByShortUrl.get(click.short_url_id)
    if (existing) {
      existing.count++
      existing.last = click.clicked_at
    } else {
      clicksByShortUrl.set(click.short_url_id, {
        count: 1,
        first: click.clicked_at,
        last: click.clicked_at,
      })
    }
  })

  // sms_log_id 経由の集計（CSV送信でも contact_id 無しでも紐付けられる）
  const clicksPerSmsLog = new Map<string, { count: number; first: string; last: string }>()
  shortUrls?.forEach(shortUrl => {
    const clickData = clicksByShortUrl.get(shortUrl.id)
    if (!clickData || !shortUrl.sms_log_id) return
    const key = shortUrl.sms_log_id
    const existing = clicksPerSmsLog.get(key)
    if (existing) {
      existing.count += clickData.count
      if (clickData.first < existing.first) existing.first = clickData.first
      if (clickData.last > existing.last) existing.last = clickData.last
    } else {
      clicksPerSmsLog.set(key, {
        count: clickData.count,
        first: clickData.first,
        last: clickData.last,
      })
    }
  })

  // 全受信者の行を構築（sms_log.id を主キーとしてクリックを紐付け）
  const recipients: RecipientDetail[] = (smsLogs || []).map(log => {
    const contact = log.contact_id ? contacts?.find(c => c.id === log.contact_id) : null
    const clickData = clicksPerSmsLog.get(log.id)
    return {
      contact_id: log.contact_id || null,
      phone_number: log.phone_number,
      contact_name: contact?.name || null,
      send_status: log.status as 'success' | 'failed',
      delivery_status: log.delivery_status || null,
      sent_at: log.sent_at || null,
      error_message: log.error_message || null,
      click_count: clickData?.count || 0,
      first_clicked_at: clickData?.first || null,
      last_clicked_at: clickData?.last || null,
    }
  })

  const clickCount = clickLogs?.length || 0
  const uniqueClickCount = clicksByShortUrl.size

  return {
    campaign: {
      campaign_id: campaign.id,
      campaign_name: campaign.name,
      sent_at: campaign.sent_at,
      total_sent: (smsLogs?.length || 0),
      success_count: successCount,
      failed_count: failedCount,
      delivered_count: deliveredCount,
      undelivered_count: undeliveredCount,
      pending_count: pendingCount,
      delivery_rate: successCount > 0 ? Math.round((deliveredCount / successCount) * 100) : 0,
      click_count: clickCount,
      unique_click_count: uniqueClickCount,
      click_rate: successCount > 0 ? Math.round((uniqueClickCount / successCount) * 100) : 0,
    },
    recipients,
  }
}
