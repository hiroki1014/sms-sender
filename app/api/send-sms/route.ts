import { NextRequest, NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth'
import { sendSms } from '@/lib/twilio'
import { saveSmsLog, getSupabase, ShortUrl } from '@/lib/supabase'
import { replaceUrlsWithShortUrls } from '@/lib/url-shortener'

interface Recipient {
  phone: string
  message: string
  contact_id?: string
}

export async function POST(request: NextRequest) {
  try {
    // 認証チェック
    const authenticated = await isAuthenticated()
    if (!authenticated) {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { recipients, dryRun, campaignId } = body as {
      recipients: Recipient[]
      dryRun?: boolean
      campaignId?: string
    }

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return NextResponse.json(
        { error: '送信先が指定されていません' },
        { status: 400 }
      )
    }

    let successCount = 0
    let failedCount = 0
    const results: Array<{
      phone: string
      success: boolean
      error?: string
    }> = []

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

      // メッセージ内のURLを短縮URLに置換
      let processedMessage = recipient.message
      let shortUrls: ShortUrl[] = []

      if (!dryRun) {
        try {
          const urlResult = await replaceUrlsWithShortUrls({
            message: recipient.message,
            contactId: recipient.contact_id,
            campaignId,
          })
          processedMessage = urlResult.processedMessage
          shortUrls = urlResult.shortUrls
        } catch (urlError) {
          console.error('Failed to process URLs:', urlError)
          // URL処理に失敗しても送信は継続（元のメッセージを使用）
        }
      }

      if (dryRun) {
        // ドライラン: 実際には送信しない
        successCount++
        results.push({
          phone: recipient.phone,
          success: true,
        })
        continue
      }

      // 実際に送信（短縮URL置換済みのメッセージ）
      const result = await sendSms(recipient.phone, processedMessage)

      if (result.success) {
        successCount++
        results.push({
          phone: recipient.phone,
          success: true,
        })

        // ログを保存してsms_log_idを取得
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
            }])
            .select('id')
            .single()

          // 短縮URLとsms_logを紐付け
          if (logData && shortUrls.length > 0) {
            await supabase
              .from('short_urls')
              .update({ sms_log_id: logData.id })
              .in('id', shortUrls.map(s => s.id))
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

        // 失敗ログも保存
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

    return NextResponse.json({
      total: recipients.length,
      success: successCount,
      failed: failedCount,
      dryRun: dryRun || false,
      results,
    })
  } catch (error) {
    console.error('Send SMS error:', error)
    return NextResponse.json(
      { error: 'SMS送信中にエラーが発生しました' },
      { status: 500 }
    )
  }
}
