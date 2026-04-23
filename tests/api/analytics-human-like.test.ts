import { describe, it, expect, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

import '../mocks/next-headers'
import { setAuthenticated, resetAuthMock } from '../mocks/auth'
import { resetSupabaseMock, enqueueQueryResult } from '../mocks/supabase'
import { resetFixtureCounters } from '../fixtures'

import { GET } from '@/app/api/analytics/route'

const SENT_AT = '2026-04-20T10:00:00Z'

function makeClickLog(id: string, shortUrlId: string, overrides?: Record<string, any>) {
  return {
    id,
    short_url_id: shortUrlId,
    clicked_at: new Date(new Date(SENT_AT).getTime() + 60_000).toISOString(),
    user_agent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
    ip_address: '203.0.113.1',
    sec_fetch_mode: 'navigate',
    sec_fetch_dest: 'document',
    sec_fetch_site: null,
    ...overrides,
  }
}

function makeBotClick(id: string, shortUrlId: string, sentAt: string = SENT_AT) {
  return makeClickLog(id, shortUrlId, {
    clicked_at: new Date(new Date(sentAt).getTime() + 5_000).toISOString(),
    user_agent: 'Mozilla/5.0 (compatible; Googlebot)',
    sec_fetch_mode: null,
    sec_fetch_dest: null,
  })
}

function request(campaignId?: string): NextRequest {
  const url = campaignId
    ? `http://localhost/api/analytics?campaignId=${campaignId}`
    : 'http://localhost/api/analytics'
  return new NextRequest(url, { method: 'GET' })
}

describe('GET /api/analytics — human_likeフィルタ', () => {
  beforeEach(() => {
    resetAuthMock()
    resetSupabaseMock()
    resetFixtureCounters()
    setAuthenticated(true)
  })

  describe('全体統計 (getOverallStats)', () => {
    function enqueueOverallData() {
      // 1) campaigns
      enqueueQueryResult([
        { id: 'camp1', name: 'Campaign 1', sent_at: SENT_AT, status: 'sent' },
      ])
      // 2) sms_logs
      enqueueQueryResult([
        { id: 'sms1', campaign_id: 'camp1', status: 'success', delivery_status: 'delivered', price: 5.0, sent_at: SENT_AT },
        { id: 'sms2', campaign_id: 'camp1', status: 'success', delivery_status: 'delivered', price: 5.0, sent_at: SENT_AT },
      ])
      // 3) short_urls
      enqueueQueryResult([
        { id: 'su1', campaign_id: 'camp1', contact_id: 'ct1', sms_log_id: 'sms1' },
        { id: 'su2', campaign_id: 'camp1', contact_id: 'ct2', sms_log_id: 'sms2' },
      ])
      // 4) click_logs: 1 human + 1 bot
      enqueueQueryResult([
        makeClickLog('click-h1', 'su1'),
        makeBotClick('click-b1', 'su2'),
      ])
      // 5) contacts count
      enqueueQueryResult({ count: 10 })
    }

    it('total_clicks / total_clicks_unique はhuman_likeのみ', async () => {
      enqueueOverallData()
      const res = await GET(request())
      const data = await res.json()

      expect(data.overall.total_clicks).toBe(1)
      expect(data.overall.total_clicks_unique).toBe(1)
    })

    it('ヒートマップにはhuman_likeクリックのみ含まれる', async () => {
      enqueueOverallData()
      const res = await GET(request())
      const data = await res.json()

      const totalHeatmapClicks = data.charts.clickHeatmap.reduce(
        (sum: number, h: any) => sum + h.count, 0
      )
      expect(totalHeatmapClicks).toBe(1)
    })

    it('CPCはhuman_likeユニーク数ベースで計算される', async () => {
      enqueueOverallData()
      const res = await GET(request())
      const data = await res.json()

      expect(data.charts.cpc.total_clicks).toBe(1)
      expect(data.charts.cpc.cpc).toBe(10)
    })

    it('リピーターはhuman_likeクリックのみでカウントされる', async () => {
      // 2 campaigns, ct1 has human click in both, ct2 has only bot clicks
      // 1) campaigns
      enqueueQueryResult([
        { id: 'camp1', name: 'Campaign 1', sent_at: SENT_AT, status: 'sent' },
        { id: 'camp2', name: 'Campaign 2', sent_at: '2026-04-21T10:00:00Z', status: 'sent' },
      ])
      // 2) sms_logs
      enqueueQueryResult([
        { id: 'sms1', campaign_id: 'camp1', status: 'success', delivery_status: 'delivered', price: 5.0, sent_at: SENT_AT },
        { id: 'sms2', campaign_id: 'camp2', status: 'success', delivery_status: 'delivered', price: 5.0, sent_at: '2026-04-21T10:00:00Z' },
        { id: 'sms3', campaign_id: 'camp1', status: 'success', delivery_status: 'delivered', price: 5.0, sent_at: SENT_AT },
      ])
      // 3) short_urls
      enqueueQueryResult([
        { id: 'su1', campaign_id: 'camp1', contact_id: 'ct1', sms_log_id: 'sms1' },
        { id: 'su2', campaign_id: 'camp2', contact_id: 'ct1', sms_log_id: 'sms2' },
        { id: 'su3', campaign_id: 'camp1', contact_id: 'ct2', sms_log_id: 'sms3' },
      ])
      // 4) click_logs: ct1 has human clicks in both campaigns, ct2 has only bot click
      enqueueQueryResult([
        makeClickLog('click-h1', 'su1'),
        makeClickLog('click-h2', 'su2', {
          clicked_at: new Date(new Date('2026-04-21T10:00:00Z').getTime() + 60_000).toISOString(),
        }),
        makeBotClick('click-b1', 'su3'),
      ])
      // 5) contacts count
      enqueueQueryResult({ count: 5 })

      const res = await GET(request())
      const data = await res.json()

      // ct1 has human clicks in 2 campaigns → repeater, ct2 has only bot → not counted
      expect(data.charts.repeaters.multi_click_contacts).toBe(1)
    })

    it('click_rateはhuman_likeユニーク / success_count', async () => {
      enqueueOverallData()
      const res = await GET(request())
      const data = await res.json()

      expect(data.overall.overall_click_rate).toBe(50)
    })
  })

  describe('キャンペーン詳細 (getCampaignDetailStats)', () => {
    function enqueueDetailData() {
      // 1) campaign single
      enqueueQueryResult({ id: 'camp1', name: 'Campaign 1', sent_at: SENT_AT })
      // 2) sms_logs
      enqueueQueryResult([
        { id: 'sms1', campaign_id: 'camp1', status: 'success', contact_id: 'ct1', phone_number: '09011111111', delivery_status: 'delivered', sent_at: SENT_AT, error_message: null },
        { id: 'sms2', campaign_id: 'camp1', status: 'success', contact_id: 'ct2', phone_number: '09022222222', delivery_status: 'delivered', sent_at: SENT_AT, error_message: null },
      ])
      // 3) short_urls
      enqueueQueryResult([
        { id: 'su1', campaign_id: 'camp1', contact_id: 'ct1', sms_log_id: 'sms1' },
        { id: 'su2', campaign_id: 'camp1', contact_id: 'ct2', sms_log_id: 'sms2' },
      ])
      // 4) click_logs: 2 human on su1, 1 bot on su2
      enqueueQueryResult([
        makeClickLog('click-h1', 'su1'),
        makeClickLog('click-h2', 'su1', {
          clicked_at: new Date(new Date(SENT_AT).getTime() + 120_000).toISOString(),
        }),
        makeBotClick('click-b1', 'su2'),
      ])
      // 5) contacts by id
      enqueueQueryResult([
        { id: 'ct1', name: 'User 1', phone_number: '09011111111', tags: ['tag-a'] },
        { id: 'ct2', name: 'User 2', phone_number: '09022222222', tags: ['tag-a'] },
      ])
    }

    it('受信者別click_countはhuman_likeのみ', async () => {
      enqueueDetailData()
      const res = await GET(request('camp1'))
      const data = await res.json()

      const r1 = data.recipients.find((r: any) => r.phone_number === '09011111111')
      const r2 = data.recipients.find((r: any) => r.phone_number === '09022222222')
      expect(r1.click_count).toBe(2)
      expect(r2.click_count).toBe(0)
    })

    it('campaign.click_countはhuman_likeのみ', async () => {
      enqueueDetailData()
      const res = await GET(request('camp1'))
      const data = await res.json()

      expect(data.campaign.click_count).toBe(2)
      expect(data.campaign.unique_click_count).toBe(1)
    })

    it('timeToClickにはhuman_likeクリックのみ含まれる', async () => {
      enqueueDetailData()
      const res = await GET(request('camp1'))
      const data = await res.json()

      const totalTimeToClick = data.charts.timeToClick.reduce(
        (sum: number, b: any) => sum + b.count, 0
      )
      expect(totalTimeToClick).toBe(2)
    })

    it('tagBreakdownはhuman_likeクリックのみでクリック率を計算する', async () => {
      enqueueDetailData()
      const res = await GET(request('camp1'))
      const data = await res.json()

      const tagA = data.charts.tagBreakdown.find((t: any) => t.tag === 'tag-a')
      expect(tagA.sent).toBe(2)
      expect(tagA.clicked).toBe(1)
      expect(tagA.rate).toBe(50)
    })

    it('click_diagnosticsは全クリック（ボット含む）の内訳を返す', async () => {
      enqueueDetailData()
      const res = await GET(request('camp1'))
      const data = await res.json()

      expect(data.click_diagnostics.total).toBe(3)
      expect(data.click_diagnostics.human_like).toBe(2)
      expect(data.click_diagnostics.suspected_automated).toBe(1)
    })
  })
})
