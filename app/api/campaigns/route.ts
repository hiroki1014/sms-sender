import { NextRequest, NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth'
import { getSupabase, fetchAll, Campaign } from '@/lib/supabase'

// キャンペーン一覧取得
export async function GET(request: NextRequest) {
  try {
    const authenticated = await isAuthenticated()
    if (!authenticated) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    const data = await fetchAll(s => {
      let q = s.from('campaigns').select('*').order('created_at', { ascending: false }).order('id', { ascending: true })
      if (status) q = q.eq('status', status)
      return q
    })

    return NextResponse.json({ campaigns: data })
  } catch (error) {
    console.error('Get campaigns error:', error)
    return NextResponse.json({ error: 'キャンペーンの取得に失敗しました' }, { status: 500 })
  }
}

// キャンペーン作成
export async function POST(request: NextRequest) {
  try {
    const authenticated = await isAuthenticated()
    if (!authenticated) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const body = await request.json()
    const { name, message_template, status, sent_at, scheduled_at, recipients_snapshot } =
      body as Partial<Campaign>

    if (!name || !message_template) {
      return NextResponse.json({ error: 'キャンペーン名とメッセージテンプレートが必要です' }, { status: 400 })
    }

    if (status === 'scheduled') {
      if (!scheduled_at) {
        return NextResponse.json({ error: '予約日時が必要です' }, { status: 400 })
      }
      if (new Date(scheduled_at).getTime() <= Date.now()) {
        return NextResponse.json({ error: '予約日時は未来の時刻を指定してください' }, { status: 400 })
      }
      if (!recipients_snapshot || !Array.isArray(recipients_snapshot) || recipients_snapshot.length === 0) {
        return NextResponse.json({ error: '予約配信には送信先が必要です' }, { status: 400 })
      }
    }

    const supabase = getSupabase()
    const insertData: Partial<Campaign> = {
      name,
      message_template,
      status: status || 'draft',
    }
    if (sent_at !== undefined) insertData.sent_at = sent_at
    if (scheduled_at !== undefined) insertData.scheduled_at = scheduled_at
    if (recipients_snapshot !== undefined) insertData.recipients_snapshot = recipients_snapshot

    const { data, error } = await supabase
      .from('campaigns')
      .insert([insertData])
      .select()
      .single()

    if (error) {
      console.error('Create campaign error:', error)
      return NextResponse.json({ error: 'キャンペーンの作成に失敗しました' }, { status: 500 })
    }

    return NextResponse.json({ campaign: data })
  } catch (error) {
    console.error('Create campaign error:', error)
    return NextResponse.json({ error: 'キャンペーンの作成に失敗しました' }, { status: 500 })
  }
}

// キャンペーン更新
export async function PATCH(request: NextRequest) {
  try {
    const authenticated = await isAuthenticated()
    if (!authenticated) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const body = await request.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json({ error: 'IDが必要です' }, { status: 400 })
    }

    const supabase = getSupabase()
    const { error } = await supabase
      .from('campaigns')
      .update(updates)
      .eq('id', id)

    if (error) {
      console.error('Update campaign error:', error)
      return NextResponse.json({ error: 'キャンペーンの更新に失敗しました' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Update campaign error:', error)
    return NextResponse.json({ error: 'キャンペーンの更新に失敗しました' }, { status: 500 })
  }
}

// キャンペーン削除
export async function DELETE(request: NextRequest) {
  try {
    const authenticated = await isAuthenticated()
    if (!authenticated) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'IDが必要です' }, { status: 400 })
    }

    const supabase = getSupabase()
    const { error } = await supabase
      .from('campaigns')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Delete campaign error:', error)
      return NextResponse.json({ error: 'キャンペーンの削除に失敗しました' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete campaign error:', error)
    return NextResponse.json({ error: 'キャンペーンの削除に失敗しました' }, { status: 500 })
  }
}
