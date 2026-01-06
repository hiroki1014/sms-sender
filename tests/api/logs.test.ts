import { describe, it, expect, beforeEach } from 'vitest'

// モックのインポート（vi.mock() は名前付きインポート時に実行される）
import '../mocks/next-headers'
import { setAuthenticated, resetAuthMock } from '../mocks/auth'
import { mockGetSmsLogs, resetSupabaseMock } from '../mocks/supabase'

// APIハンドラをインポート
import { GET } from '@/app/api/logs/route'

describe('GET /api/logs', () => {
  beforeEach(() => {
    resetAuthMock()
    resetSupabaseMock()
    mockGetSmsLogs.mockClear()
  })

  it('未認証の場合は401を返す', async () => {
    setAuthenticated(false)

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toBe('認証が必要です')
  })

  it('ログ一覧を取得できる', async () => {
    setAuthenticated(true)
    const mockLogs = [
      { id: '1', phone_number: '09012345678', message: 'test1', status: 'success', sent_at: '2024-01-01' },
      { id: '2', phone_number: '08012345678', message: 'test2', status: 'failed', sent_at: '2024-01-02' },
    ]
    mockGetSmsLogs.mockResolvedValue(mockLogs)

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.logs).toEqual(mockLogs)
  })

  it('getSmsLogsに100が渡される', async () => {
    setAuthenticated(true)
    mockGetSmsLogs.mockResolvedValue([])

    await GET()

    expect(mockGetSmsLogs).toHaveBeenCalledWith(100)
  })

  it('エラー時は500を返す', async () => {
    setAuthenticated(true)
    mockGetSmsLogs.mockRejectedValue(new Error('DB error'))

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe('ログの取得に失敗しました')
  })
})
