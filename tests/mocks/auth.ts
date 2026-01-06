import { vi } from 'vitest'

// モック認証状態
export let mockAuthState = {
  isAuthenticated: false,
}

// 認証関数のモック
export const mockVerifyPassword = vi.fn((password: string) => password === 'testpassword123')
export const mockSetAuthCookie = vi.fn(() => Promise.resolve())
export const mockClearAuthCookie = vi.fn(() => Promise.resolve())
export const mockIsAuthenticated = vi.fn(() => Promise.resolve(mockAuthState.isAuthenticated))

// ヘルパー: 認証状態を設定
export function setAuthenticated(value: boolean) {
  mockAuthState.isAuthenticated = value
  mockIsAuthenticated.mockResolvedValue(value)
}

// ヘルパー: リセット
export function resetAuthMock() {
  mockAuthState.isAuthenticated = false
  mockVerifyPassword.mockClear()
  mockSetAuthCookie.mockClear()
  mockClearAuthCookie.mockClear()
  mockIsAuthenticated.mockClear()
  mockIsAuthenticated.mockResolvedValue(false)
}

// モジュールモック
vi.mock('@/lib/auth', () => ({
  verifyPassword: (...args: any[]) => mockVerifyPassword(...args),
  setAuthCookie: (...args: any[]) => mockSetAuthCookie(...args),
  clearAuthCookie: (...args: any[]) => mockClearAuthCookie(...args),
  isAuthenticated: (...args: any[]) => mockIsAuthenticated(...args),
}))
