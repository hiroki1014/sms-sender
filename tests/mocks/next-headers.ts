import { vi } from 'vitest'

// モックCookieストア
export const mockCookieStore = new Map<string, string>()

export const mockCookies = {
  get: vi.fn((name: string) => {
    const value = mockCookieStore.get(name)
    return value ? { name, value } : undefined
  }),
  set: vi.fn((name: string, value: string, _options?: any) => {
    mockCookieStore.set(name, value)
  }),
  delete: vi.fn((name: string) => {
    mockCookieStore.delete(name)
  }),
}

// ヘルパー: Cookieを設定
export function setCookie(name: string, value: string) {
  mockCookieStore.set(name, value)
}

// ヘルパー: リセット
export function resetCookieMock() {
  mockCookieStore.clear()
  mockCookies.get.mockClear()
  mockCookies.set.mockClear()
  mockCookies.delete.mockClear()
}

// モジュールモック
vi.mock('next/headers', () => ({
  cookies: vi.fn(() => Promise.resolve(mockCookies)),
}))
