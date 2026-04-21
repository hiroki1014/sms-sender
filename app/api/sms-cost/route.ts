import { NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth'
import { getSupabase } from '@/lib/supabase'

const FALLBACK_COST_PER_SEGMENT = 13

export async function GET() {
  try {
    const authenticated = await isAuthenticated()
    if (!authenticated) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const supabase = getSupabase()
    const { data } = await supabase
      .from('sms_logs')
      .select('price, num_segments')
      .not('price', 'is', null)
      .not('num_segments', 'is', null)
      .gt('price', 0)
      .gt('num_segments', 0)
      .limit(100)
      .order('sent_at', { ascending: false })

    if (!data || data.length === 0) {
      return NextResponse.json({ perSegment: FALLBACK_COST_PER_SEGMENT, source: 'fallback' })
    }

    const totalPrice = data.reduce((sum, r) => sum + Number(r.price), 0)
    const totalSegments = data.reduce((sum, r) => sum + Number(r.num_segments), 0)
    const perSegment = Math.round(totalPrice / totalSegments * 100) / 100

    return NextResponse.json({ perSegment, source: 'actual', sampleSize: data.length })
  } catch (error) {
    console.error('SMS cost error:', error)
    return NextResponse.json({ perSegment: FALLBACK_COST_PER_SEGMENT, source: 'fallback' })
  }
}
