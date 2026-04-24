import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { resetSupabaseMock, enqueueQueryResult, mockSupabaseClient } from '../mocks/supabase'

const mockSendSms = vi.fn()
vi.mock('@/lib/twilio', () => ({
  sendSms: (...args: any[]) => mockSendSms(...args),
  toDomesticFormat: (phone: string) => {
    const digits = phone.replace(/\D/g, '')
    if (digits.startsWith('81')) return '0' + digits.slice(2)
    if (digits.startsWith('0')) return digits
    return digits
  },
}))

vi.mock('@/lib/url-shortener', () => ({
  replaceUrlsWithShortUrls: vi.fn(async ({ message }: { message: string }) => ({
    processedMessage: message,
    shortUrls: [],
  })),
}))

import { sendCampaign } from '@/lib/send-campaign'

describe('sendCampaign', () => {
  const origConcurrency = process.env.SMS_CONCURRENCY

  beforeEach(() => {
    resetSupabaseMock()
    mockSendSms.mockReset()
    process.env.SMS_CONCURRENCY = '1'
  })

  afterEach(() => {
    if (origConcurrency === undefined) delete process.env.SMS_CONCURRENCY
    else process.env.SMS_CONCURRENCY = origConcurrency
  })

  describe('基本送信', () => {
    it('全件成功する場合のカウント', async () => {
      enqueueQueryResult({ id: 'log-1' })
      mockSendSms.mockResolvedValueOnce({ success: true, messageId: 'SM1' })
      enqueueQueryResult(null)

      enqueueQueryResult({ id: 'log-2' })
      mockSendSms.mockResolvedValueOnce({ success: true, messageId: 'SM2' })
      enqueueQueryResult(null)

      const result = await sendCampaign({
        recipients: [
          { phone: '09012345678', message: 'msg1' },
          { phone: '08012345678', message: 'msg2' },
        ],
      })

      expect(result.total).toBe(2)
      expect(result.success).toBe(2)
      expect(result.failed).toBe(0)
      expect(result.skipped).toBe(0)
      expect(result.isPartial).toBe(false)
    })

    it('送信失敗時のカウント', async () => {
      enqueueQueryResult({ id: 'log-1' })
      mockSendSms.mockResolvedValueOnce({ success: false, error: 'API error' })
      enqueueQueryResult(null)

      const result = await sendCampaign({
        recipients: [{ phone: '09012345678', message: 'msg1' }],
      })

      expect(result.success).toBe(0)
      expect(result.failed).toBe(1)
      expect(result.results[0].error).toBe('API error')
    })

    it('空の電話番号はfailedとしてカウント', async () => {
      const result = await sendCampaign({
        recipients: [{ phone: '', message: 'msg' }],
      })

      expect(result.failed).toBe(1)
      expect(result.results[0].error).toContain('空です')
    })
  })

  describe('dryRun', () => {
    it('Twilio APIを呼ばずにsuccessカウントする', async () => {
      const result = await sendCampaign({
        recipients: [
          { phone: '09012345678', message: 'msg1' },
          { phone: '08012345678', message: 'msg2' },
        ],
        dryRun: true,
      })

      expect(result.success).toBe(2)
      expect(result.failed).toBe(0)
      expect(mockSendSms).not.toHaveBeenCalled()
    })
  })

  describe('スキップカウント', () => {
    it('alreadySentのスキップがskippedに計上される', async () => {
      // fetchAll for sms_logs returns 1 success record
      enqueueQueryResult([{ phone_number: '09012345678', status: 'success' }])
      // fetchAllByIn for opted_out contacts
      enqueueQueryResult([])

      const result = await sendCampaign({
        recipients: [{ phone: '09012345678', message: 'msg1' }],
        campaignId: 'camp-1',
      })

      expect(result.skipped).toBe(1)
      expect(result.success).toBe(0)
      expect(result.failed).toBe(0)
      expect(result.total).toBe(1)
      expect(result.results[0].skipped).toBe(true)
      expect(result.results[0].skipReason).toContain('送信済み')
    })

    it('ユニーク制約で既存success時のスキップ', async () => {
      // fetchAll for sms_logs (empty - no prior success)
      enqueueQueryResult([])
      // contact_idなしのためfetchAllByInは呼ばれない
      // INSERT fails with unique constraint
      enqueueQueryResult(null, { code: '23505', message: 'duplicate' })
      // SELECT existing record
      enqueueQueryResult({ id: 'existing-1', status: 'success', twilio_sid: 'SM999' })

      const result = await sendCampaign({
        recipients: [{ phone: '09012345678', message: 'msg1' }],
        campaignId: 'camp-1',
      })

      expect(result.skipped).toBe(1)
      expect(result.total).toBe(1)
      expect(result.results[0].skipped).toBe(true)
      expect(result.results[0].skipReason).toContain('ユニーク制約')
    })

    it('ユニーク制約で不明ステータス時のスキップ', async () => {
      enqueueQueryResult([])
      // contact_idなしのためfetchAllByInは呼ばれない
      enqueueQueryResult(null, { code: '23505', message: 'duplicate' })
      enqueueQueryResult({ id: 'existing-1', status: 'unknown_status', twilio_sid: null })

      const result = await sendCampaign({
        recipients: [{ phone: '09012345678', message: 'msg1' }],
        campaignId: 'camp-1',
      })

      expect(result.skipped).toBe(1)
      expect(result.total).toBe(1)
      expect(result.results[0].skipped).toBe(true)
      expect(result.results[0].skipReason).toContain('不明なステータス')
    })
  })

  describe('デッドライン', () => {
    it('デッドライン到達時にisPartial=trueで中断する', async () => {
      // デッドラインを過去に設定（即座に中断）
      const result = await sendCampaign({
        recipients: [
          { phone: '09012345678', message: 'msg1' },
          { phone: '08012345678', message: 'msg2' },
        ],
        deadlineMs: Date.now() - 1000,
      })

      expect(result.isPartial).toBe(true)
      expect(result.total).toBe(0)
      expect(result.success).toBe(0)
      expect(mockSendSms).not.toHaveBeenCalled()
    })

    it('デッドライン未設定なら全件処理する', async () => {
      enqueueQueryResult({ id: 'log-1' })
      mockSendSms.mockResolvedValueOnce({ success: true, messageId: 'SM1' })
      enqueueQueryResult(null)

      enqueueQueryResult({ id: 'log-2' })
      mockSendSms.mockResolvedValueOnce({ success: true, messageId: 'SM2' })
      enqueueQueryResult(null)

      const result = await sendCampaign({
        recipients: [
          { phone: '09012345678', message: 'msg1' },
          { phone: '08012345678', message: 'msg2' },
        ],
      })

      expect(result.isPartial).toBe(false)
      expect(result.total).toBe(2)
    })

    it('十分な時間があれば全件処理する', async () => {
      enqueueQueryResult({ id: 'log-1' })
      mockSendSms.mockResolvedValueOnce({ success: true, messageId: 'SM1' })
      enqueueQueryResult(null)

      const result = await sendCampaign({
        recipients: [{ phone: '09012345678', message: 'msg1' }],
        deadlineMs: Date.now() + 300_000,
      })

      expect(result.isPartial).toBe(false)
      expect(result.success).toBe(1)
    })
  })

  describe('DELETE廃止', () => {
    it('送信失敗+ログ更新失敗時にDELETEではなくerror_messageを更新する', async () => {
      enqueueQueryResult({ id: 'log-1' })
      mockSendSms.mockResolvedValueOnce({ success: false, error: 'Twilio error' })
      // 3回のupdate to failed がすべて失敗
      enqueueQueryResult(null, { message: 'DB error' })
      enqueueQueryResult(null, { message: 'DB error' })
      enqueueQueryResult(null, { message: 'DB error' })
      // error_message update
      enqueueQueryResult(null)

      const result = await sendCampaign({
        recipients: [{ phone: '09012345678', message: 'msg1' }],
      })

      expect(result.failed).toBe(1)

      const fromCalls = mockSupabaseClient.from.mock.calls
      const deleteUsed = fromCalls.some((_call: any[], idx: number) => {
        const returnVal = mockSupabaseClient.from.mock.results[idx]?.value
        return returnVal?.delete?.mock?.calls?.length > 0
      })
      expect(deleteUsed).toBe(false)
    })
  })

  describe('冪等性', () => {
    it('successの宛先はスキップされる', async () => {
      // fetchAll: 既送信レコード
      enqueueQueryResult([
        { phone_number: '09012345678', status: 'success' },
      ])
      // fetchAllByIn: opt-out
      enqueueQueryResult([])
      // 2件目は通常処理
      enqueueQueryResult({ id: 'log-2' })
      mockSendSms.mockResolvedValueOnce({ success: true, messageId: 'SM2' })
      enqueueQueryResult(null)

      const result = await sendCampaign({
        recipients: [
          { phone: '09012345678', message: 'msg1' },
          { phone: '08012345678', message: 'msg2' },
        ],
        campaignId: 'camp-1',
      })

      expect(result.skipped).toBe(1)
      expect(result.success).toBe(1)
      expect(result.total).toBe(2)
      expect(mockSendSms).toHaveBeenCalledTimes(1)
    })
  })

  describe('配信停止', () => {
    it('opted_outの連絡先はfailedとしてカウント', async () => {
      // fetchAll: sms_logs (empty)
      enqueueQueryResult([])
      // fetchAllByIn: opted_out contacts
      enqueueQueryResult([{ id: 'contact-1' }])

      const result = await sendCampaign({
        recipients: [
          { phone: '09012345678', message: 'msg1', contact_id: 'contact-1' },
        ],
        campaignId: 'camp-1',
      })

      expect(result.failed).toBe(1)
      expect(result.results[0].error).toContain('配信停止')
      expect(mockSendSms).not.toHaveBeenCalled()
    })
  })

  describe('totalの整合性', () => {
    it('total = success + failed + skipped', async () => {
      // fetchAll: 1件success済み
      enqueueQueryResult([
        { phone_number: '09012345678', status: 'success' },
      ])
      // fetchAllByIn: 1件opted_out
      enqueueQueryResult([{ id: 'contact-2' }])
      // 3件目: 通常送信成功
      enqueueQueryResult({ id: 'log-3' })
      mockSendSms.mockResolvedValueOnce({ success: true, messageId: 'SM3' })
      enqueueQueryResult(null)

      const result = await sendCampaign({
        recipients: [
          { phone: '09012345678', message: 'msg1' },
          { phone: '08012345678', message: 'msg2', contact_id: 'contact-2' },
          { phone: '07012345678', message: 'msg3' },
        ],
        campaignId: 'camp-1',
      })

      expect(result.total).toBe(result.success + result.failed + result.skipped)
      expect(result.skipped).toBe(1)
      expect(result.failed).toBe(1)
      expect(result.success).toBe(1)
      expect(result.total).toBe(3)
    })
  })

  describe('並行送信', () => {
    it('CONCURRENCY=2で4件を2バッチに分けて処理する', async () => {
      process.env.SMS_CONCURRENCY = '2'

      // バッチ1: r1,r2 並行 → INSERT(r1), INSERT(r2), UPDATE(r1), UPDATE(r2)
      enqueueQueryResult({ id: 'log-0' })
      enqueueQueryResult({ id: 'log-1' })
      mockSendSms.mockResolvedValueOnce({ success: true, messageId: 'SM0' })
      mockSendSms.mockResolvedValueOnce({ success: true, messageId: 'SM1' })
      enqueueQueryResult(null)
      enqueueQueryResult(null)

      // バッチ2: r3,r4 並行
      enqueueQueryResult({ id: 'log-2' })
      enqueueQueryResult({ id: 'log-3' })
      mockSendSms.mockResolvedValueOnce({ success: true, messageId: 'SM2' })
      mockSendSms.mockResolvedValueOnce({ success: true, messageId: 'SM3' })
      enqueueQueryResult(null)
      enqueueQueryResult(null)

      const result = await sendCampaign({
        recipients: [
          { phone: '09012345678', message: 'msg1' },
          { phone: '08012345678', message: 'msg2' },
          { phone: '07012345678', message: 'msg3' },
          { phone: '09087654321', message: 'msg4' },
        ],
      })

      expect(result.success).toBe(4)
      expect(result.failed).toBe(0)
      expect(result.total).toBe(4)
      expect(mockSendSms).toHaveBeenCalledTimes(4)
    })

    it('バッチ内の1件失敗が他に影響しない', async () => {
      process.env.SMS_CONCURRENCY = '3'

      // 3件並行: INSERT(r1), INSERT(r2), INSERT(r3), sendSms, UPDATE(r1), UPDATE(r2), UPDATE(r3)
      enqueueQueryResult({ id: 'log-1' })
      enqueueQueryResult({ id: 'log-2' })
      enqueueQueryResult({ id: 'log-3' })
      mockSendSms.mockResolvedValueOnce({ success: true, messageId: 'SM1' })
      mockSendSms.mockResolvedValueOnce({ success: false, error: 'Twilio error' })
      mockSendSms.mockResolvedValueOnce({ success: true, messageId: 'SM3' })
      enqueueQueryResult(null)
      enqueueQueryResult(null)
      enqueueQueryResult(null)

      const result = await sendCampaign({
        recipients: [
          { phone: '09012345678', message: 'msg1' },
          { phone: '08012345678', message: 'msg2' },
          { phone: '07012345678', message: 'msg3' },
        ],
      })

      expect(result.success).toBe(2)
      expect(result.failed).toBe(1)
      expect(result.total).toBe(3)
    })

    it('Phase1スキップ後の残りだけがバッチ処理される', async () => {
      process.env.SMS_CONCURRENCY = '5'

      // fetchAll: 2件success済み
      enqueueQueryResult([
        { phone_number: '09012345678', status: 'success' },
        { phone_number: '08012345678', status: 'success' },
      ])
      // fetchAllByIn: opt-out なし
      enqueueQueryResult([])
      // 3件目だけ送信
      enqueueQueryResult({ id: 'log-3' })
      mockSendSms.mockResolvedValueOnce({ success: true, messageId: 'SM3' })
      enqueueQueryResult(null)

      const result = await sendCampaign({
        recipients: [
          { phone: '09012345678', message: 'msg1' },
          { phone: '08012345678', message: 'msg2' },
          { phone: '07012345678', message: 'msg3' },
        ],
        campaignId: 'camp-1',
      })

      expect(result.skipped).toBe(2)
      expect(result.success).toBe(1)
      expect(result.total).toBe(3)
      expect(mockSendSms).toHaveBeenCalledTimes(1)
    })

    it('dryRunでは並行処理をスキップする', async () => {
      process.env.SMS_CONCURRENCY = '5'

      const result = await sendCampaign({
        recipients: [
          { phone: '09012345678', message: 'msg1' },
          { phone: '08012345678', message: 'msg2' },
          { phone: '07012345678', message: 'msg3' },
        ],
        dryRun: true,
      })

      expect(result.success).toBe(3)
      expect(result.total).toBe(3)
      expect(mockSendSms).not.toHaveBeenCalled()
    })
  })
})
