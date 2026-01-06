import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  mockCookies,
  mockCookieStore,
  resetCookieMock,
} from '../mocks/next-headers'

// next/headers をモックした後に auth をインポート
import '../mocks/next-headers'
import { verifyPassword, setAuthCookie, clearAuthCookie, isAuthenticated } from '@/lib/auth'

describe('lib/auth', () => {
  beforeEach(() => {
    resetCookieMock()
    vi.stubEnv('AUTH_PASSWORD', 'testpassword123')
  })

  describe('verifyPassword', () => {
    it('正しいパスワードでtrueを返す', () => {
      expect(verifyPassword('testpassword123')).toBe(true)
    })

    it('間違ったパスワードでfalseを返す', () => {
      expect(verifyPassword('wrongpassword')).toBe(false)
    })

    it('空のパスワードでfalseを返す', () => {
      expect(verifyPassword('')).toBe(false)
    })

    it('AUTH_PASSWORDが未設定の場合falseを返す', () => {
      vi.stubEnv('AUTH_PASSWORD', '')
      expect(verifyPassword('testpassword123')).toBe(false)
    })
  })

  describe('setAuthCookie', () => {
    it('認証Cookieが設定される', async () => {
      await setAuthCookie()

      expect(mockCookies.set).toHaveBeenCalledWith(
        'sms_sender_auth',
        'authenticated',
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
        })
      )
    })

    it('maxAgeが24時間に設定される', async () => {
      await setAuthCookie()

      expect(mockCookies.set).toHaveBeenCalledWith(
        'sms_sender_auth',
        'authenticated',
        expect.objectContaining({
          maxAge: 60 * 60 * 24,
        })
      )
    })
  })

  describe('clearAuthCookie', () => {
    it('認証Cookieが削除される', async () => {
      mockCookieStore.set('sms_sender_auth', 'authenticated')

      await clearAuthCookie()

      expect(mockCookies.delete).toHaveBeenCalledWith('sms_sender_auth')
    })
  })

  describe('isAuthenticated', () => {
    it('認証Cookieがあればtrueを返す', async () => {
      mockCookieStore.set('sms_sender_auth', 'authenticated')

      const result = await isAuthenticated()

      expect(result).toBe(true)
    })

    it('認証Cookieがなければfalseを返す', async () => {
      const result = await isAuthenticated()

      expect(result).toBe(false)
    })

    it('Cookie値が不正ならfalseを返す', async () => {
      mockCookieStore.set('sms_sender_auth', 'invalid_value')

      const result = await isAuthenticated()

      expect(result).toBe(false)
    })
  })
})
