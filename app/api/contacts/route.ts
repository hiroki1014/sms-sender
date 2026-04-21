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
  url: string | null
  gender: string | null
  list_type: string | null
  status: string | null
  prefecture: string | null
  notes: string | null
  send_count?: number
  last_sent_at?: string | null
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

    // 配信統計を取得
    const contactIds = data?.map(c => c.id) || []
    let sendStats: Record<string, { count: number; lastSentAt: string | null }> = {}

    if (contactIds.length > 0) {
      const { data: logsData } = await supabase
        .from('sms_logs')
        .select('contact_id, sent_at')
        .in('contact_id', contactIds)
        .order('sent_at', { ascending: false })

      if (logsData) {
        logsData.forEach(log => {
          if (log.contact_id) {
            if (!sendStats[log.contact_id]) {
              sendStats[log.contact_id] = { count: 0, lastSentAt: log.sent_at }
            }
            sendStats[log.contact_id].count++
          }
        })
      }
    }

    // 顧客データに配信統計をマージ
    const contactsWithStats = data?.map(contact => ({
      ...contact,
      send_count: sendStats[contact.id]?.count || 0,
      last_sent_at: sendStats[contact.id]?.lastSentAt || null,
    })) || []

    return NextResponse.json({ contacts: contactsWithStats })
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
    const { contacts, dry_run } = body as { contacts: Partial<Contact>[]; dry_run?: boolean }

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

    const newContacts = contacts
      .filter(c => c.phone_number && !existingPhones.has(c.phone_number))
      .map(c => ({
        phone_number: c.phone_number,
        name: c.name || null,
        tags: c.tags || [],
        url: c.url || null,
        gender: c.gender || null,
        list_type: c.list_type || null,
        status: c.status || null,
        prefecture: c.prefecture || null,
        notes: c.notes || null,
      }))

    const updateContacts = contacts.filter(c => c.phone_number && existingPhones.has(c.phone_number))

    const fields = ['name', 'tags', 'url', 'gender', 'list_type', 'status', 'prefecture', 'notes'] as const
    const updateOps = updateContacts.map(c => {
      const updates: Record<string, unknown> = {}
      for (const f of fields) {
        const val = c[f]
        if (val !== undefined && val !== null && val !== '') {
          updates[f] = val
        }
      }
      return { phone_number: c.phone_number, updates }
    }).filter(op => Object.keys(op.updates).length > 0)

    if (dry_run) {
      return NextResponse.json({
        dry_run: true,
        added: newContacts.length,
        updated: updateOps.length,
        duplicates: updateContacts.length - updateOps.length,
        total: contacts.length,
      })
    }

    if (newContacts.length > 0) {
      const { error } = await supabase.from('contacts').insert(newContacts)
      if (error) {
        console.error('Insert contacts error:', error)
        return NextResponse.json({ error: '顧客の追加に失敗しました' }, { status: 500 })
      }
    }

    const BATCH_SIZE = 20
    for (let i = 0; i < updateOps.length; i += BATCH_SIZE) {
      const batch = updateOps.slice(i, i + BATCH_SIZE)
      await Promise.all(
        batch.map(op => supabase.from('contacts').update(op.updates).eq('phone_number', op.phone_number))
      )
    }

    return NextResponse.json({
      added: newContacts.length,
      updated: updateOps.length,
      duplicates: updateContacts.length - updateOps.length,
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
