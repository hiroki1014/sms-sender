import { NextRequest, NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth'
import { getSupabase, Campaign } from '@/lib/supabase'
import { sendCampaign } from '@/lib/send-campaign'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST(request: NextRequest) {
  try {
    const authenticated = await isAuthenticated()
    if (!authenticated) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const body = await request.json()
    const { id } = body as { id?: string }

    if (!id) {
      return NextResponse.json({ error: 'キャンペーンIDが必要です' }, { status: 400 })
    }

    const supabase = getSupabase()

    const { data: campaign, error: fetchError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', id)
      .eq('status', 'scheduled')
      .single()

    if (fetchError || !campaign) {
      return NextResponse.json({ error: '予約中のキャンペーンが見つかりません' }, { status: 404 })
    }

    const { error: lockError } = await supabase
      .from('campaigns')
      .update({ status: 'sending' })
      .eq('id', id)
      .eq('status', 'scheduled')

    if (lockError) {
      return NextResponse.json({ error: 'ステータス更新に失敗しました' }, { status: 500 })
    }

    const recipients = (campaign as Campaign).recipients_snapshot || []

    if (recipients.length === 0) {
      await supabase
        .from('campaigns')
        .update({ status: 'sent', sent_at: new Date().toISOString(), last_error: '送信先が空のため送信しませんでした' })
        .eq('id', id)
      return NextResponse.json({ total: 0, success: 0, failed: 0, status: 'sent' })
    }

    const summary = await sendCampaign({ recipients, campaignId: id })

    const allFailed = summary.total > 0 && summary.success === 0
    const firstError = summary.results.find((r) => !r.success)?.error

    await supabase
      .from('campaigns')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        last_error: allFailed ? firstError || '全件送信失敗' : null,
      })
      .eq('id', id)

    return NextResponse.json({
      total: summary.total,
      success: summary.success,
      failed: summary.failed,
      status: 'sent',
    })
  } catch (error) {
    console.error('Run scheduled error:', error)
    return NextResponse.json({ error: '実行に失敗しました' }, { status: 500 })
  }
}
