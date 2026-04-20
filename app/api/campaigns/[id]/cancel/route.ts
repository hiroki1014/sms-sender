import { NextRequest, NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth'
import { getSupabase } from '@/lib/supabase'

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authenticated = await isAuthenticated()
    if (!authenticated) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const { id } = params
    if (!id) {
      return NextResponse.json({ error: 'IDが必要です' }, { status: 400 })
    }

    const supabase = getSupabase()

    const { data: campaign, error: fetchError } = await supabase
      .from('campaigns')
      .select('id, status')
      .eq('id', id)
      .single()

    if (fetchError || !campaign) {
      return NextResponse.json({ error: 'キャンペーンが見つかりません' }, { status: 404 })
    }

    if (campaign.status !== 'scheduled') {
      return NextResponse.json(
        { error: '予約中のキャンペーンのみキャンセルできます' },
        { status: 400 }
      )
    }

    const { error: updateError } = await supabase
      .from('campaigns')
      .update({
        status: 'draft',
        scheduled_at: null,
        recipients_snapshot: null,
      })
      .eq('id', id)

    if (updateError) {
      console.error('Cancel campaign error:', updateError)
      return NextResponse.json({ error: 'キャンセルに失敗しました' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Cancel campaign error:', error)
    return NextResponse.json({ error: 'キャンセルに失敗しました' }, { status: 500 })
  }
}
