import { describe, it, expect, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

import '../mocks/next-headers'
import { setAuthenticated, resetAuthMock } from '../mocks/auth'
import {
  setQueryResult,
  enqueueQueryResult,
  resetSupabaseMock,
} from '../mocks/supabase'
import { createCampaign, resetFixtureCounters } from '../fixtures'

import { POST as CreateCampaign } from '@/app/api/campaigns/route'
import { POST as CancelCampaign } from '@/app/api/campaigns/[id]/cancel/route'

function postJson(url: string, body: any): NextRequest {
  return new NextRequest(url, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('POST /api/campaigns (scheduled)', () => {
  beforeEach(() => {
    resetAuthMock()
    resetSupabaseMock()
    resetFixtureCounters()
    setAuthenticated(true)
  })

  it('status=scheduled で scheduled_at がないと400', async () => {
    const req = postJson('http://localhost/api/campaigns', {
      name: '予約テスト',
      message_template: 'hi',
      status: 'scheduled',
      recipients_snapshot: [{ phone: '09012345678', message: 'hi' }],
    })
    const res = await CreateCampaign(req)
    const data = await res.json()
    expect(res.status).toBe(400)
    expect(data.error).toBe('予約日時が必要です')
  })

  it('scheduled_at が過去なら400', async () => {
    const req = postJson('http://localhost/api/campaigns', {
      name: '予約テスト',
      message_template: 'hi',
      status: 'scheduled',
      scheduled_at: new Date(Date.now() - 60_000).toISOString(),
      recipients_snapshot: [{ phone: '09012345678', message: 'hi' }],
    })
    const res = await CreateCampaign(req)
    const data = await res.json()
    expect(res.status).toBe(400)
    expect(data.error).toBe('予約日時は未来の時刻を指定してください')
  })

  it('recipients_snapshot が空なら400', async () => {
    const req = postJson('http://localhost/api/campaigns', {
      name: '予約テスト',
      message_template: 'hi',
      status: 'scheduled',
      scheduled_at: new Date(Date.now() + 3_600_000).toISOString(),
      recipients_snapshot: [],
    })
    const res = await CreateCampaign(req)
    const data = await res.json()
    expect(res.status).toBe(400)
    expect(data.error).toBe('予約配信には送信先が必要です')
  })

  it('有効な予約内容なら200で作成', async () => {
    const mockCampaign = createCampaign({
      name: '予約テスト',
      status: 'scheduled',
      scheduled_at: new Date(Date.now() + 3_600_000).toISOString(),
      recipients_snapshot: [{ phone: '09012345678', message: 'hi' }],
    })
    setQueryResult(mockCampaign)

    const req = postJson('http://localhost/api/campaigns', {
      name: '予約テスト',
      message_template: 'hi',
      status: 'scheduled',
      scheduled_at: mockCampaign.scheduled_at,
      recipients_snapshot: mockCampaign.recipients_snapshot,
    })
    const res = await CreateCampaign(req)
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.campaign.status).toBe('scheduled')
  })
})

describe('POST /api/campaigns/[id]/cancel', () => {
  beforeEach(() => {
    resetAuthMock()
    resetSupabaseMock()
    resetFixtureCounters()
  })

  it('未認証は401', async () => {
    setAuthenticated(false)
    const req = new NextRequest('http://localhost/api/campaigns/abc/cancel', { method: 'POST' })
    const res = await CancelCampaign(req, { params: { id: 'abc' } })
    expect(res.status).toBe(401)
  })

  it('存在しないキャンペーンは404', async () => {
    setAuthenticated(true)
    setQueryResult(null, { message: 'not found' })
    const req = new NextRequest('http://localhost/api/campaigns/abc/cancel', { method: 'POST' })
    const res = await CancelCampaign(req, { params: { id: 'abc' } })
    expect(res.status).toBe(404)
  })

  it('scheduled 以外は400', async () => {
    setAuthenticated(true)
    setQueryResult({ id: 'abc', status: 'sent' })
    const req = new NextRequest('http://localhost/api/campaigns/abc/cancel', { method: 'POST' })
    const res = await CancelCampaign(req, { params: { id: 'abc' } })
    const data = await res.json()
    expect(res.status).toBe(400)
    expect(data.error).toBe('予約中のキャンペーンのみキャンセルできます')
  })

  it('scheduled なキャンペーンは draft に戻せる', async () => {
    setAuthenticated(true)
    // 1st query: fetch campaign
    enqueueQueryResult({ id: 'abc', status: 'scheduled' })
    // 2nd query: update
    enqueueQueryResult(null, null)

    const req = new NextRequest('http://localhost/api/campaigns/abc/cancel', { method: 'POST' })
    const res = await CancelCampaign(req, { params: { id: 'abc' } })
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.success).toBe(true)
  })
})
