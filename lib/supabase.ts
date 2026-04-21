import { createClient, SupabaseClient } from '@supabase/supabase-js'

let supabaseClient: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (!supabaseClient) {
    const url = process.env.SUPABASE_URL
    // サーバーサイドではSecret Keyを使用（新しいSupabase認証モデル）
    const key = process.env.SUPABASE_SECRET_KEY

    if (!url || !key) {
      throw new Error('Supabase credentials are not configured. Check SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local')
    }

    supabaseClient = createClient(url, key)
  }

  return supabaseClient
}

// Twilio Status Callback で通知される MessageStatus
// https://www.twilio.com/docs/messaging/guides/webhook-request
export type TwilioDeliveryStatus =
  | 'queued'
  | 'sending'
  | 'sent'
  | 'delivered'
  | 'undelivered'
  | 'failed'
  | 'accepted'
  | 'scheduled'
  | 'read'
  | 'canceled'

export interface SmsLog {
  id?: string
  phone_number: string
  message: string
  status: 'success' | 'failed'
  error_message?: string | null
  contact_id?: string | null
  campaign_id?: string | null
  twilio_sid?: string | null
  delivery_status?: TwilioDeliveryStatus | null
  delivery_updated_at?: string | null
  sent_at?: string
}

export interface CampaignRecipient {
  phone: string
  message: string
  contact_id?: string | null
}

export interface Campaign {
  id?: string
  name: string
  message_template: string
  status: 'draft' | 'sent' | 'scheduled' | 'sending'
  sent_at?: string | null
  scheduled_at?: string | null
  recipients_snapshot?: CampaignRecipient[] | null
  last_error?: string | null
  created_at?: string
}

export interface ShortUrl {
  id?: string
  code: string
  original_url: string
  sms_log_id?: string | null
  contact_id?: string | null
  campaign_id?: string | null
  created_at?: string
}

export interface ClickLog {
  id?: string
  short_url_id: string
  clicked_at?: string
  user_agent?: string | null
  ip_address?: string | null
}

export interface IncomingMessage {
  id?: string
  twilio_sid?: string | null
  from_number: string
  to_number: string
  body: string
  contact_id?: string | null
  received_at?: string
  is_opt_out?: boolean
}

export async function saveSmsLog(log: Omit<SmsLog, 'id' | 'sent_at'>): Promise<void> {
  const supabase = getSupabase()

  const { error } = await supabase
    .from('sms_logs')
    .insert([log])

  if (error) {
    console.error('Failed to save SMS log:', error)
    throw error
  }
}

export async function getSmsLogs(limit: number = 100): Promise<SmsLog[]> {
  const supabase = getSupabase()

  const { data, error } = await supabase
    .from('sms_logs')
    .select('*')
    .order('sent_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Failed to fetch SMS logs:', error)
    throw error
  }

  return data || []
}
