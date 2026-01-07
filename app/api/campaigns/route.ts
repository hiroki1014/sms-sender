import { NextRequest, NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth'
import { getSupabase, Campaign } from '@/lib/supabase'

// キャンペーン一覧取得
export async function GET(request: NextRequest) {
  try {
    const authenticated = await isAuthenticated()
    if (!authenticated) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    const supabase = getSupabase()
    let query = supabase
      .from('campaigns')
      .select('*')
      .order('created_at', { ascending: false })

    if (status) {
      query = query.eq('status', status)
    }

    const { data, error } = await query

    if (error) {
      console.error('Get campaigns error:', error)
      return NextResponse.json({ error: 'キャンペーンの取得に失敗しました' }, { status: 500 })
    }

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
    const { name, message_template, status } = body as Partial<Campaign>

    if (!name || !message_template) {
      return NextResponse.json({ error: 'キャンペーン名とメッセージテンプレートが必要です' }, { status: 400 })
    }

    const supabase = getSupabase()
    const { data, error } = await supabase
      .from('campaigns')
      .insert([{
        name,
        message_template,
        status: status || 'draft',
      }])
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
