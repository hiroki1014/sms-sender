import { sendSms, toDomesticFormat } from '@/lib/twilio'
import { getSupabase, fetchAll, fetchAllByIn, saveSmsLog, ShortUrl } from '@/lib/supabase'
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
}

export interface SendCampaignSummary {
  total: number
  success: number
  failed: number
  results: SendResult[]
}

export interface SendCampaignOptions {
  recipients: Recipient[]
  dryRun?: boolean
  campaignId?: string
}

export async function sendCampaign({
  recipients,
  dryRun = false,
  campaignId,
}: SendCampaignOptions): Promise<SendCampaignSummary> {
  let successCount = 0
  let failedCount = 0
  const results: SendResult[] = []

  // 冪等性: success/failedの宛先のみスキップ。pendingは再試行対象。
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

  for (const recipient of recipients) {
    if (campaignId && alreadySent.has(toDomesticFormat(recipient.phone))) {
      continue
    }

    if (!recipient.phone || !recipient.message) {
      failedCount++
      results.push({
        phone: recipient.phone || '不明',
        success: false,
        error: '電話番号またはメッセージが空です',
      })
      continue
    }

    // 配信停止済みの連絡先はスキップ
    if (recipient.contact_id && optedOutIds.has(recipient.contact_id)) {
      failedCount++
      results.push({
        phone: recipient.phone,
        success: false,
        error: '配信停止中',
      })
      continue
    }

    let processedMessage = recipient.message
    let shortUrls: ShortUrl[] = []

    if (!dryRun) {
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
    }

    if (dryRun) {
      successCount++
      results.push({ phone: recipient.phone, success: true })
      continue
    }

    const supabase = getSupabase()
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
          continue
        }
        if (existing?.status === 'pending' && existing.twilio_sid) {
          await supabase.from('sms_logs').update({ status: 'success' }).eq('id', existing.id)
          successCount++
          results.push({ phone: recipient.phone, success: true })
          alreadySent.add(normalizedPhone)
          continue
        }
        if (existing?.status === 'pending') {
          failedCount++
          results.push({ phone: recipient.phone, success: false, error: '前回送信の結果が未確定のため自動再送しません' })
          continue
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
            failedCount++
            results.push({ phone: recipient.phone, success: false, error: 'ログ更新失敗' })
            continue
          }
          logData = { id: existing.id }
        } else {
          continue
        }
      } else {
        failedCount++
        results.push({ phone: recipient.phone, success: false, error: 'ログ作成失敗' })
        continue
      }
    } else {
      logData = insertData
    }

    if (!logData) { continue }

    const result = await sendSms(recipient.phone, processedMessage)

    if (result.success) {
      alreadySent.add(toDomesticFormat(recipient.phone))
      successCount++
      results.push({ phone: recipient.phone, success: true })

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
        successCount--
        failedCount++
        results[results.length - 1] = { phone: recipient.phone, success: false, error: 'SMS送信済みだがログ更新失敗（未確定）' }
      }

      if (shortUrls.length > 0) {
        await supabase
          .from('short_urls')
          .update({ sms_log_id: logData.id })
          .in('id', shortUrls.map((s) => s.id))
      }
    } else {
      alreadySent.add(toDomesticFormat(recipient.phone))
      failedCount++
      results.push({ phone: recipient.phone, success: false, error: result.error })

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
        // pending のまま残るが、Twilio側は失敗確定なので削除して次回再試行可能にする
        await supabase.from('sms_logs').delete().eq('id', logData.id)
      }
    }
  }

  return {
    total: successCount + failedCount,
    success: successCount,
    failed: failedCount,
    results,
  }
}
