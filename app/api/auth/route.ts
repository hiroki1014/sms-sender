import { NextRequest, NextResponse } from 'next/server'
import { verifyPassword, setAuthCookie, clearAuthCookie } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { password } = body

    if (!password) {
      return NextResponse.json(
        { error: 'パスワードを入力してください' },
        { status: 400 }
      )
    }

    if (!verifyPassword(password)) {
      return NextResponse.json(
        { error: 'パスワードが正しくありません' },
        { status: 401 }
      )
    }

    await setAuthCookie()

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Auth error:', error)
    return NextResponse.json(
      { error: '認証エラーが発生しました' },
      { status: 500 }
    )
  }
}

export async function DELETE() {
  try {
    await clearAuthCookie()
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Logout error:', error)
    return NextResponse.json(
      { error: 'ログアウトエラーが発生しました' },
      { status: 500 }
    )
  }
}
