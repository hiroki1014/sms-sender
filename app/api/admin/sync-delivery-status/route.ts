import { NextRequest, NextResponse } from 'next/server'
import Twilio from 'twilio'
import { isAuthenticated } from '@/lib/auth'
import { getSupabase, TwilioDeliveryStatus } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Twilio API から該当メッセージの最新ステータスを取得して sms_logs を更新
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

    // 対象: twilio_sid が入っていて delivery_status が未確定 (null or queued/sending/accepted/sent)
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

    const client = Twilio(accountSid, authToken)
    let updated = 0
    let unchanged = 0
    let failed = 0
    const details: Array<{ sid: string; status: string | null; error?: string }> = []

    for (const log of logs || []) {
      if (!log.twilio_sid) continue
      try {
        const msg = await client.messages(log.twilio_sid).fetch()
        const status = msg.status as TwilioDeliveryStatus

        if (status === log.delivery_status) {
          unchanged++
          details.push({ sid: log.twilio_sid, status })
          continue
        }

        const updates: Record<string, unknown> = {
          delivery_status: status,
          delivery_updated_at: new Date().toISOString(),
        }
        if (msg.errorCode) {
          updates.error_message = `Twilio error ${msg.errorCode}${msg.errorMessage ? `: ${msg.errorMessage}` : ''}`
        }

        const { error: upErr } = await supabase
          .from('sms_logs')
          .update(updates)
          .eq('id', log.id)

        if (upErr) {
          failed++
          details.push({ sid: log.twilio_sid, status, error: upErr.message })
        } else {
          updated++
          details.push({ sid: log.twilio_sid, status })
        }
      } catch (err) {
        failed++
        const message = err instanceof Error ? err.message : String(err)
        details.push({ sid: log.twilio_sid, status: null, error: message })
      }
    }

    return NextResponse.json({
      scanned: logs?.length || 0,
      updated,
      unchanged,
      failed,
      details,
    })
  } catch (error) {
    console.error('Sync delivery status error:', error)
    return NextResponse.json({ error: '同期に失敗しました' }, { status: 500 })
  }
}
