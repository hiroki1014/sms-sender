import { NextRequest, NextResponse } from 'next/server'
import Twilio from 'twilio'
import { isAuthenticated } from '@/lib/auth'
import { getSupabase, TwilioDeliveryStatus } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

async function processLog(
  client: Twilio.Twilio,
  supabase: ReturnType<typeof getSupabase>,
  log: { id: string; twilio_sid: string; delivery_status: string | null }
): Promise<{ sid: string; status: string | null; action: 'updated' | 'unchanged' | 'failed'; error?: string }> {
  try {
    const msg = await client.messages(log.twilio_sid).fetch()
    const status = msg.status as TwilioDeliveryStatus

    if (status === log.delivery_status) {
      return { sid: log.twilio_sid, status, action: 'unchanged' }
    }

    const updates: Record<string, unknown> = {
      delivery_status: status,
      delivery_updated_at: new Date().toISOString(),
    }
    if (msg.errorCode) {
      updates.error_message = `Twilio error ${msg.errorCode}${msg.errorMessage ? `: ${msg.errorMessage}` : ''}`
    }
    if (msg.price) {
      updates.price = Math.abs(parseFloat(msg.price))
    }
    if (msg.numSegments) {
      updates.num_segments = parseInt(msg.numSegments, 10)
    }

    const { error } = await supabase
      .from('sms_logs')
      .update(updates)
      .eq('id', log.id)

    if (error) {
      return { sid: log.twilio_sid, status, action: 'failed', error: error.message }
    }
    return { sid: log.twilio_sid, status, action: 'updated' }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { sid: log.twilio_sid, status: null, action: 'failed', error: message }
  }
}

export async function POST(request: NextRequest) {
  try {
    const authenticated = await isAuthenticated()
    if (!authenticated) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN
    if (!accountSid || !authToken) {
      return NextResponse.json(
        { error: 'Twilio credentials are not configured' },
        { status: 500 }
      )
    }

    const UNFINISHED = ['queued', 'sending', 'accepted', 'sent']

    const supabase = getSupabase()
    const { data: logs, error } = await supabase
      .from('sms_logs')
      .select('id, twilio_sid, delivery_status')
      .not('twilio_sid', 'is', null)
      .or(`delivery_status.is.null,delivery_status.in.(${UNFINISHED.join(',')})`)
      .limit(500)

    if (error) {
      console.error('Fetch sms_logs error:', error)
      return NextResponse.json({ error: 'DB取得に失敗しました' }, { status: 500 })
    }

    const validLogs = (logs || []).filter(l => l.twilio_sid) as Array<{ id: string; twilio_sid: string; delivery_status: string | null }>
    const client = Twilio(accountSid, authToken)

    // 並列10で Twilio API を叩く
    const CONCURRENCY = 10
    const results: Array<{ sid: string; status: string | null; action: string; error?: string }> = []

    for (let i = 0; i < validLogs.length; i += CONCURRENCY) {
      const batch = validLogs.slice(i, i + CONCURRENCY)
      const batchResults = await Promise.all(
        batch.map(log => processLog(client, supabase, log))
      )
      results.push(...batchResults)
    }

    const updated = results.filter(r => r.action === 'updated').length
    const unchanged = results.filter(r => r.action === 'unchanged').length
    const failed = results.filter(r => r.action === 'failed').length

    return NextResponse.json({
      scanned: validLogs.length,
      updated,
      unchanged,
      failed,
      details: results,
    })
  } catch (error) {
    console.error('Sync delivery status error:', error)
    return NextResponse.json({ error: '同期に失敗しました' }, { status: 500 })
  }
}
