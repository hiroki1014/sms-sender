import { NextRequest, NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth'
import { getSupabase, fetchAll, fetchAllByIn } from '@/lib/supabase'
import { classifyClicks, ClickWithContext } from '@/lib/click-diagnostics'

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
  human_like_click_count?: number
  human_like_unique_count?: number
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
  total_clicks_unique: number
  overall_click_rate: number
}

interface OverallCharts {
  clickHeatmap: Array<{ day: number; hour: number; count: number }>
  trend: Array<{ name: string; delivery_rate: number; click_rate: number }>
  cpc: { total_cost: number; total_clicks: number; cpc: number }
  repeaters: { multi_click_contacts: number; zero_click_contacts: number; total_contacts: number }
}

interface DetailCharts {
  timeToClick: Array<{ bucket: string; count: number }>
  tagBreakdown: Array<{ tag: string; sent: number; clicked: number; rate: number }>
}

const DELIVERED_STATUSES = new Set(['delivered', 'read', 'sent'])
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
  charts: OverallCharts
}> {
  // キャンペーン一覧を取得
  const campaigns = await fetchAll(s => s
    .from('campaigns')
    .select('id, name, sent_at, status')
    .in('status', ['sent', 'sending'])
    .order('sent_at', { ascending: false })
    .order('id', { ascending: true })
  )

  if (campaigns.length === 0) {
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
        total_clicks_unique: 0,
        overall_click_rate: 0,
      },
      campaigns: [],
      charts: {
        clickHeatmap: [],
        trend: [],
        cpc: { total_cost: 0, total_clicks: 0, cpc: 0 },
        repeaters: { multi_click_contacts: 0, zero_click_contacts: 0, total_contacts: 0 },
      },
    }
  }

  const campaignIds = campaigns.map(c => c.id)

  // SMS送信統計を取得
  const smsLogs = await fetchAllByIn(
    (s, batch) => s.from('sms_logs').select('id, campaign_id, status, delivery_status, price, sent_at').in('campaign_id', batch).order('id', { ascending: true }),
    campaignIds
  )

  // クリック統計を取得（short_urlsとclick_logsをJOIN）
  const shortUrls = await fetchAllByIn(
    (s, batch) => s.from('short_urls').select('id, campaign_id, contact_id, sms_log_id').in('campaign_id', batch).order('id', { ascending: true }),
    campaignIds
  )

  const shortUrlIds = shortUrls.map(s => s.id)

  const clickLogs = shortUrlIds.length > 0
    ? await fetchAllByIn(
        (s, batch) => s.from('click_logs').select('id, short_url_id, clicked_at, user_agent, ip_address, sec_fetch_mode, sec_fetch_dest').in('short_url_id', batch).order('id', { ascending: true }),
        shortUrlIds
      )
    : []

  // click_diagnostics用: sent_atマッピング
  const overallSmsLogSentAt = new Map<string, string>()
  smsLogs.forEach(log => {
    if (log.sent_at) overallSmsLogSentAt.set(log.id, log.sent_at)
  })
  const overallShortUrlToSmsLogId = new Map<string, string>()
  shortUrls.forEach(su => {
    if (su.sms_log_id) overallShortUrlToSmsLogId.set(su.id, su.sms_log_id)
  })

  // 全clickLogsを一括分類（ヒートマップ・CPC・リピーターで使用）
  const allClicksCtx: ClickWithContext[] = clickLogs.map(click => {
    const smsLogId = overallShortUrlToSmsLogId.get(click.short_url_id)
    const sentAt = smsLogId ? overallSmsLogSentAt.get(smsLogId) ?? null : null
    return {
      id: click.id, short_url_id: click.short_url_id, clicked_at: click.clicked_at,
      user_agent: click.user_agent ?? null, ip_address: click.ip_address ?? null,
      sec_fetch_mode: click.sec_fetch_mode ?? null, sec_fetch_dest: click.sec_fetch_dest ?? null,
      sent_at: sentAt,
    }
  })
  const allClassified = classifyClicks(allClicksCtx)
  const humanLikeClickIdSet = new Set(allClassified.filter(c => c.classification === 'human_like').map(c => c.id))

  // キャンペーンごとの統計を計算
  const campaignStats: CampaignStats[] = campaigns.map(campaign => {
    const campaignLogs = smsLogs.filter(l => l.campaign_id === campaign.id && l.status !== 'pending')
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
    const campaignShortUrlIds = shortUrls.filter(s => s.campaign_id === campaign.id).map(s => s.id)
    const campaignClicks = clickLogs.filter(c => campaignShortUrlIds.includes(c.short_url_id))
    const clickCount = campaignClicks.length
    const uniqueClickCount = new Set(campaignClicks.map(c => c.short_url_id)).size

    // click_diagnostics
    const clicksCtx: ClickWithContext[] = campaignClicks.map(click => {
      const smsLogId = overallShortUrlToSmsLogId.get(click.short_url_id)
      const sentAt = smsLogId ? overallSmsLogSentAt.get(smsLogId) ?? null : null
      return {
        id: click.id, short_url_id: click.short_url_id, clicked_at: click.clicked_at,
        user_agent: click.user_agent ?? null, ip_address: click.ip_address ?? null,
        sec_fetch_mode: click.sec_fetch_mode ?? null, sec_fetch_dest: click.sec_fetch_dest ?? null,
        sent_at: sentAt,
      }
    })
    const classified = classifyClicks(clicksCtx)
    const humanLikeCount = classified.filter(c => c.classification === 'human_like').length
    const humanLikeUniqueCount = new Set(classified.filter(c => c.classification === 'human_like').map(c => c.short_url_id)).size

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
      click_rate: successCount > 0 ? Math.round((humanLikeUniqueCount / successCount) * 100) : 0,
      human_like_click_count: humanLikeCount,
      human_like_unique_count: humanLikeUniqueCount,
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
  const totalHumanLikeClicks = campaignStats.reduce((sum, c) => sum + (c.human_like_click_count || 0), 0)
  const totalHumanLikeUnique = campaignStats.reduce((sum, c) => sum + (c.human_like_unique_count || 0), 0)

  // --- Charts ---

  // ヒートマップ: clicked_at を JST に変換し曜日×時間帯で集計（human_likeのみ）
  const heatmapMap = new Map<string, number>()
  clickLogs.forEach(click => {
    if (!humanLikeClickIdSet.has(click.id)) return
    const d = new Date(click.clicked_at)
    // UTC→JST (+9h)
    const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000)
    const day = jst.getUTCDay() // 0=日〜6=土
    const hour = jst.getUTCHours()
    const key = `${day}-${hour}`
    heatmapMap.set(key, (heatmapMap.get(key) || 0) + 1)
  })
  const clickHeatmap = Array.from(heatmapMap.entries()).map(([key, count]) => {
    const [day, hour] = key.split('-').map(Number)
    return { day, hour, count }
  })

  // 推移: campaignStats を sent_at 昇順ソート
  const trend = [...campaignStats]
    .filter(c => c.sent_at !== null)
    .sort((a, b) => new Date(a.sent_at!).getTime() - new Date(b.sent_at!).getTime())
    .map(c => ({
      name: c.campaign_name,
      delivery_rate: c.delivery_rate,
      click_rate: c.click_rate,
    }))

  // CPC: sms_logs の price 合計 / キャンペーンごとのユニーククリック合計
  const totalCost = smsLogs.filter(l => l.status !== 'pending').reduce((sum, l) => sum + (Number(l.price) || 0), 0)
  const cpc = {
    total_cost: totalCost,
    total_clicks: totalHumanLikeUnique,
    cpc: totalHumanLikeUnique > 0 ? Math.round((totalCost / totalHumanLikeUnique) * 100) / 100 : 0,
  }

  // リピーター: contact_id ごとにクリックされたキャンペーンの Set を作る（human_likeのみ）
  const contactCampaignMap = new Map<string, Set<string>>()
  shortUrls.forEach(su => {
    if (!su.contact_id) return
    const hasHumanClick = clickLogs.some(c => c.short_url_id === su.id && humanLikeClickIdSet.has(c.id))
    if (!hasHumanClick) return
    if (!contactCampaignMap.has(su.contact_id)) {
      contactCampaignMap.set(su.contact_id, new Set())
    }
    contactCampaignMap.get(su.contact_id)!.add(su.campaign_id)
  })
  const multiClickContacts = Array.from(contactCampaignMap.values()).filter(s => s.size > 1).length
  const clickedContacts = contactCampaignMap.size

  // contacts 全数 (opted_out=false)
  const { count: totalContactsCount } = await supabase
    .from('contacts')
    .select('id', { count: 'exact', head: true })
    .eq('opted_out', false)
  const totalContacts = totalContactsCount || 0
  const zeroClickContacts = totalContacts - clickedContacts

  const repeaters = {
    multi_click_contacts: multiClickContacts,
    zero_click_contacts: Math.max(0, zeroClickContacts),
    total_contacts: totalContacts,
  }

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
      total_clicks: totalHumanLikeClicks,
      total_clicks_unique: totalHumanLikeUnique,
      overall_click_rate: totalSuccess > 0 ? Math.round((totalHumanLikeUnique / totalSuccess) * 100) : 0,
    },
    campaigns: campaignStats,
    charts: {
      clickHeatmap,
      trend,
      cpc,
      repeaters,
    },
  }
}

interface RecipientDetail {
  contact_id: string | null
  phone_number: string
  contact_name: string | null
  send_status: 'success' | 'failed' | 'pending' | null
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
  charts: DetailCharts
  click_diagnostics: {
    total: number
    human_like: number
    human_like_unique: number
    suspected_automated: number
    suspected_automated_unique: number
    unknown: number
    unknown_unique: number
    top_reason_sets: Array<{ reasons: string[]; count: number }>
  }
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
  const smsLogs = await fetchAll(s => s
    .from('sms_logs')
    .select('id, status, contact_id, phone_number, delivery_status, sent_at, error_message')
    .eq('campaign_id', campaignId)
    .order('sent_at', { ascending: false })
    .order('id', { ascending: true })
  )

  const completedLogs = smsLogs.filter(l => l.status !== 'pending')
  const successCount = completedLogs.filter(l => l.status === 'success').length
  const failedCount = completedLogs.filter(l => l.status === 'failed').length
  const totalSent = completedLogs.length
  const deliveredCount =
    completedLogs.filter(l => l.delivery_status && DELIVERED_STATUSES.has(l.delivery_status)).length
  const undeliveredCount =
    completedLogs.filter(l => l.delivery_status && UNDELIVERED_STATUSES.has(l.delivery_status)).length
  const pendingCount = Math.max(0, successCount - deliveredCount - undeliveredCount)

  // 短縮URL情報 (sms_log_id を含めて取得 — CSV送信の場合は contact_id が無いため sms_log_id 経由で紐付け)
  const shortUrls = await fetchAll(s => s
    .from('short_urls')
    .select('id, contact_id, sms_log_id')
    .eq('campaign_id', campaignId)
    .order('id', { ascending: true })
  )

  const shortUrlIds = shortUrls.map(s => s.id)

  // クリックログ
  const clickLogs = shortUrlIds.length > 0
    ? await fetchAllByIn(
        (s, batch) => s.from('click_logs').select('id, short_url_id, clicked_at, user_agent, ip_address, sec_fetch_site, sec_fetch_mode, sec_fetch_dest').in('short_url_id', batch).order('clicked_at', { ascending: true }).order('id', { ascending: true }),
        shortUrlIds
      )
    : []

  // クリック分類（human_like判定）— 受信者集計・チャートで使い回す
  const smsLogSentAt = new Map<string, string>()
  smsLogs.forEach(log => {
    if (log.sent_at) smsLogSentAt.set(log.id, log.sent_at)
  })
  const shortUrlToSmsLogId = new Map<string, string>()
  shortUrls.forEach(su => {
    if (su.sms_log_id) shortUrlToSmsLogId.set(su.id, su.sms_log_id)
  })
  const clicksWithContext: ClickWithContext[] = clickLogs.map(click => {
    const smsLogId = shortUrlToSmsLogId.get(click.short_url_id)
    const sentAt = smsLogId ? smsLogSentAt.get(smsLogId) ?? null : null
    return {
      id: click.id, short_url_id: click.short_url_id, clicked_at: click.clicked_at,
      user_agent: click.user_agent ?? null, ip_address: click.ip_address ?? null,
      sec_fetch_site: click.sec_fetch_site ?? null, sec_fetch_mode: click.sec_fetch_mode ?? null,
      sec_fetch_dest: click.sec_fetch_dest ?? null, sent_at: sentAt,
    }
  })
  const classified = classifyClicks(clicksWithContext)
  const humanLikeClickIdSet = new Set(classified.filter(c => c.classification === 'human_like').map(c => c.id))

  // 顧客情報を取得（contact_id + phone_number の両方で引く）
  const contactIds = Array.from(new Set(shortUrls.map(s => s.contact_id).filter(Boolean)))
  const phoneNumbers = Array.from(new Set(smsLogs.map(l => l.phone_number).filter(Boolean)))
  let contacts: Array<{ id: string; name: string | null; phone_number: string; tags: string[] }> = []
  if (contactIds.length > 0) {
    contacts = await fetchAllByIn(
      (s, batch) => s.from('contacts').select('id, name, phone_number, tags').in('id', batch).order('id', { ascending: true }),
      contactIds
    )
  }
  if (phoneNumbers.length > 0) {
    const existingPhones = new Set(contacts.map(c => c.phone_number))
    const missingPhones = phoneNumbers.filter(p => !existingPhones.has(p))
    if (missingPhones.length > 0) {
      const byPhone = await fetchAllByIn(
        (s, batch) => s.from('contacts').select('id, name, phone_number, tags').in('phone_number', batch).order('id', { ascending: true }),
        missingPhones
      )
      contacts = [...contacts, ...byPhone]
    }
  }

  // 顧客ごとのクリック統計（human_likeのみ）
  const clicksByShortUrl = new Map<string, { count: number; first: string; last: string }>()
  clickLogs.forEach(click => {
    if (!humanLikeClickIdSet.has(click.id)) return
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
  shortUrls.forEach(shortUrl => {
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
  const recipients: RecipientDetail[] = smsLogs.map(log => {
    const contact = log.contact_id
      ? contacts?.find(c => c.id === log.contact_id)
      : contacts?.find(c => c.phone_number === log.phone_number) || null
    const clickData = clicksPerSmsLog.get(log.id)
    return {
      contact_id: log.contact_id || null,
      phone_number: log.phone_number,
      contact_name: contact?.name || null,
      send_status: log.status as 'success' | 'failed' | 'pending',
      delivery_status: log.delivery_status || null,
      sent_at: log.sent_at || null,
      error_message: log.error_message || null,
      click_count: clickData?.count || 0,
      first_clicked_at: clickData?.first || null,
      last_clicked_at: clickData?.last || null,
    }
  })

  const clickCount = Array.from(clicksPerSmsLog.values()).reduce((sum, d) => sum + d.count, 0)
  const uniqueClickCount = clicksPerSmsLog.size

  // --- Charts ---

  // timeToClick: SMS送信からクリックまでの時間をバケットに振り分け
  const TIME_BUCKETS = [
    { label: '0-5分', max: 5 },
    { label: '5-15分', max: 15 },
    { label: '15-30分', max: 30 },
    { label: '30分-1時間', max: 60 },
    { label: '1-3時間', max: 180 },
    { label: '3-6時間', max: 360 },
    { label: '6-12時間', max: 720 },
    { label: '12-24時間', max: 1440 },
    { label: '24時間+', max: Infinity },
  ]
  const bucketCounts = new Map<string, number>(TIME_BUCKETS.map(b => [b.label, 0]))

  // short_url.sms_log_id 経由で click_logs と sms_logs を結合（human_likeのみ）
  shortUrls.forEach(su => {
    if (!su.sms_log_id) return
    const sentAt = smsLogSentAt.get(su.sms_log_id)
    if (!sentAt) return
    const suClicks = clickLogs.filter(c => c.short_url_id === su.id && humanLikeClickIdSet.has(c.id))
    suClicks.forEach(click => {
      const diffMinutes = (new Date(click.clicked_at).getTime() - new Date(sentAt).getTime()) / (1000 * 60)
      const bucket = TIME_BUCKETS.find(b => diffMinutes < b.max) || TIME_BUCKETS[TIME_BUCKETS.length - 1]
      bucketCounts.set(bucket.label, (bucketCounts.get(bucket.label) || 0) + 1)
    })
  })

  const timeToClick = TIME_BUCKETS.map(b => ({
    bucket: b.label,
    count: bucketCounts.get(b.label) || 0,
  }))

  // tagBreakdown: タグごとに送信数とクリック数を集計
  // sms_logs.contact_id → contacts.tags
  const contactTagsMap = new Map<string, string[]>()
  contacts.forEach(c => {
    if (c.tags && Array.isArray(c.tags) && c.tags.length > 0) {
      contactTagsMap.set(c.id, c.tags as string[])
    }
  })

  // クリックした contact_id の Set
  const clickedContactIds = new Set<string>()
  shortUrls.forEach(su => {
    if (!su.contact_id) return
    const hasClick = clickLogs.some(c => c.short_url_id === su.id && humanLikeClickIdSet.has(c.id))
    if (hasClick) clickedContactIds.add(su.contact_id)
  })

  const tagSent = new Map<string, number>()
  const tagClicked = new Map<string, number>()

  completedLogs.forEach(log => {
    if (!log.contact_id) return
    const tags = contactTagsMap.get(log.contact_id)
    if (!tags) return
    tags.forEach(tag => {
      tagSent.set(tag, (tagSent.get(tag) || 0) + 1)
      if (clickedContactIds.has(log.contact_id!)) {
        tagClicked.set(tag, (tagClicked.get(tag) || 0) + 1)
      }
    })
  })

  const tagBreakdown = Array.from(tagSent.entries()).map(([tag, sent]) => {
    const clicked = tagClicked.get(tag) || 0
    return {
      tag,
      sent,
      clicked,
      rate: sent > 0 ? Math.round((clicked / sent) * 100) : 0,
    }
  })

  // click_diagnostics: 分類結果の集計
  const humanLike = classified.filter(c => c.classification === 'human_like').length
  const suspectedAutomated = classified.filter(c => c.classification === 'suspected_automated').length
  const unknownCount = classified.filter(c => c.classification === 'unknown').length

  const uniqueByClassification = (cls: string) => {
    const smsLogIds = new Set<string>()
    classified.filter(c => c.classification === cls).forEach(c => {
      const smsLogId = shortUrlToSmsLogId.get(c.short_url_id)
      if (smsLogId) smsLogIds.add(smsLogId)
    })
    return smsLogIds.size
  }
  const humanLikeUnique = uniqueByClassification('human_like')
  const suspectedAutomatedUnique = uniqueByClassification('suspected_automated')
  const unknownUnique = uniqueByClassification('unknown')

  const reasonSetCounts = new Map<string, number>()
  classified.forEach(c => {
    if (c.reasons.length === 0) return
    const key = JSON.stringify(c.reasons)
    reasonSetCounts.set(key, (reasonSetCounts.get(key) || 0) + 1)
  })
  const topReasonSets = Array.from(reasonSetCounts.entries())
    .map(([key, count]) => ({ reasons: JSON.parse(key) as string[], count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  return {
    campaign: {
      campaign_id: campaign.id,
      campaign_name: campaign.name,
      sent_at: campaign.sent_at,
      total_sent: completedLogs.length,
      success_count: successCount,
      failed_count: failedCount,
      delivered_count: deliveredCount,
      undelivered_count: undeliveredCount,
      pending_count: pendingCount,
      delivery_rate: successCount > 0 ? Math.round((deliveredCount / successCount) * 100) : 0,
      click_count: clickCount,
      unique_click_count: uniqueClickCount,
      click_rate: successCount > 0 ? Math.round((humanLikeUnique / successCount) * 100) : 0,
    },
    recipients,
    charts: {
      timeToClick,
      tagBreakdown,
    },
    click_diagnostics: {
      total: clickLogs.length,
      human_like: humanLike,
      human_like_unique: humanLikeUnique,
      suspected_automated: suspectedAutomated,
      suspected_automated_unique: suspectedAutomatedUnique,
      unknown: unknownCount,
      unknown_unique: unknownUnique,
      top_reason_sets: topReasonSets,
    },
  }
}
