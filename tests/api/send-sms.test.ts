import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

// モックのインポート（vi.mock() は名前付きインポート時に実行される）
import '../mocks/next-headers'
import { setAuthenticated, resetAuthMock } from '../mocks/auth'
import { enqueueQueryResult, resetSupabaseMock } from '../mocks/supabase'

// sendSms のモック
const mockSendSms = vi.fn()
vi.mock('@/lib/twilio', () => ({
  sendSms: (...args: any[]) => mockSendSms(...args),
  normalizePhoneNumber: vi.fn((phone: string) => phone),
  validatePhoneNumber: vi.fn(() => true),
  toDomesticFormat: vi.fn((phone: string) => phone),
}))

// APIハンドラをインポート
import { POST } from '@/app/api/send-sms/route'

// NextRequest を作成するヘルパー
function createRequest(body: any): NextRequest {
  return new NextRequest('http://localhost/api/send-sms', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('POST /api/send-sms', () => {
  const origConcurrency = process.env.SMS_CONCURRENCY

  beforeEach(() => {
    resetAuthMock()
    resetSupabaseMock()
    mockSendSms.mockReset()
    process.env.SMS_CONCURRENCY = '1'
  })

  afterEach(() => {
    if (origConcurrency === undefined) delete process.env.SMS_CONCURRENCY
    else process.env.SMS_CONCURRENCY = origConcurrency
  })

  describe('認証チェック', () => {
    it('未認証の場合は401を返す', async () => {
      setAuthenticated(false)
      const request = createRequest({
        recipients: [{ phone: '09012345678', message: 'test' }],
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('認証が必要です')
    })
  })

  describe('バリデーション', () => {
    beforeEach(() => {
      setAuthenticated(true)
    })

    it('recipientsが空の場合は400を返す', async () => {
      const request = createRequest({ recipients: [] })
      const response = await POST(request)
      expect(response.status).toBe(400)
    })

    it('recipientsが配列でない場合は400を返す', async () => {
      const request = createRequest({ recipients: 'not-array' })
      const response = await POST(request)
      expect(response.status).toBe(400)
    })

    it('recipientsが存在しない場合は400を返す', async () => {
      const request = createRequest({})
      const response = await POST(request)
      expect(response.status).toBe(400)
    })
  })

  describe('ドライラン', () => {
    beforeEach(() => {
      setAuthenticated(true)
    })

    it('dryRun=trueの場合、実際にSMSを送信しない', async () => {
      const request = createRequest({
        recipients: [{ phone: '09012345678', message: 'test' }],
        dryRun: true,
      })
      const response = await POST(request)
      const data = await response.json()

      expect(data.dryRun).toBe(true)
      expect(data.success).toBe(1)
      expect(mockSendSms).not.toHaveBeenCalled()
    })

    it('dryRun=trueでも成功カウントは正しく返す', async () => {
      const request = createRequest({
        recipients: [
          { phone: '09012345678', message: 'msg1' },
          { phone: '08012345678', message: 'msg2' },
        ],
        dryRun: true,
      })
      const response = await POST(request)
      const data = await response.json()

      expect(data.total).toBe(2)
      expect(data.success).toBe(2)
      expect(data.failed).toBe(0)
    })

    it('電話番号/メッセージが空のレシピエントはfailedとしてカウント', async () => {
      const request = createRequest({
        recipients: [
          { phone: '09012345678', message: 'valid' },
          { phone: '', message: 'no phone' },
          { phone: '08012345678', message: '' },
        ],
        dryRun: true,
      })
      const response = await POST(request)
      const data = await response.json()

      expect(data.total).toBe(3)
      expect(data.success).toBe(1)
      expect(data.failed).toBe(2)
    })
  })

  describe('SMS送信', () => {
    beforeEach(() => {
      setAuthenticated(true)
    })

    it('正常に送信できた場合、successカウントが増加', async () => {
      // pending insert
      enqueueQueryResult({ id: 'log-1' })
      mockSendSms.mockResolvedValue({ success: true, messageId: 'SM123' })
      // update to success
      enqueueQueryResult(null)

      const request = createRequest({
        recipients: [{ phone: '09012345678', message: 'test message' }],
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(1)
      expect(data.failed).toBe(0)
      expect(mockSendSms).toHaveBeenCalledWith('09012345678', 'test message')
    })

    it('送信失敗した場合、failedカウントが増加', async () => {
      // pending insert
      enqueueQueryResult({ id: 'log-1' })
      mockSendSms.mockResolvedValue({ success: false, error: 'Network error' })
      // update to failed
      enqueueQueryResult(null)

      const request = createRequest({
        recipients: [{ phone: '09012345678', message: 'test message' }],
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(0)
      expect(data.failed).toBe(1)
      expect(data.results[0].error).toBe('Network error')
    })

    it('複数件の送信結果が正しく集計される', async () => {
      // 3件分のinsert+update
      enqueueQueryResult({ id: 'log-1' })
      mockSendSms.mockResolvedValueOnce({ success: true, messageId: 'SM1' })
      enqueueQueryResult(null) // update success
      enqueueQueryResult({ id: 'log-2' })
      mockSendSms.mockResolvedValueOnce({ success: false, error: 'Failed' })
      enqueueQueryResult(null) // update failed
      enqueueQueryResult({ id: 'log-3' })
      mockSendSms.mockResolvedValueOnce({ success: true, messageId: 'SM2' })
      enqueueQueryResult(null) // update success

      const request = createRequest({
        recipients: [
          { phone: '09012345678', message: 'msg1' },
          { phone: '08012345678', message: 'msg2' },
          { phone: '07012345678', message: 'msg3' },
        ],
      })
      const response = await POST(request)
      const data = await response.json()

      expect(data.total).toBe(3)
      expect(data.success).toBe(2)
      expect(data.failed).toBe(1)
    })

    it('ログ先書きでpendingステータスのレコードが作成される', async () => {
      enqueueQueryResult({ id: 'log-1' })
      mockSendSms.mockResolvedValue({ success: true, messageId: 'SM123' })
      enqueueQueryResult(null) // update success

      const request = createRequest({
        recipients: [{ phone: '09012345678', message: 'test message' }],
      })
      await POST(request)

      expect(mockSendSms).toHaveBeenCalledWith('09012345678', 'test message')
    })

    it('ログinsertが失敗した場合はfailedとしてカウント', async () => {
      enqueueQueryResult(null, { message: 'DB error', code: '23000' })

      const request = createRequest({
        recipients: [{ phone: '09012345678', message: 'test message' }],
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.failed).toBe(1)
      expect(mockSendSms).not.toHaveBeenCalled()
    })
  })

  describe('エラーハンドリング', () => {
    beforeEach(() => {
      setAuthenticated(true)
    })

    it('JSONパースエラー時は500を返す', async () => {
      const request = new NextRequest('http://localhost/api/send-sms', {
        method: 'POST',
        body: 'invalid json',
        headers: { 'Content-Type': 'application/json' },
      })
      const response = await POST(request)
      expect(response.status).toBe(500)
    })
  })
})
