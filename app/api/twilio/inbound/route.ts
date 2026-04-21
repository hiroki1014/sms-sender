import { NextRequest, NextResponse } from 'next/server'
import Twilio from 'twilio'
import { getSupabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const OPT_OUT_KEYWORDS_JA = ['停止', '配信停止', '不要', 'やめて', '止めて', '拒否']
const OPT_OUT_KEYWORDS_EN = ['stop', 'unsubscribe', 'stopall', 'cancel', 'end', 'quit']

function isOptOut(body: string): boolean {
  const trimmed = body.trim().toLowerCase()
  if (OPT_OUT_KEYWORDS_EN.includes(trimmed)) return true
  return OPT_OUT_KEYWORDS_JA.some(kw => trimmed.includes(kw))
}

function verifyTwilioSignature(
  request: NextRequest,
  url: string,
  params: Record<string, string>
): boolean {
  const skipVerify = process.env.TWILIO_SKIP_SIGNATURE_VERIFY === 'true'
  if (skipVerify) return true

  const authToken = process.env.TWILIO_AUTH_TOKEN
  const signature = request.headers.get('x-twilio-signature')

  if (!authToken || !signature) return false

  return Twilio.validateRequest(authToken, signature, url, params)
}

// Twilio に返す TwiML（空 = 自動返信を送らない）
function emptyTwiml(): NextResponse {
  return new NextResponse(
    '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
    { status: 200, headers: { 'Content-Type': 'text/xml' } }
  )
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const params: Record<string, string> = {}
    formData.forEach((value, key) => {
      params[key] = typeof value === 'string' ? value : ''
    })

    const url =
      process.env.TWILIO_INBOUND_WEBHOOK_URL ||
      `${request.nextUrl.origin}${request.nextUrl.pathname}`

    if (!verifyTwilioSignature(request, url, params)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 403 })
    }

    const sid = params.MessageSid || null
    const from = params.From || ''
    const to = params.To || ''
    const body = params.Body || ''

    if (!from || !body) {
      return emptyTwiml()
    }

    const supabase = getSupabase()

    // 送信元番号で contacts を検索（+81 と 0 始まりの両方で照合）
    const fromDigits = from.replace(/\D/g, '')
    let domesticNumber = from
    if (fromDigits.startsWith('81')) {
      domesticNumber = '0' + fromDigits.slice(2)
    }

    const { data: contact } = await supabase
      .from('contacts')
      .select('id')
      .or(`phone_number.eq.${from},phone_number.eq.${domesticNumber}`)
      .limit(1)
      .single()

    let contactId = contact?.id || null
    const optOut = isOptOut(body)

    // opt-out かつ未登録番号の場合、連絡先を自動作成
    if (!contactId && optOut) {
      const { data: newContact } = await supabase
        .from('contacts')
        .insert([{ phone_number: domesticNumber, opted_out: true, opted_out_at: new Date().toISOString() }])
        .select('id')
        .single()
      contactId = newContact?.id || null
    }

    // 受信メッセージを保存
    await supabase
      .from('incoming_messages')
      .insert([{
        twilio_sid: sid,
        from_number: from,
        to_number: to,
        body,
        contact_id: contactId,
        is_opt_out: optOut,
      }])

    // opt-out 判定 → contacts を更新
    if (optOut && contactId) {
      await supabase
        .from('contacts')
        .update({
          opted_out: true,
          opted_out_at: new Date().toISOString(),
        })
        .eq('id', contactId)
    }

    return emptyTwiml()
  } catch (error) {
    console.error('Inbound SMS error:', error)
    return emptyTwiml()
  }
}
