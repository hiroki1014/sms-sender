import { NextRequest, NextResponse } from 'next/server'
import Twilio from 'twilio'
import { getSupabase, TwilioDeliveryStatus } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const ALLOWED_STATUSES: TwilioDeliveryStatus[] = [
  'queued',
  'sending',
  'sent',
  'delivered',
  'undelivered',
  'failed',
  'accepted',
  'scheduled',
  'read',
  'canceled',
]

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

export async function POST(request: NextRequest) {
  try {
    // Twilio は application/x-www-form-urlencoded で送ってくる
    const formData = await request.formData()
    const params: Record<string, string> = {}
    formData.forEach((value, key) => {
      params[key] = typeof value === 'string' ? value : ''
    })

    const url =
      process.env.TWILIO_STATUS_CALLBACK_URL ||
      `${request.nextUrl.origin}${request.nextUrl.pathname}`

    if (!verifyTwilioSignature(request, url, params)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 403 })
    }

    const sid = params.MessageSid
    const status = params.MessageStatus as TwilioDeliveryStatus | undefined
    const errorCode = params.ErrorCode

    if (!sid || !status) {
      return NextResponse.json(
        { error: 'MessageSid and MessageStatus are required' },
        { status: 400 }
      )
    }

    if (!ALLOWED_STATUSES.includes(status)) {
      console.warn(`Unknown MessageStatus received: ${status}`)
    }

    const supabase = getSupabase()
    const updates: Record<string, unknown> = {
      delivery_status: status,
      delivery_updated_at: new Date().toISOString(),
    }

    if ((status === 'undelivered' || status === 'failed') && errorCode) {
      updates.error_message = `Twilio error ${errorCode}`
    }

    const { error } = await supabase
      .from('sms_logs')
      .update(updates)
      .eq('twilio_sid', sid)

    if (error) {
      console.error('Failed to update sms_logs:', error)
      return NextResponse.json({ error: 'DB update failed' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Status callback error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
