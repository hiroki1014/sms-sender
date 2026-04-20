import { sendSms } from '@/lib/twilio'
import { getSupabase, saveSmsLog, ShortUrl } from '@/lib/supabase'
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

  for (const recipient of recipients) {
    if (!recipient.phone || !recipient.message) {
      failedCount++
      results.push({
        phone: recipient.phone || '不明',
        success: false,
        error: '電話番号またはメッセージが空です',
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

    const result = await sendSms(recipient.phone, processedMessage)

    if (result.success) {
      successCount++
      results.push({ phone: recipient.phone, success: true })

      try {
        const supabase = getSupabase()
        const { data: logData } = await supabase
          .from('sms_logs')
          .insert([{
            phone_number: recipient.phone,
            message: processedMessage,
            status: 'success',
            contact_id: recipient.contact_id || null,
            campaign_id: campaignId || null,
            twilio_sid: result.messageId || null,
            delivery_status: 'queued',
          }])
          .select('id')
          .single()

        if (logData && shortUrls.length > 0) {
          await supabase
            .from('short_urls')
            .update({ sms_log_id: logData.id })
            .in('id', shortUrls.map((s) => s.id))
        }
      } catch (logError) {
        console.error('Failed to save log:', logError)
      }
    } else {
      failedCount++
      results.push({
        phone: recipient.phone,
        success: false,
        error: result.error,
      })

      try {
        await saveSmsLog({
          phone_number: recipient.phone,
          message: processedMessage,
          status: 'failed',
          error_message: result.error,
          contact_id: recipient.contact_id || null,
          campaign_id: campaignId || null,
        })
      } catch (logError) {
        console.error('Failed to save log:', logError)
      }
    }
  }

  return {
    total: recipients.length,
    success: successCount,
    failed: failedCount,
    results,
  }
}
