import { createClient, SupabaseClient } from '@supabase/supabase-js'

let supabaseClient: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (!supabaseClient) {
    const url = process.env.SUPABASE_URL
    const key = process.env.SUPABASE_ANON_KEY

    if (!url || !key) {
      throw new Error('Supabase credentials are not configured')
    }

    supabaseClient = createClient(url, key)
  }

  return supabaseClient
}

export interface SmsLog {
  id?: string
  phone_number: string
  message: string
  status: 'success' | 'failed'
  error_message?: string | null
  sent_at?: string
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
