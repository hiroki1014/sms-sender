import { NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth'
import { getSupabase, fetchAll, fetchAllByIn } from '@/lib/supabase'
import { toDomesticFormat } from '@/lib/twilio'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const authenticated = await isAuthenticated()
    if (!authenticated) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const supabase = getSupabase()

    const incoming = await fetchAll(s => s
      .from('incoming_messages')
      .select('from_number, body, received_at, is_read, is_opt_out, contact_id')
      .order('received_at', { ascending: false })
      .order('id', { ascending: true })
    )

    const outgoing = await fetchAll(s => s
      .from('sms_logs')
      .select('phone_number, message, sent_at')
      .order('sent_at', { ascending: false })
      .order('id', { ascending: true })
    )

    const contactIds = Array.from(
      new Set(incoming.map(m => m.contact_id).filter(Boolean))
    )
    let contactMap: Record<string, { name: string; opted_out: boolean }> = {}
    if (contactIds.length > 0) {
      const contacts = await fetchAllByIn(
        (s, batch) => s.from('contacts').select('id, name, phone_number, opted_out').in('id', batch).order('id', { ascending: true }),
        contactIds
      )
      contacts.forEach(c => {
        contactMap[c.id] = { name: c.name || c.phone_number, opted_out: c.opted_out || false }
      })
    }

    const groups: Record<string, {
      phone: string
      display_name: string
      latest_message: string
      latest_at: string
      unread_count: number
      is_opted_out: boolean
    }> = {}

    for (const msg of incoming) {
      const phone = toDomesticFormat(msg.from_number)
      if (!groups[phone]) {
        const contact = msg.contact_id ? contactMap[msg.contact_id] : null
        groups[phone] = {
          phone,
          display_name: contact?.name || phone,
          latest_message: msg.body,
          latest_at: msg.received_at,
          unread_count: 0,
          is_opted_out: contact?.opted_out || false,
        }
      }
      if (!msg.is_read) {
        groups[phone].unread_count++
      }
    }

    for (const msg of outgoing) {
      const phone = toDomesticFormat(msg.phone_number)
      if (!groups[phone]) {
        groups[phone] = {
          phone,
          display_name: phone,
          latest_message: msg.message,
          latest_at: msg.sent_at,
          unread_count: 0,
          is_opted_out: false,
        }
      } else if (msg.sent_at > groups[phone].latest_at) {
        groups[phone].latest_message = msg.message
        groups[phone].latest_at = msg.sent_at
      }
    }

    const conversations = Object.values(groups).sort(
      (a, b) => new Date(b.latest_at).getTime() - new Date(a.latest_at).getTime()
    )

    return NextResponse.json({ conversations })
  } catch (error) {
    console.error('Conversations error:', error)
    return NextResponse.json({ error: '会話の取得に失敗しました' }, { status: 500 })
  }
}
