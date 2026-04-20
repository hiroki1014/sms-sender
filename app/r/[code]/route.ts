import { NextRequest, NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { getShortUrlByCode, recordClick } from '@/lib/url-shortener'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params

    if (!code) {
      return NextResponse.json(
        { error: 'Code is required' },
        { status: 400 }
      )
    }

    // 短縮URLを検索
    const shortUrl = await getShortUrlByCode(code)

    if (!shortUrl) {
      return NextResponse.json(
        { error: 'URL not found' },
        { status: 404 }
      )
    }

    // クリック記録はレスポンス返却後にバックグラウンド実行
    // iMessage等のリンクプレビュー用クローラーのタイムアウト回避のため
    const userAgent = request.headers.get('user-agent')
    const forwardedFor = request.headers.get('x-forwarded-for')
    const ipAddress = forwardedFor?.split(',')[0]?.trim() || null

    waitUntil(
      recordClick({
        shortUrlId: shortUrl.id!,
        userAgent,
        ipAddress,
      }).catch((clickError) => {
        console.error('Failed to record click:', clickError)
      })
    )

    // 元のURLにリダイレクト（307 = Temporary Redirect）
    return NextResponse.redirect(shortUrl.original_url, { status: 307 })
  } catch (error) {
    console.error('Redirect error:', error)
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    )
  }
}
