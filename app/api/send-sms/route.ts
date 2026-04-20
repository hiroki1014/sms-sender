import { NextRequest, NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth'
import { sendCampaign, Recipient } from '@/lib/send-campaign'

export async function POST(request: NextRequest) {
  try {
    const authenticated = await isAuthenticated()
    if (!authenticated) {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { recipients, dryRun, campaignId } = body as {
      recipients: Recipient[]
      dryRun?: boolean
      campaignId?: string
    }

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return NextResponse.json(
        { error: '送信先が指定されていません' },
        { status: 400 }
      )
    }

    const summary = await sendCampaign({ recipients, dryRun, campaignId })

    return NextResponse.json({
      total: summary.total,
      success: summary.success,
      failed: summary.failed,
      dryRun: dryRun || false,
      results: summary.results,
    })
  } catch (error) {
    console.error('Send SMS error:', error)
    return NextResponse.json(
      { error: 'SMS送信中にエラーが発生しました' },
      { status: 500 }
    )
  }
}
