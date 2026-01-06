import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

// モックのインポート（vi.mock() は名前付きインポート時に実行される）
import '../mocks/next-headers'
import { setAuthenticated, resetAuthMock } from '../mocks/auth'
import { mockSaveSmsLog, resetSupabaseMock } from '../mocks/supabase'

// sendSms のモック
const mockSendSms = vi.fn()
vi.mock('@/lib/twilio', () => ({
  sendSms: (...args: any[]) => mockSendSms(...args),
  normalizePhoneNumber: vi.fn((phone: string) => phone),
  validatePhoneNumber: vi.fn(() => true),
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
  beforeEach(() => {
    resetAuthMock()
    resetSupabaseMock()
    mockSendSms.mockClear()
    mockSaveSmsLog.mockClear()
  })

  describe('認証チェック', () => {
    it('未認証の場合は401を返す', async () => {
      setAuthenticated(false)

      const request = createRequest({ recipients: [{ phone: '09012345678', message: 'test' }] })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('認証が必要です')
    })
  })

  describe('入力バリデーション', () => {
    beforeEach(() => {
      setAuthenticated(true)
    })

    it('recipientsが空の場合は400を返す', async () => {
      const request = createRequest({ recipients: [] })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('送信先が指定されていません')
    })

    it('recipientsが配列でない場合は400を返す', async () => {
      const request = createRequest({ recipients: 'not-array' })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('送信先が指定されていません')
    })

    it('recipientsが存在しない場合は400を返す', async () => {
      const request = createRequest({})
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('送信先が指定されていません')
    })
  })

  describe('ドライラン', () => {
    beforeEach(() => {
      setAuthenticated(true)
    })

    it('dryRun=trueの場合、実際にSMSを送信しない', async () => {
      const request = createRequest({
        recipients: [{ phone: '09012345678', message: 'test message' }],
        dryRun: true,
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(mockSendSms).not.toHaveBeenCalled()
      expect(data.dryRun).toBe(true)
    })

    it('dryRun=trueでも成功カウントは正しく返す', async () => {
      const request = createRequest({
        recipients: [
          { phone: '09012345678', message: 'test 1' },
          { phone: '08012345678', message: 'test 2' },
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
      mockSendSms.mockResolvedValue({ success: true, messageId: 'SM123' })
      mockSaveSmsLog.mockResolvedValue(undefined)

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
      mockSendSms.mockResolvedValue({ success: false, error: 'Network error' })
      mockSaveSmsLog.mockResolvedValue(undefined)

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
      mockSendSms
        .mockResolvedValueOnce({ success: true, messageId: 'SM1' })
        .mockResolvedValueOnce({ success: false, error: 'Failed' })
        .mockResolvedValueOnce({ success: true, messageId: 'SM2' })
      mockSaveSmsLog.mockResolvedValue(undefined)

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

    it('成功時にsaveSmsLogが呼ばれる (status: success)', async () => {
      mockSendSms.mockResolvedValue({ success: true, messageId: 'SM123' })
      mockSaveSmsLog.mockResolvedValue(undefined)

      const request = createRequest({
        recipients: [{ phone: '09012345678', message: 'test message' }],
      })
      await POST(request)

      expect(mockSaveSmsLog).toHaveBeenCalledWith({
        phone_number: '09012345678',
        message: 'test message',
        status: 'success',
      })
    })

    it('失敗時にsaveSmsLogが呼ばれる (status: failed, error_message付き)', async () => {
      mockSendSms.mockResolvedValue({ success: false, error: 'Network error' })
      mockSaveSmsLog.mockResolvedValue(undefined)

      const request = createRequest({
        recipients: [{ phone: '09012345678', message: 'test message' }],
      })
      await POST(request)

      expect(mockSaveSmsLog).toHaveBeenCalledWith({
        phone_number: '09012345678',
        message: 'test message',
        status: 'failed',
        error_message: 'Network error',
      })
    })

    it('ログ保存失敗は無視して処理を続行', async () => {
      mockSendSms.mockResolvedValue({ success: true, messageId: 'SM123' })
      mockSaveSmsLog.mockRejectedValue(new Error('DB error'))

      const request = createRequest({
        recipients: [{ phone: '09012345678', message: 'test message' }],
      })
      const response = await POST(request)
      const data = await response.json()

      // ログ保存失敗でもレスポンスは成功
      expect(response.status).toBe(200)
      expect(data.success).toBe(1)
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
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('SMS送信中にエラーが発生しました')
    })
  })
})
