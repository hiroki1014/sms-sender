import { NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth'
import { getSupabase } from '@/lib/supabase'

export async function GET() {
  try {
    const authenticated = await isAuthenticated()
    if (!authenticated) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const supabase = getSupabase()
    const { data, error } = await supabase
      .from('incoming_messages')
      .select('*')
      .order('received_at', { ascending: false })
      .limit(200)

    if (error) {
      console.error('Fetch inbox error:', error)
      return NextResponse.json({ error: '受信メッセージの取得に失敗しました' }, { status: 500 })
    }

    // contact_id で contacts の名前を引く
    const contactIds = Array.from(new Set((data || []).map((m: any) => m.contact_id).filter(Boolean)))
    let contactMap: Record<string, string> = {}
    if (contactIds.length > 0) {
      const { data: contacts } = await supabase
        .from('contacts')
        .select('id, name, phone_number')
        .in('id', contactIds)
      contacts?.forEach(c => {
        contactMap[c.id] = c.name || c.phone_number
      })
    }

    const messages = (data || []).map(m => ({
      ...m,
      contact_name: m.contact_id ? contactMap[m.contact_id] || null : null,
    }))

    return NextResponse.json({ messages })
  } catch (error) {
    console.error('Inbox error:', error)
    return NextResponse.json({ error: '受信メッセージの取得に失敗し���した' }, { status: 500 })
  }
}
