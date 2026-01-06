import { describe, it, expect, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// モックのインポート
import '../mocks/next-headers'
import { setAuthenticated, resetAuthMock } from '../mocks/auth'
import '../mocks/auth'
import {
  setQueryResult,
  setQueryError,
  enqueueQueryResult,
  resetSupabaseMock,
  getLastCalledTable,
} from '../mocks/supabase'
import '../mocks/supabase'

// ファクトリ関数
import { createContact, resetFixtureCounters } from '../fixtures'

// APIハンドラをインポート
import { GET, POST, PATCH, DELETE } from '@/app/api/contacts/route'

// NextRequest を作成するヘルパー
function createGetRequest(params?: Record<string, string>): NextRequest {
  const url = new URL('http://localhost/api/contacts')
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value)
    })
  }
  return new NextRequest(url, { method: 'GET' })
}

function createPostRequest(body: any): NextRequest {
  return new NextRequest('http://localhost/api/contacts', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

function createPatchRequest(body: any): NextRequest {
  return new NextRequest('http://localhost/api/contacts', {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

function createDeleteRequest(id?: string): NextRequest {
  const url = new URL('http://localhost/api/contacts')
  if (id) {
    url.searchParams.set('id', id)
  }
  return new NextRequest(url, { method: 'DELETE' })
}

describe('GET /api/contacts', () => {
  beforeEach(() => {
    resetAuthMock()
    resetSupabaseMock()
    resetFixtureCounters()
  })

  it('未認証の場合は401を返す', async () => {
    setAuthenticated(false)

    const request = createGetRequest()
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toBe('認証が必要です')
  })

  it('全顧客を取得できる', async () => {
    setAuthenticated(true)
    const mockContacts = [
      createContact({ phone_number: '09012345678', name: 'Test User' }),
      createContact({ phone_number: '08012345678', name: 'Test User 2', tags: ['vip'] }),
    ]
    setQueryResult(mockContacts)

    const request = createGetRequest()
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.contacts).toEqual(mockContacts)
    expect(getLastCalledTable()).toBe('contacts')
  })

  it('tagパラメータでフィルタリングできる', async () => {
    setAuthenticated(true)
    const mockContacts = [
      createContact({ phone_number: '09012345678', name: 'VIP User', tags: ['vip'] }),
    ]
    setQueryResult(mockContacts)

    const request = createGetRequest({ tag: 'vip' })
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.contacts).toEqual(mockContacts)
    expect(getLastCalledTable()).toBe('contacts')
  })

  it('includeOptedOut=trueでオプトアウト顧客も含む', async () => {
    setAuthenticated(true)
    const mockContacts = [
      createContact({ phone_number: '09012345678', name: 'Active' }),
      createContact({ phone_number: '08012345678', name: 'Opted Out', opted_out: true }),
    ]
    setQueryResult(mockContacts)

    const request = createGetRequest({ includeOptedOut: 'true' })
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.contacts).toEqual(mockContacts)
    expect(getLastCalledTable()).toBe('contacts')
  })

  it('デフォルトではオプトアウト顧客を除外', async () => {
    setAuthenticated(true)
    const mockContacts = [
      createContact({ phone_number: '09012345678', name: 'Active' }),
    ]
    setQueryResult(mockContacts)

    const request = createGetRequest()
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.contacts).toEqual(mockContacts)
    expect(getLastCalledTable()).toBe('contacts')
  })

  it('Supabaseエラー時は500を返す', async () => {
    setAuthenticated(true)
    setQueryError('Database error')

    const request = createGetRequest()
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe('顧客の取得に失敗しました')
  })
})

describe('POST /api/contacts', () => {
  beforeEach(() => {
    resetAuthMock()
    resetSupabaseMock()
    resetFixtureCounters()
  })

  it('未認証の場合は401を返す', async () => {
    setAuthenticated(false)

    const request = createPostRequest({ contacts: [{ phone_number: '09012345678' }] })
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toBe('認証が必要です')
  })

  it('contactsが空の場合は400を返す', async () => {
    setAuthenticated(true)

    const request = createPostRequest({ contacts: [] })
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('顧客データが必要です')
  })

  it('contactsが配列でない場合は400を返す', async () => {
    setAuthenticated(true)

    const request = createPostRequest({ contacts: 'not-array' })
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('顧客データが必要です')
  })

  it('新規顧客を追加できる', async () => {
    setAuthenticated(true)
    // 1回目: 既存の電話番号チェック (空)
    enqueueQueryResult([])
    // 2回目: insert成功
    enqueueQueryResult(null, null)

    const request = createPostRequest({
      contacts: [{ phone_number: '09012345678', name: 'New User' }],
    })
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.added).toBe(1)
    expect(data.duplicates).toBe(0)
  })

  it('重複する電話番号はスキップ', async () => {
    setAuthenticated(true)
    // 1回目: 既存の電話番号チェック (1件既存)
    enqueueQueryResult([{ phone_number: '09012345678' }])

    const request = createPostRequest({
      contacts: [
        { phone_number: '09012345678', name: 'Existing' },
        { phone_number: '08012345678', name: 'New' },
      ],
    })
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.added).toBe(1)
    expect(data.duplicates).toBe(1)
    expect(data.total).toBe(2)
  })

  it('Supabaseエラー時は500を返す', async () => {
    setAuthenticated(true)
    // 1回目: 既存チェック成功
    enqueueQueryResult([])
    // 2回目: insertエラー
    enqueueQueryResult(null, { message: 'Insert failed' })

    const request = createPostRequest({
      contacts: [{ phone_number: '09012345678', name: 'Test' }],
    })
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe('顧客の追加に失敗しました')
  })
})

describe('PATCH /api/contacts', () => {
  beforeEach(() => {
    resetAuthMock()
    resetSupabaseMock()
    resetFixtureCounters()
  })

  it('未認証の場合は401を返す', async () => {
    setAuthenticated(false)

    const request = createPatchRequest({ id: '123', name: 'Updated' })
    const response = await PATCH(request)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toBe('認証が必要です')
  })

  it('IDがない場合は400を返す', async () => {
    setAuthenticated(true)

    const request = createPatchRequest({ name: 'Updated' })
    const response = await PATCH(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('IDが必要です')
  })

  it('顧客情報を更新できる', async () => {
    setAuthenticated(true)
    setQueryResult(null, null)

    const request = createPatchRequest({ id: '123', name: 'Updated Name' })
    const response = await PATCH(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
  })

  it('Supabaseエラー時は500を返す', async () => {
    setAuthenticated(true)
    setQueryError('Update failed')

    const request = createPatchRequest({ id: '123', name: 'Updated' })
    const response = await PATCH(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe('顧客の更新に失敗しました')
  })
})

describe('DELETE /api/contacts', () => {
  beforeEach(() => {
    resetAuthMock()
    resetSupabaseMock()
    resetFixtureCounters()
  })

  it('未認証の場合は401を返す', async () => {
    setAuthenticated(false)

    const request = createDeleteRequest('123')
    const response = await DELETE(request)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toBe('認証が必要です')
  })

  it('IDがない場合は400を返す', async () => {
    setAuthenticated(true)

    const request = createDeleteRequest()
    const response = await DELETE(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('IDが必要です')
  })

  it('顧客を削除できる', async () => {
    setAuthenticated(true)
    setQueryResult(null, null)

    const request = createDeleteRequest('123')
    const response = await DELETE(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
  })

  it('Supabaseエラー時は500を返す', async () => {
    setAuthenticated(true)
    setQueryError('Delete failed')

    const request = createDeleteRequest('123')
    const response = await DELETE(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe('顧客の削除に失敗しました')
  })
})
