import { vi } from 'vitest'

// 送信履歴を記録
export const sentMessages: Array<{
  to: string
  body: string
  from: string
}> = []

// モックのTwilioクライアント
export const mockTwilioClient = {
  messages: {
    create: vi.fn().mockImplementation(async ({ to, body, from }) => {
      sentMessages.push({ to, body, from })
      return {
        sid: `SM${Date.now()}${Math.random().toString(36).substr(2, 9)}`,
        status: 'sent',
        to,
        body,
        from,
      }
    }),
  },
}

// エラーをシミュレートするヘルパー
export function simulateError(errorMessage: string) {
  mockTwilioClient.messages.create.mockRejectedValueOnce(new Error(errorMessage))
}

// モックをリセット
export function resetMock() {
  sentMessages.length = 0
  mockTwilioClient.messages.create.mockClear()
}

// Twilioモジュールのモック
vi.mock('twilio', () => ({
  default: vi.fn(() => mockTwilioClient),
}))
