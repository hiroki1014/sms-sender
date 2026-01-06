import { NextRequest, NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth'
import { getSupabase } from '@/lib/supabase'

export interface Contact {
  id: string
  phone_number: string
  name: string | null
  tags: string[]
  opted_out: boolean
  opted_out_at: string | null
  created_at: string
  updated_at: string
}

// 顧客一覧取得
export async function GET(request: NextRequest) {
  try {
    const authenticated = await isAuthenticated()
    if (!authenticated) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const tag = searchParams.get('tag')
    const includeOptedOut = searchParams.get('includeOptedOut') === 'true'

    const supabase = getSupabase()
    let query = supabase
      .from('contacts')
      .select('*')
      .order('created_at', { ascending: false })

    if (tag) {
      query = query.contains('tags', [tag])
    }

    if (!includeOptedOut) {
      query = query.eq('opted_out', false)
    }

    const { data, error } = await query

    if (error) {
      console.error('Get contacts error:', error)
      return NextResponse.json({ error: '顧客の取得に失敗しました' }, { status: 500 })
    }

    return NextResponse.json({ contacts: data })
  } catch (error) {
    console.error('Get contacts error:', error)
    return NextResponse.json({ error: '顧客の取得に失敗しました' }, { status: 500 })
  }
}

// 顧客追加（単体または一括）
export async function POST(request: NextRequest) {
  try {
    const authenticated = await isAuthenticated()
    if (!authenticated) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const body = await request.json()
    const { contacts } = body as { contacts: Partial<Contact>[] }

    if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
      return NextResponse.json({ error: '顧客データが必要です' }, { status: 400 })
    }

    const supabase = getSupabase()

    // 重複チェックのため既存の電話番号を取得
    const phoneNumbers = contacts.map(c => c.phone_number).filter(Boolean)
    const { data: existing } = await supabase
      .from('contacts')
      .select('phone_number')
      .in('phone_number', phoneNumbers)

    const existingPhones = new Set(existing?.map(e => e.phone_number) || [])

    // 新規のみ追加
    const newContacts = contacts
      .filter(c => c.phone_number && !existingPhones.has(c.phone_number))
      .map(c => ({
        phone_number: c.phone_number,
        name: c.name || null,
        tags: c.tags || [],
      }))

    const duplicateCount = contacts.length - newContacts.length

    if (newContacts.length > 0) {
      const { error } = await supabase.from('contacts').insert(newContacts)

      if (error) {
        console.error('Insert contacts error:', error)
        return NextResponse.json({ error: '顧客の追加に失敗しました' }, { status: 500 })
      }
    }

    return NextResponse.json({
      added: newContacts.length,
      duplicates: duplicateCount,
      total: contacts.length,
    })
  } catch (error) {
    console.error('Add contacts error:', error)
    return NextResponse.json({ error: '顧客の追加に失敗しました' }, { status: 500 })
  }
}

// 顧客更新
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
      .from('contacts')
      .update(updates)
      .eq('id', id)

    if (error) {
      console.error('Update contact error:', error)
      return NextResponse.json({ error: '顧客の更新に失敗しました' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Update contact error:', error)
    return NextResponse.json({ error: '顧客の更新に失敗しました' }, { status: 500 })
  }
}

// 顧客削除
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
      .from('contacts')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Delete contact error:', error)
      return NextResponse.json({ error: '顧客の削除に失敗しました' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete contact error:', error)
    return NextResponse.json({ error: '顧客の削除に失敗しました' }, { status: 500 })
  }
}
