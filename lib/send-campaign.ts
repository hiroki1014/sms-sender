import { sendSms, toDomesticFormat } from '@/lib/twilio'
import { getSupabase, fetchAll, fetchAllByIn, ShortUrl } from '@/lib/supabase'
import { replaceUrlsWithShortUrls } from '@/lib/url-shortener'

export interface Recipient {
  phone: string
  message: string
  contact_id?: string | null
}

export interface SendResult {
  phone: string
  success: boolean
  error?: string
  skipped?: boolean
  skipReason?: string
}

export interface SendCampaignSummary {
  total: number
  success: number
  failed: number
  skipped: number
  isPartial: boolean
  results: SendResult[]
}

export interface SendCampaignOptions {
  recipients: Recipient[]
  dryRun?: boolean
  campaignId?: string
  deadlineMs?: number
}

const DEADLINE_SAFETY_MARGIN_MS = 30_000
const DEFAULT_CONCURRENCY = 5

async function processRecipient(ctx: {
  recipient: Recipient
  campaignId?: string
  supabase: ReturnType<typeof getSupabase>
}): Promise<SendResult> {
  const { recipient, campaignId, supabase } = ctx

  try {
    let processedMessage = recipient.message
    let shortUrls: ShortUrl[] = []

    try {
      const urlResult = await replaceUrlsWithShortUrls({
        message: recipient.message,
        contactId: recipient.contact_id ?? undefined,
        campaignId,
      })
      processedMessage = urlResult.processedMessage
      shortUrls = urlResult.shortUrls
    } catch (urlError) {
      console.error('Failed to process URLs:', urlError)
    }

    const normalizedPhone = toDomesticFormat(recipient.phone)
    const logEntry = {
      phone_number: normalizedPhone,
      message: processedMessage,
      status: 'pending' as string,
      contact_id: recipient.contact_id || null,
      campaign_id: campaignId || null,
      delivery_status: null,
    }

    let logData: { id: string } | null = null
    const { data: insertData, error: logError } = await supabase
      .from('sms_logs')
      .insert([logEntry])
      .select('id')
      .single()

    if (logError) {
      if (logError.code === '23505' && campaignId) {
        const { data: existing } = await supabase
          .from('sms_logs')
          .select('id, status, twilio_sid')
          .eq('campaign_id', campaignId)
          .eq('phone_number', normalizedPhone)
          .single()
        if (existing?.status === 'success') {
          return { phone: recipient.phone, success: true, skipped: true, skipReason: '送信済み（ユニーク制約）' }
        }
        if (existing?.status === 'pending' && existing.twilio_sid) {
          await supabase.from('sms_logs').update({ status: 'success' }).eq('id', existing.id)
          return { phone: recipient.phone, success: true }
        }
        if (existing?.status === 'pending') {
          return { phone: recipient.phone, success: false, error: '前回送信の結果が未確定のため自動再送しません' }
        }
        if (existing?.status === 'failed') {
          const { error: updateError } = await supabase
            .from('sms_logs')
            .update({
              status: 'pending' as string,
              error_message: null,
              delivery_status: null,
              delivery_updated_at: null,
              twilio_sid: null,
              price: null,
              num_segments: null,
              sent_at: new Date().toISOString(),
              message: processedMessage,
              contact_id: recipient.contact_id || null,
            })
            .eq('id', existing.id)
          if (updateError) {
            return { phone: recipient.phone, success: false, error: 'ログ更新失敗' }
          }
          logData = { id: existing.id }
        } else {
          return { phone: recipient.phone, success: false, skipped: true, skipReason: `不明なステータス: ${existing?.status}` }
        }
      } else {
        return { phone: recipient.phone, success: false, error: 'ログ作成失敗' }
      }
    } else {
      logData = insertData
    }

    if (!logData) {
      return { phone: recipient.phone, success: false, skipped: true, skipReason: 'ログデータ取得失敗' }
    }

    const result = await sendSms(recipient.phone, processedMessage)

    if (result.success) {
      let updateOk = false
      for (let retry = 0; retry < 3; retry++) {
        const { error: updateErr } = await supabase
          .from('sms_logs')
          .update({ status: 'success', twilio_sid: result.messageId || null, delivery_status: 'queued' })
          .eq('id', logData.id)
        if (!updateErr) { updateOk = true; break }
        console.error(`Failed to update log to success (attempt ${retry + 1}):`, updateErr)
      }
      if (!updateOk) {
        console.error('All retries failed, pending row remains:', logData.id)
        return { phone: recipient.phone, success: false, error: 'SMS送信済みだがログ更新失敗（未確定）' }
      }

      if (shortUrls.length > 0) {
        await supabase
          .from('short_urls')
          .update({ sms_log_id: logData.id })
          .in('id', shortUrls.map((s) => s.id))
      }

      return { phone: recipient.phone, success: true }
    } else {
      let failUpdateOk = false
      for (let retry = 0; retry < 3; retry++) {
        const { error: updateErr } = await supabase
          .from('sms_logs')
          .update({ status: 'failed', error_message: result.error })
          .eq('id', logData.id)
        if (!updateErr) { failUpdateOk = true; break }
        console.error(`Failed to update log to failed (attempt ${retry + 1}):`, updateErr)
      }
      if (!failUpdateOk) {
        try {
          await supabase
            .from('sms_logs')
            .update({ error_message: 'SMS送信失敗・ログ更新も3回失敗（要確認）' })
            .eq('id', logData.id)
        } catch {
          console.error('Failed to update error_message for stuck pending log:', logData.id)
        }
      }

      return { phone: recipient.phone, success: false, error: result.error }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`processRecipient unexpected error for ${recipient.phone} (campaign: ${campaignId || 'none'}):`, err)
    return { phone: recipient.phone, success: false, error: message }
  }
}

export async function sendCampaign({
  recipients,
  dryRun = false,
  campaignId,
  deadlineMs,
}: SendCampaignOptions): Promise<SendCampaignSummary> {
  let successCount = 0
  let failedCount = 0
  let skippedCount = 0
  let isPartial = false
  const results: SendResult[] = []

  // 冪等性: successの宛先はスキップ。pending/failedは再試行対象。
  const alreadySent = new Set<string>()
  if (campaignId && !dryRun) {
    const logs = await fetchAll(s => s
      .from('sms_logs')
      .select('phone_number, status')
      .eq('campaign_id', campaignId)
      .order('sent_at', { ascending: true })
      .order('id', { ascending: true })
    )
    logs.forEach(l => {
      if (l.status === 'success') {
        alreadySent.add(toDomesticFormat(l.phone_number))
      }
    })
  }

  // opt-out チェック用: contact_id がある宛先は事前にまとめて確認
  const contactIds = recipients.map(r => r.contact_id).filter(Boolean) as string[]
  const optedOutIds = new Set<string>()
  if (contactIds.length > 0) {
    const optedOut = await fetchAllByIn(
      (s, batch) => s.from('contacts').select('id').in('id', batch).eq('opted_out', true).order('id', { ascending: true }),
      contactIds
    )
    optedOut.forEach(c => optedOutIds.add(c.id))
  }

  // Phase 1: 同期フィルタ — 送信不要な宛先を事前に除外
  const toProcess: Recipient[] = []
  for (const recipient of recipients) {
    if (deadlineMs && Date.now() >= deadlineMs - DEADLINE_SAFETY_MARGIN_MS) {
      isPartial = true
      break
    }

    if (campaignId && alreadySent.has(toDomesticFormat(recipient.phone))) {
      skippedCount++
      results.push({ phone: recipient.phone, success: true, skipped: true, skipReason: '送信済み（スキップ）' })
      continue
    }

    if (!recipient.phone || !recipient.message) {
      failedCount++
      results.push({ phone: recipient.phone || '不明', success: false, error: '電話番号またはメッセージが空です' })
      continue
    }

    if (recipient.contact_id && optedOutIds.has(recipient.contact_id)) {
      failedCount++
      results.push({ phone: recipient.phone, success: false, error: '配信停止中' })
      continue
    }

    if (dryRun) {
      successCount++
      results.push({ phone: recipient.phone, success: true })
      continue
    }

    toProcess.push(recipient)
  }

  // Phase 2: バッチ並行送信
  const parsed = parseInt(process.env.SMS_CONCURRENCY || String(DEFAULT_CONCURRENCY), 10)
  const concurrency = Number.isNaN(parsed) || parsed < 1 ? DEFAULT_CONCURRENCY : parsed
  const supabase = getSupabase()

  for (let i = 0; i < toProcess.length; i += concurrency) {
    if (deadlineMs && Date.now() >= deadlineMs - DEADLINE_SAFETY_MARGIN_MS) {
      isPartial = true
      break
    }

    const batch = toProcess.slice(i, i + concurrency)
    const batchResults = await Promise.allSettled(
      batch.map(recipient => processRecipient({ recipient, campaignId, supabase }))
    )

    for (const settled of batchResults) {
      if (settled.status === 'fulfilled') {
        const r = settled.value
        results.push(r)
        if (r.skipped) skippedCount++
        else if (r.success) successCount++
        else failedCount++
      } else {
        failedCount++
        results.push({ phone: '不明', success: false, error: settled.reason?.message || '予期しないエラー' })
      }
    }
  }

  return {
    total: successCount + failedCount + skippedCount,
    success: successCount,
    failed: failedCount,
    skipped: skippedCount,
    isPartial,
    results,
  }
}
