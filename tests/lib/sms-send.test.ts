import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mockTwilioClient, sentMessages, resetMock, simulateError } from '../mocks/twilio'

// Twilioモジュールをモック
vi.mock('twilio', () => ({
  default: vi.fn(() => mockTwilioClient),
}))

// sendSms関数をテスト用にインポート
import { sendSms, normalizePhoneNumber } from '@/lib/twilio'

describe('sendSms', () => {
  beforeEach(() => {
    resetMock()
  })

  it('有効な電話番号にSMSを送信できる', async () => {
    const result = await sendSms('09012345678', 'テストメッセージ')

    expect(result.success).toBe(true)
    expect(result.messageId).toBeDefined()
    expect(sentMessages).toHaveLength(1)
    expect(sentMessages[0].to).toBe('+819012345678')
    expect(sentMessages[0].body).toBe('テストメッセージ')
  })

  it('無効な電話番号はエラーを返す', async () => {
    const result = await sendSms('0312345678', 'テストメッセージ')

    expect(result.success).toBe(false)
    expect(result.error).toContain('無効な電話番号形式')
    expect(sentMessages).toHaveLength(0)
  })

  it('ハイフン入りの電話番号も処理できる', async () => {
    const result = await sendSms('090-1234-5678', 'テストメッセージ')

    expect(result.success).toBe(true)
    expect(sentMessages[0].to).toBe('+819012345678')
  })

  it('Twilioエラーを適切に処理する', async () => {
    simulateError('Twilio API Error')

    const result = await sendSms('09012345678', 'テストメッセージ')

    expect(result.success).toBe(false)
    expect(result.error).toBe('Twilio API Error')
  })

  it('複数のSMSを順番に送信できる', async () => {
    await sendSms('09012345678', 'メッセージ1')
    await sendSms('08012345678', 'メッセージ2')
    await sendSms('07012345678', 'メッセージ3')

    expect(sentMessages).toHaveLength(3)
    expect(sentMessages[0].body).toBe('メッセージ1')
    expect(sentMessages[1].body).toBe('メッセージ2')
    expect(sentMessages[2].body).toBe('メッセージ3')
  })
})

describe('normalizePhoneNumber', () => {
  it('日本の携帯番号を国際形式に変換', () => {
    expect(normalizePhoneNumber('09012345678')).toBe('+819012345678')
    expect(normalizePhoneNumber('08087654321')).toBe('+818087654321')
    expect(normalizePhoneNumber('07011112222')).toBe('+817011112222')
  })
})
