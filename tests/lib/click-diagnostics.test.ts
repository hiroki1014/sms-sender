import { describe, it, expect } from 'vitest'
import { classifyClicks, ClickWithContext } from '@/lib/click-diagnostics'

const BASE_SENT_AT = '2026-04-21T15:00:00Z'

function makeClick(overrides: Partial<ClickWithContext> & { diffSeconds?: number } = {}): ClickWithContext {
  const { diffSeconds = 600, ...rest } = overrides
  return {
    id: rest.id ?? 'click-1',
    short_url_id: rest.short_url_id ?? 'su-1',
    clicked_at: rest.clicked_at ?? new Date(new Date(BASE_SENT_AT).getTime() + diffSeconds * 1000).toISOString(),
    user_agent: rest.user_agent ?? 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
    ip_address: rest.ip_address ?? '203.0.113.1',
    sec_fetch_site: rest.sec_fetch_site ?? null,
    sec_fetch_mode: rest.sec_fetch_mode ?? null,
    sec_fetch_dest: rest.sec_fetch_dest ?? null,
    sent_at: 'sent_at' in rest ? rest.sent_at! : BASE_SENT_AT,
  }
}

const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1'

describe('classifyClicks', () => {
  it('モバイルUA + ブラウザヘッダ → human_like', () => {
    const clicks = [makeClick({ user_agent: IPHONE_UA, diffSeconds: 7200, sec_fetch_mode: 'navigate' })]
    const result = classifyClicks(clicks)
    expect(result[0].classification).toBe('human_like')
    expect(result[0].reasons).toEqual(['mobile_ua', 'browser_headers'])
  })

  it('モバイルUA + 送信直後 + ブラウザヘッダ → human_like（時間不問）', () => {
    const clicks = [makeClick({ user_agent: IPHONE_UA, diffSeconds: 5, sec_fetch_mode: 'navigate' })]
    const result = classifyClicks(clicks)
    expect(result[0].classification).toBe('human_like')
  })

  it('モバイルUA + sec_fetch_dest=document → human_like', () => {
    const clicks = [makeClick({ user_agent: IPHONE_UA, diffSeconds: 120, sec_fetch_dest: 'document' })]
    const result = classifyClicks(clicks)
    expect(result[0].classification).toBe('human_like')
  })

  it('送信5秒後 + ヘッダなし → suspected_automated', () => {
    const clicks = [makeClick({ diffSeconds: 5 })]
    const result = classifyClicks(clicks)
    expect(result[0].classification).toBe('suspected_automated')
    expect(result[0].reasons).toEqual(['quick_click'])
  })

  it('送信29秒後 → suspected_automated', () => {
    const clicks = [makeClick({ diffSeconds: 29 })]
    const result = classifyClicks(clicks)
    expect(result[0].classification).toBe('suspected_automated')
  })

  it('モバイルUA + 30秒以降 → human_like', () => {
    const clicks = [makeClick({ user_agent: IPHONE_UA, diffSeconds: 30 })]
    const result = classifyClicks(clicks)
    expect(result[0].classification).toBe('human_like')
    expect(result[0].reasons).toEqual(['mobile_ua', 'delayed_click'])
  })

  it('モバイルUA + ヘッダなし（旧データ）+ 30秒以降 → human_like', () => {
    const clicks = [makeClick({ user_agent: IPHONE_UA, diffSeconds: 7200 })]
    const result = classifyClicks(clicks)
    expect(result[0].classification).toBe('human_like')
  })

  it('デスクトップUA + 30分後 → unknown', () => {
    const clicks = [makeClick({ diffSeconds: 1800 })]
    const result = classifyClicks(clicks)
    expect(result[0].classification).toBe('unknown')
  })

  it('UA不明 + 30秒以降 → unknown', () => {
    const clicks = [makeClick({ user_agent: null, diffSeconds: 600 })]
    const result = classifyClicks(clicks)
    expect(result[0].classification).toBe('unknown')
  })

  it('sent_at=null → unknown（判定不能）', () => {
    const clicks = [makeClick({ sent_at: null, diffSeconds: 5 })]
    const result = classifyClicks(clicks)
    expect(result[0].classification).toBe('unknown')
  })

  it('ip_address=null + 送信直後 → suspected_automated（IPは判定に無関係）', () => {
    const clicks = [makeClick({ ip_address: null, diffSeconds: 3 })]
    const result = classifyClicks(clicks)
    expect(result[0].classification).toBe('suspected_automated')
  })
})
