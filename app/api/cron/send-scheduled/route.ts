import { NextRequest, NextResponse } from 'next/server'
import { getSupabase, fetchAll, Campaign } from '@/lib/supabase'
import { sendCampaign } from '@/lib/send-campaign'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const STALE_MS = 5 * 60 * 1000

interface CampaignResult {
  id: string
  name: string
  total: number
  success: number
  failed: number
  skipped: number
  status: 'sent' | 'failed' | 'sending'
  error?: string
}

export async function GET(request: NextRequest) {
  const expected = process.env.CRON_SECRET
  if (!expected) {
    console.error('CRON_SECRET is not configured')
    return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 500 })
  }

  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabase()
  const now = new Date().toISOString()

  let due: Campaign[]
  try {
    due = await fetchAll(s => s
      .from('campaigns')
      .select('*')
      .in('status', ['scheduled', 'sending'])
      .lte('scheduled_at', now)
      .order('scheduled_at', { ascending: true })
      .order('id', { ascending: true })
    )
  } catch (fetchError) {
    console.error('Fetch scheduled campaigns error:', fetchError)
    return NextResponse.json({ error: 'キャンペーン取得に失敗しました' }, { status: 500 })
  }

  const campaigns = due
  const results: CampaignResult[] = []
  const deadlineMs = Date.now() + 270_000

  for (const campaign of campaigns) {
    if (!campaign.id) continue

    if (campaign.status === 'sending') {
      const { data: latestLog } = await supabase
        .from('sms_logs')
        .select('sent_at')
        .eq('campaign_id', campaign.id)
        .order('sent_at', { ascending: false })
        .limit(1)
        .single()

      if (latestLog) {
        const elapsed = Date.now() - new Date(latestLog.sent_at).getTime()
        if (elapsed < STALE_MS) {
          continue
        }
      }
    }

    if (campaign.status === 'scheduled') {
      const { data: lockData, error: lockError } = await supabase
        .from('campaigns')
        .update({ status: 'sending' })
        .eq('id', campaign.id)
        .eq('status', 'scheduled')
        .select('id')

      if (lockError || !lockData || lockData.length === 0) {
        console.error(`Lock failed for campaign ${campaign.id}:`, lockError || 'already locked')
        continue
      }
    }

    const recipients = campaign.recipients_snapshot || []

    if (recipients.length === 0) {
      await supabase
        .from('campaigns')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          last_error: '送信先が空のため送信しませんでした',
        })
        .eq('id', campaign.id)
      results.push({
        id: campaign.id,
        name: campaign.name,
        total: 0,
        success: 0,
        failed: 0,
        skipped: 0,
        status: 'sent',
      })
      continue
    }

    try {
      const summary = await sendCampaign({
        recipients,
        campaignId: campaign.id,
        deadlineMs,
      })

      if (summary.isPartial) {
        await supabase
          .from('campaigns')
          .update({
            last_error: `送信中: ${summary.success}件成功, ${summary.failed}件失敗, 残り${recipients.length - summary.total}件`,
          })
          .eq('id', campaign.id)

        results.push({
          id: campaign.id,
          name: campaign.name,
          total: summary.total,
          success: summary.success,
          failed: summary.failed,
          skipped: summary.skipped,
          status: 'sending',
        })
      } else {
        const allFailed = summary.failed > 0 && summary.success === 0 && summary.skipped < summary.total
        const firstError = summary.results.find((r) => !r.success && !r.skipped)?.error

        await supabase
          .from('campaigns')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            last_error: allFailed ? firstError || '全件送信失敗' : null,
          })
          .eq('id', campaign.id)

        results.push({
          id: campaign.id,
          name: campaign.name,
          total: summary.total,
          success: summary.success,
          failed: summary.failed,
          skipped: summary.skipped,
          status: 'sent',
        })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`Campaign ${campaign.id} send error:`, err)
      await supabase
        .from('campaigns')
        .update({ status: 'scheduled', last_error: message })
        .eq('id', campaign.id)
      results.push({
        id: campaign.id,
        name: campaign.name,
        total: recipients.length,
        success: 0,
        failed: recipients.length,
        skipped: 0,
        status: 'failed',
        error: message,
      })
    }
  }

  return NextResponse.json({
    processed: results.length,
    results,
  })
}
