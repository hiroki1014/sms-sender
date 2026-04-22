import { NextRequest, NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth'
import { getSupabase } from '@/lib/supabase'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authenticated = await isAuthenticated()
    if (!authenticated) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const { id } = await params
    const supabase = getSupabase()

    const { data: campaign } = await supabase
      .from('campaigns')
      .select('id, status, scheduled_at')
      .eq('id', id)
      .eq('status', 'sending')
      .single()

    if (!campaign) {
      return NextResponse.json({ error: '送信中のキャンペーンが見つかりません' }, { status: 404 })
    }

    const STALE_MS = 6 * 60 * 1000

    const { data: latestLog, error: logQueryError } = await supabase
      .from('sms_logs')
      .select('sent_at')
      .eq('campaign_id', id)
      .order('sent_at', { ascending: false })
      .limit(1)
      .single()

    if (logQueryError && logQueryError.code !== 'PGRST116') {
      return NextResponse.json({ error: 'ログ確認に失敗しました' }, { status: 500 })
    }

    if (!latestLog) {
      const scheduledAt = new Date(campaign.scheduled_at || 0).getTime()
      if (Date.now() - scheduledAt < STALE_MS) {
        return NextResponse.json({
          error: '送信処理が開始直後の可能性があります。しばらく待ってから再試行してください',
        }, { status: 409 })
      }
    } else {
      const lastActivity = new Date(latestLog.sent_at).getTime()
      const elapsed = Date.now() - lastActivity
      if (elapsed < STALE_MS) {
      const remaining = Math.ceil((6 * 60 * 1000 - elapsed) / 60000)
      return NextResponse.json({
        error: `送信処理が実行中の可能性があります。${remaining}分後に再試行してください`,
      }, { status: 409 })
      }
    }

    const { data, error } = await supabase
      .from('campaigns')
      .update({ status: 'scheduled' })
      .eq('id', id)
      .eq('status', 'sending')
      .select('id')

    if (error || !data || data.length === 0) {
      return NextResponse.json({ error: 'リセットに失敗しました' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Reset campaign error:', error)
    return NextResponse.json({ error: 'リセットに失敗しました' }, { status: 500 })
  }
}
