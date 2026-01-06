import { NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth'
import { getSmsLogs } from '@/lib/supabase'

export async function GET() {
  try {
    // 認証チェック
    const authenticated = await isAuthenticated()
    if (!authenticated) {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      )
    }

    const logs = await getSmsLogs(100)

    return NextResponse.json({ logs })
  } catch (error) {
    console.error('Get logs error:', error)
    return NextResponse.json(
      { error: 'ログの取得に失敗しました' },
      { status: 500 }
    )
  }
}
