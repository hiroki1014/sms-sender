import { NextRequest, NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth'
import { getSupabase, fetchAll, fetchAllByIn } from '@/lib/supabase'
import { normalizePhoneNumber, toDomesticFormat } from '@/lib/twilio'

export const dynamic = 'force-dynamic'

interface ThreadMessage {
  id: string
  direction: 'inbound' | 'outbound'
  body: string
  timestamp: string
  campaign_name?: string
  is_opt_out?: boolean
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ phone: string }> }
) {
  try {
    const authenticated = await isAuthenticated()
    if (!authenticated) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const { phone } = await params
    const domestic = toDomesticFormat(phone)
    const e164 = normalizePhoneNumber(domestic)

    const supabase = getSupabase()

    const incoming = await fetchAll(s => s
      .from('incoming_messages')
      .select('id, body, received_at, is_opt_out, is_read')
      .or(`from_number.eq.${domestic},from_number.eq.${e164}`)
      .order('received_at', { ascending: true })
      .order('id', { ascending: true })
    )

    const outgoing = await fetchAll(s => s
      .from('sms_logs')
      .select('id, message, sent_at, campaign_id')
      .or(`phone_number.eq.${domestic},phone_number.eq.${e164}`)
      .order('sent_at', { ascending: true })
      .order('id', { ascending: true })
    )

    const campaignIds = Array.from(
      new Set(outgoing.map(m => m.campaign_id).filter(Boolean))
    )
    let campaignMap: Record<string, string> = {}
    if (campaignIds.length > 0) {
      const campaigns = await fetchAllByIn(
        (s, batch) => s.from('campaigns').select('id, name').in('id', batch).order('id', { ascending: true }),
        campaignIds
      )
      campaigns.forEach(c => { campaignMap[c.id] = c.name })
    }

    const messages: ThreadMessage[] = []

    for (const msg of incoming) {
      messages.push({
        id: msg.id,
        direction: 'inbound',
        body: msg.body,
        timestamp: msg.received_at,
        is_opt_out: msg.is_opt_out || false,
      })
    }

    for (const msg of outgoing) {
      messages.push({
        id: msg.id,
        direction: 'outbound',
        body: msg.message,
        timestamp: msg.sent_at,
        campaign_name: msg.campaign_id ? campaignMap[msg.campaign_id] : undefined,
      })
    }

    messages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

    const unreadIds = incoming
      .filter(m => !m.is_read)
      .map(m => m.id)
    if (unreadIds.length > 0) {
      const BATCH = 100
      for (let i = 0; i < unreadIds.length; i += BATCH) {
        await supabase
          .from('incoming_messages')
          .update({ is_read: true })
          .in('id', unreadIds.slice(i, i + BATCH))
      }
    }

    const { data: contact } = await supabase
      .from('contacts')
      .select('name, phone_number, opted_out')
      .or(`phone_number.eq.${domestic},phone_number.eq.${e164}`)
      .limit(1)
      .single()

    return NextResponse.json({
      contact: contact
        ? { name: contact.name, phone: contact.phone_number, opted_out: contact.opted_out }
        : { name: null, phone: domestic, opted_out: false },
      messages,
    })
  } catch (error) {
    console.error('Conversation thread error:', error)
    return NextResponse.json({ error: '会話の取得に失敗しました' }, { status: 500 })
  }
}
