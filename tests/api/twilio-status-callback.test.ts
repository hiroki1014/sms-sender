import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

import { resetSupabaseMock, setQueryResult } from '../mocks/supabase'

// Twilio の validateRequest をモック
const mockValidateRequest = vi.fn()
vi.mock('twilio', () => ({
  default: {
    validateRequest: (...args: any[]) => mockValidateRequest(...args),
  },
  validateRequest: (...args: any[]) => mockValidateRequest(...args),
}))

import { POST } from '@/app/api/twilio/status-callback/route'

function makeFormRequest(params: Record<string, string>, signature?: string): NextRequest {
  const body = new URLSearchParams(params).toString()
  const headers: Record<string, string> = {
    'content-type': 'application/x-www-form-urlencoded',
  }
  if (signature !== undefined) headers['x-twilio-signature'] = signature

  return new NextRequest('http://localhost/api/twilio/status-callback', {
    method: 'POST',
    body,
    headers,
  })
}

describe('POST /api/twilio/status-callback', () => {
  const originalSkip = process.env.TWILIO_SKIP_SIGNATURE_VERIFY
  const originalToken = process.env.TWILIO_AUTH_TOKEN

  beforeEach(() => {
    resetSupabaseMock()
    mockValidateRequest.mockReset()
    process.env.TWILIO_AUTH_TOKEN = 'test-token'
  })

  afterEach(() => {
    process.env.TWILIO_SKIP_SIGNATURE_VERIFY = originalSkip
    process.env.TWILIO_AUTH_TOKEN = originalToken
  })

  it('署名なし & スキップ無効なら403', async () => {
    process.env.TWILIO_SKIP_SIGNATURE_VERIFY = 'false'
    const req = makeFormRequest({ MessageSid: 'SM1', MessageStatus: 'delivered' })
    const res = await POST(req)
    expect(res.status).toBe(403)
  })

  it('署名が不正なら403', async () => {
    process.env.TWILIO_SKIP_SIGNATURE_VERIFY = 'false'
    mockValidateRequest.mockReturnValue(false)
    const req = makeFormRequest(
      { MessageSid: 'SM1', MessageStatus: 'delivered' },
      'bad-sig'
    )
    const res = await POST(req)
    expect(res.status).toBe(403)
  })

  it('TWILIO_SKIP_SIGNATURE_VERIFY=true なら署名チェックを飛ばす', async () => {
    process.env.TWILIO_SKIP_SIGNATURE_VERIFY = 'true'
    setQueryResult(null, null)

    const req = makeFormRequest({
      MessageSid: 'SMabc',
      MessageStatus: 'delivered',
    })
    const res = await POST(req)
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.success).toBe(true)
    expect(mockValidateRequest).not.toHaveBeenCalled()
  })

  it('MessageSid がなければ400', async () => {
    process.env.TWILIO_SKIP_SIGNATURE_VERIFY = 'true'
    const req = makeFormRequest({ MessageStatus: 'delivered' })
    const res = await POST(req)
    const data = await res.json()
    expect(res.status).toBe(400)
    expect(data.error).toMatch(/MessageSid/)
  })

  it('正常系: delivery_status を更新', async () => {
    process.env.TWILIO_SKIP_SIGNATURE_VERIFY = 'true'
    setQueryResult(null, null)

    const req = makeFormRequest({
      MessageSid: 'SMabc',
      MessageStatus: 'delivered',
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
  })

  it('undelivered + ErrorCode は error_message も保存', async () => {
    process.env.TWILIO_SKIP_SIGNATURE_VERIFY = 'true'
    setQueryResult(null, null)

    const req = makeFormRequest({
      MessageSid: 'SMxyz',
      MessageStatus: 'undelivered',
      ErrorCode: '30003',
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
  })
})
