import { NextRequest, NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth'
import { getSupabase, fetchAll, fetchAllByIn } from '@/lib/supabase'
import { normalizePhoneNumber, toDomesticFormat } from '@/lib/twilio'
import { classifyClicks, ClickWithContext } from '@/lib/click-diagnostics'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authenticated = await isAuthenticated()
    if (!authenticated) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const { id } = await params
    const supabase = getSupabase()

    const { data: contact, error: contactError } = await supabase
      .from('contacts')
      .select('id, name, phone_number, tags, opted_out, created_at')
      .eq('id', id)
      .single()

    if (contactError || !contact) {
      return NextResponse.json({ error: '顧客が見つかりません' }, { status: 404 })
    }

    const domestic = toDomesticFormat(contact.phone_number)
    const e164 = normalizePhoneNumber(domestic)

    const smsLogs = await fetchAll(s => s
      .from('sms_logs')
      .select('id, message, sent_at, campaign_id, delivery_status, status')
      .or(`contact_id.eq.${id},phone_number.eq.${domestic},phone_number.eq.${e164}`)
      .order('sent_at', { ascending: false })
      .order('id', { ascending: true })
    )

    const incoming = await fetchAll(s => s
      .from('incoming_messages')
      .select('id, body, received_at, is_opt_out')
      .or(`contact_id.eq.${id},from_number.eq.${domestic},from_number.eq.${e164}`)
      .order('received_at', { ascending: false })
      .order('id', { ascending: true })
    )

    const campaignIds = Array.from(new Set(smsLogs.map(l => l.campaign_id).filter(Boolean)))
    let campaignMap: Record<string, string> = {}
    if (campaignIds.length > 0) {
      const campaigns = await fetchAllByIn(
        (s, batch) => s.from('campaigns').select('id, name').in('id', batch).order('id', { ascending: true }),
        campaignIds
      )
      campaigns.forEach(c => { campaignMap[c.id] = c.name })
    }

    const smsLogIds = smsLogs.map(l => l.id)
    let clickEvents: Array<{ timestamp: string; original_url: string; campaign_name?: string }> = []
    if (smsLogIds.length > 0) {
      const byContact = await fetchAll(s => s
        .from('short_urls')
        .select('id, original_url, campaign_id, sms_log_id')
        .eq('contact_id', id)
        .order('id', { ascending: true })
      )
      const bySmsLog = await fetchAllByIn(
        (s, batch) => s.from('short_urls').select('id, original_url, campaign_id, sms_log_id').in('sms_log_id', batch).order('id', { ascending: true }),
        smsLogIds
      )
      const shortUrlMap = new Map<string, typeof byContact[0]>()
      ;[...byContact, ...bySmsLog].forEach(s => shortUrlMap.set(s.id, s))
      const shortUrls = Array.from(shortUrlMap.values())

      if (shortUrls.length > 0) {
        const shortUrlIds = shortUrls.map(s => s.id)
        const clicks = await fetchAllByIn(
          (s, batch) => s.from('click_logs').select('id, short_url_id, clicked_at, user_agent, ip_address, sec_fetch_mode, sec_fetch_dest').in('short_url_id', batch).order('clicked_at', { ascending: false }).order('id', { ascending: true }),
          shortUrlIds
        )

        const smsLogSentAtMap = new Map<string, string>()
        smsLogs.forEach(log => {
          if (log.sent_at) smsLogSentAtMap.set(log.id, log.sent_at)
        })
        const suToSmsLogId = new Map<string, string>()
        shortUrls.forEach(su => {
          if (su.sms_log_id) suToSmsLogId.set(su.id, su.sms_log_id)
        })
        const clicksCtx: ClickWithContext[] = clicks.map(click => {
          const smsLogId = suToSmsLogId.get(click.short_url_id)
          const sentAt = smsLogId ? smsLogSentAtMap.get(smsLogId) ?? null : null
          return {
            id: click.id, short_url_id: click.short_url_id, clicked_at: click.clicked_at,
            user_agent: click.user_agent ?? null, ip_address: click.ip_address ?? null,
            sec_fetch_mode: click.sec_fetch_mode ?? null, sec_fetch_dest: click.sec_fetch_dest ?? null,
            sent_at: sentAt,
          }
        })
        const classifiedClicks = classifyClicks(clicksCtx)
        const humanClickIds = new Set(classifiedClicks.filter(c => c.classification === 'human_like').map(c => c.id))

        const urlMap = new Map(shortUrls.map(s => [s.id, s]))
        clicks.forEach(click => {
          if (!humanClickIds.has(click.id)) return
          const su = urlMap.get(click.short_url_id)
          if (su) {
            clickEvents.push({
              timestamp: click.clicked_at,
              original_url: su.original_url,
              campaign_name: su.campaign_id ? campaignMap[su.campaign_id] : undefined,
            })
          }
        })
      }
    }

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

    const timeline: TimelineEntry[] = []

    for (const log of smsLogs) {
      timeline.push({
        type: 'sent',
        timestamp: log.sent_at,
        campaign_name: log.campaign_id ? campaignMap[log.campaign_id] : undefined,
        message: log.message,
        delivery_status: log.delivery_status,
      })
    }

    for (const msg of incoming) {
      timeline.push({
        type: 'received',
        timestamp: msg.received_at,
        body: msg.body,
        is_opt_out: msg.is_opt_out,
      })
    }

    for (const click of clickEvents) {
      timeline.push({
        type: 'clicked',
        timestamp: click.timestamp,
        original_url: click.original_url,
        campaign_name: click.campaign_name,
      })
    }

    timeline.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    return NextResponse.json({ contact, timeline })
  } catch (error) {
    console.error('Timeline error:', error)
    return NextResponse.json({ error: 'タイムラインの取得に失敗しました' }, { status: 500 })
  }
}
