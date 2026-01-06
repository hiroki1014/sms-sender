import { describe, it, expect, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// モックのインポート
import '../mocks/next-headers'
import {
  mockVerifyPassword,
  mockSetAuthCookie,
  mockClearAuthCookie,
  resetAuthMock,
} from '../mocks/auth'
import '../mocks/auth'

// APIハンドラをインポート
import { POST, DELETE } from '@/app/api/auth/route'

// NextRequest を作成するヘルパー
function createRequest(body: any): NextRequest {
  return new NextRequest('http://localhost/api/auth', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('POST /api/auth (ログイン)', () => {
  beforeEach(() => {
    resetAuthMock()
  })

  it('パスワードが空の場合は400を返す', async () => {
    const request = createRequest({ password: '' })
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('パスワードを入力してください')
  })

  it('パスワードが未指定の場合は400を返す', async () => {
    const request = createRequest({})
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('パスワードを入力してください')
  })

  it('パスワードが間違っている場合は401を返す', async () => {
    mockVerifyPassword.mockReturnValue(false)

    const request = createRequest({ password: 'wrongpassword' })
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toBe('パスワードが正しくありません')
  })

  it('パスワードが正しい場合はsetAuthCookieが呼ばれる', async () => {
    mockVerifyPassword.mockReturnValue(true)
    mockSetAuthCookie.mockResolvedValue(undefined)

    const request = createRequest({ password: 'testpassword123' })
    await POST(request)

    expect(mockSetAuthCookie).toHaveBeenCalled()
  })

  it('パスワードが正しい場合は{ success: true }を返す', async () => {
    mockVerifyPassword.mockReturnValue(true)
    mockSetAuthCookie.mockResolvedValue(undefined)

    const request = createRequest({ password: 'testpassword123' })
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
  })

  it('例外発生時は500を返す', async () => {
    mockVerifyPassword.mockImplementation(() => {
      throw new Error('Unexpected error')
    })

    const request = createRequest({ password: 'testpassword123' })
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe('認証エラーが発生しました')
  })
})

describe('DELETE /api/auth (ログアウト)', () => {
  beforeEach(() => {
    resetAuthMock()
  })

  it('clearAuthCookieが呼ばれる', async () => {
    mockClearAuthCookie.mockResolvedValue(undefined)

    await DELETE()

    expect(mockClearAuthCookie).toHaveBeenCalled()
  })

  it('{ success: true }を返す', async () => {
    mockClearAuthCookie.mockResolvedValue(undefined)

    const response = await DELETE()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
  })

  it('例外発生時は500を返す', async () => {
    mockClearAuthCookie.mockRejectedValue(new Error('Cookie error'))

    const response = await DELETE()
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe('ログアウトエラーが発生しました')
  })
})
