import { vi } from 'vitest'
import type { SmsLog } from '@/lib/supabase'
import type { Contact } from '@/app/api/contacts/route'

// モックデータストア（型付き）
export const mockData = {
  sms_logs: [] as SmsLog[],
  contacts: [] as Contact[],
}

// クエリ結果のキュー（複数のクエリを順番に処理するため）
let queryResultQueue: Array<{ data: any; error: any }> = []
let defaultQueryResult: { data: any; error: any } = { data: null, error: null }

// テーブル名追跡
let lastCalledTable: string | null = null
const tableCallHistory: string[] = []

// クエリビルダーのモック
export const createQueryBuilder = () => {
  const getResult = () => {
    if (queryResultQueue.length > 0) {
      return queryResultQueue.shift()!
    }
    return defaultQueryResult
  }

  const builder = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    contains: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
    // Promise-like behavior
    then: vi.fn((resolve) => resolve(getResult())),
  }
  return builder
}

export const mockSupabaseClient = {
  from: vi.fn((table: string) => {
    lastCalledTable = table
    tableCallHistory.push(table)
    return createQueryBuilder()
  }),
}

// ヘルパー: デフォルトの成功レスポンスを設定
export function setQueryResult(data: any, error: any = null) {
  defaultQueryResult = { data, error }
}

// ヘルパー: クエリ結果をキューに追加（複数クエリ用）
export function enqueueQueryResult(data: any, error: any = null) {
  queryResultQueue.push({ data, error })
}

// ヘルパー: エラーレスポンスを設定
export function setQueryError(message: string) {
  defaultQueryResult = { data: null, error: { message } }
}

// ヘルパー: 最後に呼び出されたテーブル名を取得
export function getLastCalledTable(): string | null {
  return lastCalledTable
}

// ヘルパー: テーブル呼び出し履歴を取得
export function getTableCallHistory(): string[] {
  return [...tableCallHistory]
}

// ヘルパー: リセット
export function resetSupabaseMock() {
  mockData.sms_logs = []
  mockData.contacts = []
  defaultQueryResult = { data: null, error: null }
  queryResultQueue = []
  lastCalledTable = null
  tableCallHistory.length = 0
  mockSupabaseClient.from.mockClear()
}

// getSupabase のモック
export const mockGetSupabase = vi.fn(() => mockSupabaseClient)

// saveSmsLog のモック
export const mockSaveSmsLog = vi.fn()

// getSmsLogs のモック
export const mockGetSmsLogs = vi.fn(() => Promise.resolve([] as SmsLog[]))

// モジュールモック
vi.mock('@/lib/supabase', () => ({
  getSupabase: () => mockSupabaseClient,
  saveSmsLog: (...args: any[]) => mockSaveSmsLog(...args),
  getSmsLogs: (...args: any[]) => mockGetSmsLogs(...args),
}))
