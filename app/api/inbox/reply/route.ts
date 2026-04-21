import { NextRequest, NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth'
import { getSupabase } from '@/lib/supabase'
import { sendSms, toDomesticFormat } from '@/lib/twilio'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const authenticated = await isAuthenticated()
    if (!authenticated) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const { phone_number, message } = await request.json()

    if (!phone_number || !message) {
      return NextResponse.json({ error: '電話番号とメッセージが必要です' }, { status: 400 })
    }

    const supabase = getSupabase()
    const domestic = toDomesticFormat(phone_number)

    const { data: contact } = await supabase
      .from('contacts')
      .select('id, opted_out')
      .eq('phone_number', domestic)
      .limit(1)
      .single()

    if (contact?.opted_out) {
      return NextResponse.json({ error: '配信停止中のため送信できません' }, { status: 400 })
    }

    const result = await sendSms(phone_number, message)

    if (!result.success) {
      return NextResponse.json({ error: result.error || '送信に失敗しました' }, { status: 500 })
    }

    await supabase
      .from('sms_logs')
      .insert([{
        phone_number: domestic,
        message,
        status: 'success',
        contact_id: contact?.id || null,
        campaign_id: null,
        twilio_sid: result.messageId || null,
        delivery_status: 'queued',
      }])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Reply error:', error)
    return NextResponse.json({ error: '返信に失敗しました' }, { status: 500 })
  }
}
