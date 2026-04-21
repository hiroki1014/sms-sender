import { NextRequest, NextResponse } from 'next/server'
import { getSupabase, Campaign } from '@/lib/supabase'
import { sendCampaign } from '@/lib/send-campaign'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

interface CampaignResult {
  id: string
  name: string
  total: number
  success: number
  failed: number
  status: 'sent' | 'failed'
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

  const { data: due, error: fetchError } = await supabase
    .from('campaigns')
    .select('*')
    .eq('status', 'scheduled')
    .lte('scheduled_at', now)
    .order('scheduled_at', { ascending: true })

  if (fetchError) {
    console.error('Fetch scheduled campaigns error:', fetchError)
    return NextResponse.json({ error: 'キャンペーン取得に失敗しました' }, { status: 500 })
  }

  const campaigns = (due || []) as Campaign[]
  const results: CampaignResult[] = []

  for (const campaign of campaigns) {
    if (!campaign.id) continue

    const { error: lockError } = await supabase
      .from('campaigns')
      .update({ status: 'sending' })
      .eq('id', campaign.id)
      .eq('status', 'scheduled')

    if (lockError) {
      console.error(`Lock failed for campaign ${campaign.id}:`, lockError)
      continue
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
        status: 'sent',
      })
      continue
    }

    try {
      const summary = await sendCampaign({
        recipients,
        campaignId: campaign.id,
      })

      const allFailed = summary.total > 0 && summary.success === 0
      const firstError = summary.results.find((r) => !r.success)?.error

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
        status: 'sent',
      })
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
