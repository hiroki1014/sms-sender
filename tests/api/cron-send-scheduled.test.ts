import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

import '../mocks/next-headers'
import { resetSupabaseMock, enqueueQueryResult } from '../mocks/supabase'

// sendCampaign モック
const mockSendCampaign = vi.fn()
vi.mock('@/lib/send-campaign', () => ({
  sendCampaign: (...args: any[]) => mockSendCampaign(...args),
}))

import { GET } from '@/app/api/cron/send-scheduled/route'

function authedRequest(token?: string): NextRequest {
  const headers: Record<string, string> = {}
  if (token !== undefined) headers['authorization'] = `Bearer ${token}`
  return new NextRequest('http://localhost/api/cron/send-scheduled', {
    method: 'GET',
    headers,
  })
}

describe('GET /api/cron/send-scheduled', () => {
  const originalSecret = process.env.CRON_SECRET

  beforeEach(() => {
    resetSupabaseMock()
    mockSendCampaign.mockReset()
    process.env.CRON_SECRET = 'test-secret'
  })

  afterEach(() => {
    process.env.CRON_SECRET = originalSecret
  })

  it('CRON_SECRET 未設定なら500', async () => {
    delete process.env.CRON_SECRET
    const res = await GET(authedRequest('anything'))
    expect(res.status).toBe(500)
  })

  it('Bearer が一致しないと401', async () => {
    const res = await GET(authedRequest('wrong'))
    expect(res.status).toBe(401)
  })

  it('Authorization ヘッダが無いと401', async () => {
    const res = await GET(authedRequest(undefined))
    expect(res.status).toBe(401)
  })

  it('due なキャンペーン0件なら空結果を返す', async () => {
    // fetchAll for campaigns returns empty
    enqueueQueryResult([])
    const res = await GET(authedRequest('test-secret'))
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.processed).toBe(0)
    expect(mockSendCampaign).not.toHaveBeenCalled()
  })

  it('due なキャンペーンは sendCampaign を呼び status=sent に更新', async () => {
    const recipients = [
      { phone: '09012345678', message: 'hello Taro' },
      { phone: '08012345678', message: 'hello Jiro' },
    ]

    // 1) fetchAll: due campaigns
    enqueueQueryResult([
      {
        id: 'c1',
        name: 'テスト予約',
        message_template: 'hello {{name}}',
        status: 'scheduled',
        scheduled_at: '2025-01-01T00:00:00Z',
        recipients_snapshot: recipients,
      },
    ])
    // 2) lock update (scheduled -> sending) - must return array with item for lockData.length check
    enqueueQueryResult([{ id: 'c1' }])
    // 3) finalize update (sending -> sent)
    enqueueQueryResult(null, null)

    mockSendCampaign.mockResolvedValue({
      total: 2,
      success: 2,
      failed: 0,
      skipped: 0,
      isPartial: false,
      results: [
        { phone: '09012345678', success: true },
        { phone: '08012345678', success: true },
      ],
    })

    const res = await GET(authedRequest('test-secret'))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.processed).toBe(1)
    expect(data.results[0]).toMatchObject({
      id: 'c1',
      total: 2,
      success: 2,
      failed: 0,
      status: 'sent',
    })
    expect(mockSendCampaign).toHaveBeenCalledWith(
      expect.objectContaining({
        recipients,
        campaignId: 'c1',
        deadlineMs: expect.any(Number),
      })
    )
  })

  it('recipients_snapshot が空なら sendCampaign を呼ばずに sent', async () => {
    // 1) fetchAll: due campaigns
    enqueueQueryResult([
      {
        id: 'c2',
        name: '空リスト',
        message_template: 'x',
        status: 'scheduled',
        scheduled_at: '2025-01-01T00:00:00Z',
        recipients_snapshot: [],
      },
    ])
    // 2) lock - must return array with item
    enqueueQueryResult([{ id: 'c2' }])
    // 3) finalize update (empty recipients -> sent)
    enqueueQueryResult(null, null)

    const res = await GET(authedRequest('test-secret'))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(mockSendCampaign).not.toHaveBeenCalled()
    expect(data.results[0].total).toBe(0)
  })

  it('isPartial=true の場合は sending のまま保持', async () => {
    const recipients = [
      { phone: '09012345678', message: 'msg1' },
      { phone: '08012345678', message: 'msg2' },
    ]

    enqueueQueryResult([
      {
        id: 'c3',
        name: '大量送信',
        message_template: 'test',
        status: 'scheduled',
        scheduled_at: '2025-01-01T00:00:00Z',
        recipients_snapshot: recipients,
      },
    ])
    enqueueQueryResult([{ id: 'c3' }])
    enqueueQueryResult(null, null)

    mockSendCampaign.mockResolvedValue({
      total: 1,
      success: 1,
      failed: 0,
      skipped: 0,
      isPartial: true,
      results: [{ phone: '09012345678', success: true }],
    })

    const res = await GET(authedRequest('test-secret'))
    const data = await res.json()

    expect(data.results[0].status).toBe('sending')
    expect(data.results[0].success).toBe(1)
  })

  it('sending キャンペーンを再開できる', async () => {
    const recipients = [
      { phone: '09012345678', message: 'msg1' },
      { phone: '08012345678', message: 'msg2' },
    ]

    // fetchAll: sending キャンペーン（停滞: 10分前のログ）
    enqueueQueryResult([
      {
        id: 'c4',
        name: '再開テスト',
        message_template: 'test',
        status: 'sending',
        scheduled_at: '2025-01-01T00:00:00Z',
        recipients_snapshot: recipients,
      },
    ])
    // 停滞チェック: 10分前のログ
    enqueueQueryResult({ sent_at: new Date(Date.now() - 10 * 60 * 1000).toISOString() })
    // finalize update
    enqueueQueryResult(null, null)

    mockSendCampaign.mockResolvedValue({
      total: 2,
      success: 1,
      failed: 0,
      skipped: 1,
      isPartial: false,
      results: [
        { phone: '09012345678', success: true, skipped: true, skipReason: '送信済み' },
        { phone: '08012345678', success: true },
      ],
    })

    const res = await GET(authedRequest('test-secret'))
    const data = await res.json()

    expect(data.processed).toBe(1)
    expect(data.results[0].status).toBe('sent')
    expect(mockSendCampaign).toHaveBeenCalled()
  })

  it('sending キャンペーンでも最新ログが5分以内ならスキップする', async () => {
    enqueueQueryResult([
      {
        id: 'c5',
        name: '処理中',
        message_template: 'test',
        status: 'sending',
        scheduled_at: '2025-01-01T00:00:00Z',
        recipients_snapshot: [{ phone: '09012345678', message: 'msg1' }],
      },
    ])
    // 停滞チェック: 1分前のログ（5分以内 → スキップ）
    enqueueQueryResult({ sent_at: new Date(Date.now() - 1 * 60 * 1000).toISOString() })

    const res = await GET(authedRequest('test-secret'))
    const data = await res.json()

    expect(data.processed).toBe(0)
    expect(mockSendCampaign).not.toHaveBeenCalled()
  })
})
