import { describe, it, expect, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// モックのインポート
import '../mocks/next-headers'
import { setAuthenticated, resetAuthMock } from '../mocks/auth'
import {
  setQueryResult,
  setQueryError,
  resetSupabaseMock,
  getLastCalledTable,
} from '../mocks/supabase'

// ファクトリ関数
import { createCampaign, resetFixtureCounters } from '../fixtures'

// APIハンドラをインポート
import { GET, POST, PATCH, DELETE } from '@/app/api/campaigns/route'

// NextRequest を作成するヘルパー
function createGetRequest(params?: Record<string, string>): NextRequest {
  const url = new URL('http://localhost/api/campaigns')
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value)
    })
  }
  return new NextRequest(url, { method: 'GET' })
}

function createPostRequest(body: any): NextRequest {
  return new NextRequest('http://localhost/api/campaigns', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

function createPatchRequest(body: any): NextRequest {
  return new NextRequest('http://localhost/api/campaigns', {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

function createDeleteRequest(id?: string): NextRequest {
  const url = new URL('http://localhost/api/campaigns')
  if (id) {
    url.searchParams.set('id', id)
  }
  return new NextRequest(url, { method: 'DELETE' })
}

describe('GET /api/campaigns', () => {
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

  it('全キャンペーンを取得できる', async () => {
    setAuthenticated(true)
    const mockCampaigns = [
      createCampaign({ name: 'Campaign 1' }),
      createCampaign({ name: 'Campaign 2', status: 'sent' }),
    ]
    setQueryResult(mockCampaigns)

    const request = createGetRequest()
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.campaigns).toEqual(mockCampaigns)
    expect(getLastCalledTable()).toBe('campaigns')
  })

  it('statusパラメータでフィルタリングできる', async () => {
    setAuthenticated(true)
    const mockCampaigns = [
      createCampaign({ name: 'Draft Campaign', status: 'draft' }),
    ]
    setQueryResult(mockCampaigns)

    const request = createGetRequest({ status: 'draft' })
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.campaigns).toEqual(mockCampaigns)
  })

  it('Supabaseエラー時は500を返す', async () => {
    setAuthenticated(true)
    setQueryError('Database error')

    const request = createGetRequest()
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe('キャンペーンの取得に失敗しました')
  })
})

describe('POST /api/campaigns', () => {
  beforeEach(() => {
    resetAuthMock()
    resetSupabaseMock()
    resetFixtureCounters()
  })

  it('未認証の場合は401を返す', async () => {
    setAuthenticated(false)

    const request = createPostRequest({
      name: 'Test Campaign',
      message_template: 'Hello {{name}}!',
    })
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toBe('認証が必要です')
  })

  it('nameがない場合は400を返す', async () => {
    setAuthenticated(true)

    const request = createPostRequest({ message_template: 'Hello!' })
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('キャンペーン名とメッセージテンプレートが必要です')
  })

  it('message_templateがない場合は400を返す', async () => {
    setAuthenticated(true)

    const request = createPostRequest({ name: 'Test Campaign' })
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('キャンペーン名とメッセージテンプレートが必要です')
  })

  it('キャンペーンを作成できる', async () => {
    setAuthenticated(true)
    const mockCampaign = createCampaign({
      name: 'New Campaign',
      message_template: 'Hello {{name}}!',
    })
    setQueryResult(mockCampaign)

    const request = createPostRequest({
      name: 'New Campaign',
      message_template: 'Hello {{name}}!',
    })
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.campaign).toEqual(mockCampaign)
  })

  it('Supabaseエラー時は500を返す', async () => {
    setAuthenticated(true)
    setQueryError('Insert failed')

    const request = createPostRequest({
      name: 'Test Campaign',
      message_template: 'Hello!',
    })
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe('キャンペーンの作成に失敗しました')
  })
})

describe('PATCH /api/campaigns', () => {
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

  it('キャンペーンを更新できる', async () => {
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
    expect(data.error).toBe('キャンペーンの更新に失敗しました')
  })
})

describe('DELETE /api/campaigns', () => {
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

  it('キャンペーンを削除できる', async () => {
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
    expect(data.error).toBe('キャンペーンの削除に失敗しました')
  })
})
