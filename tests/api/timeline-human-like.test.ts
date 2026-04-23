import { describe, it, expect, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

import '../mocks/next-headers'
import { setAuthenticated, resetAuthMock } from '../mocks/auth'
import { resetSupabaseMock, enqueueQueryResult } from '../mocks/supabase'
import { resetFixtureCounters } from '../fixtures'

import { GET } from '@/app/api/contacts/[id]/timeline/route'

const SENT_AT = '2026-04-20T10:00:00Z'

function timelineRequest(contactId: string): [NextRequest, { params: Promise<{ id: string }> }] {
  const req = new NextRequest(`http://localhost/api/contacts/${contactId}/timeline`, { method: 'GET' })
  return [req, { params: Promise.resolve({ id: contactId }) }]
}

describe('GET /api/contacts/[id]/timeline — human_likeフィルタ', () => {
  beforeEach(() => {
    resetAuthMock()
    resetSupabaseMock()
    resetFixtureCounters()
    setAuthenticated(true)
  })

  it('human_likeクリックのみタイムラインに含まれる', async () => {
    // 1) contact
    enqueueQueryResult({
      id: 'ct1', name: 'Test User', phone_number: '09011111111',
      tags: [], opted_out: false, created_at: '2026-01-01T00:00:00Z',
    })
    // 2) sms_logs
    enqueueQueryResult([
      { id: 'sms1', message: 'Hello', sent_at: SENT_AT, campaign_id: 'camp1', delivery_status: 'delivered', status: 'success' },
    ])
    // 3) incoming_messages
    enqueueQueryResult([])
    // 4) campaigns
    enqueueQueryResult([{ id: 'camp1', name: 'Campaign 1' }])
    // 5) short_urls by contact_id
    enqueueQueryResult([
      { id: 'su1', original_url: 'https://example.com', campaign_id: 'camp1', sms_log_id: 'sms1' },
    ])
    // 6) short_urls by sms_log_id
    enqueueQueryResult([
      { id: 'su1', original_url: 'https://example.com', campaign_id: 'camp1', sms_log_id: 'sms1' },
    ])
    // 7) click_logs: 1 human + 1 bot
    enqueueQueryResult([
      {
        id: 'click-h1', short_url_id: 'su1',
        clicked_at: new Date(new Date(SENT_AT).getTime() + 60_000).toISOString(),
        user_agent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
        ip_address: '203.0.113.1',
        sec_fetch_mode: 'navigate', sec_fetch_dest: 'document',
      },
      {
        id: 'click-b1', short_url_id: 'su1',
        clicked_at: new Date(new Date(SENT_AT).getTime() + 5_000).toISOString(),
        user_agent: 'Mozilla/5.0 (compatible; Googlebot)',
        ip_address: '66.249.66.1',
        sec_fetch_mode: null, sec_fetch_dest: null,
      },
    ])

    const [req, ctx] = timelineRequest('ct1')
    const res = await GET(req, ctx)
    const data = await res.json()

    const clickedEntries = data.timeline.filter((e: any) => e.type === 'clicked')
    expect(clickedEntries).toHaveLength(1)
    expect(clickedEntries[0].original_url).toBe('https://example.com')
  })

  it('全クリックがボットの場合タイムラインにクリックイベントなし', async () => {
    // 1) contact
    enqueueQueryResult({
      id: 'ct1', name: 'Test User', phone_number: '09011111111',
      tags: [], opted_out: false, created_at: '2026-01-01T00:00:00Z',
    })
    // 2) sms_logs
    enqueueQueryResult([
      { id: 'sms1', message: 'Hello', sent_at: SENT_AT, campaign_id: null, delivery_status: 'delivered', status: 'success' },
    ])
    // 3) incoming_messages
    enqueueQueryResult([])
    // 4) campaigns (empty — no campaign_id)
    // 5) short_urls by contact_id
    enqueueQueryResult([
      { id: 'su1', original_url: 'https://example.com', campaign_id: null, sms_log_id: 'sms1' },
    ])
    // 6) short_urls by sms_log_id
    enqueueQueryResult([
      { id: 'su1', original_url: 'https://example.com', campaign_id: null, sms_log_id: 'sms1' },
    ])
    // 7) click_logs: bot only
    enqueueQueryResult([
      {
        id: 'click-b1', short_url_id: 'su1',
        clicked_at: new Date(new Date(SENT_AT).getTime() + 3_000).toISOString(),
        user_agent: 'Mozilla/5.0 (compatible; Googlebot)',
        ip_address: '66.249.66.1',
        sec_fetch_mode: null, sec_fetch_dest: null,
      },
    ])

    const [req, ctx] = timelineRequest('ct1')
    const res = await GET(req, ctx)
    const data = await res.json()

    const clickedEntries = data.timeline.filter((e: any) => e.type === 'clicked')
    expect(clickedEntries).toHaveLength(0)
  })
})
