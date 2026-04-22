import { NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth'
import { fetchAll } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const authenticated = await isAuthenticated()
    if (!authenticated) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const data = await fetchAll(s => s
      .from('contacts')
      .select('tags, list_type, call_result, prefecture')
      .order('id', { ascending: true })
    )

    const tags = new Set<string>()
    const listTypes = new Set<string>()
    const callResults = new Set<string>()
    const prefectures = new Set<string>()

    data.forEach(c => {
      ;(c.tags || []).forEach((t: string) => tags.add(t))
      if (c.list_type) listTypes.add(c.list_type)
      if (c.call_result) callResults.add(c.call_result)
      if (c.prefecture) prefectures.add(c.prefecture)
    })

    return NextResponse.json({
      tags: Array.from(tags).sort(),
      list_types: Array.from(listTypes).sort(),
      call_results: Array.from(callResults).sort(),
      prefectures: Array.from(prefectures).sort(),
    })
  } catch (error) {
    console.error('Filters error:', error)
    return NextResponse.json({ error: 'フィルター値の取得に失敗しました' }, { status: 500 })
  }
}
