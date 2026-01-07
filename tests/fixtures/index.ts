import type { SmsLog, Campaign } from '@/lib/supabase'
import type { Contact } from '@/app/api/contacts/route'

let contactIdCounter = 1
let smsLogIdCounter = 1
let campaignIdCounter = 1

/**
 * テスト用のContact生成ファクトリ
 */
export function createContact(overrides?: Partial<Contact>): Contact {
  const currentId = contactIdCounter++
  const now = new Date().toISOString()

  return {
    id: String(currentId),
    phone_number: `090${String(currentId).padStart(8, '0')}`,
    name: `Test User ${currentId}`,
    tags: [],
    opted_out: false,
    opted_out_at: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  }
}

/**
 * テスト用のSmsLog生成ファクトリ
 */
export function createSmsLog(overrides?: Partial<SmsLog>): SmsLog {
  const currentId = smsLogIdCounter++

  return {
    id: String(currentId),
    phone_number: `090${String(currentId).padStart(8, '0')}`,
    message: `Test message ${currentId}`,
    status: 'success',
    error_message: null,
    sent_at: new Date().toISOString(),
    ...overrides,
  }
}

/**
 * 複数のContactを生成
 */
export function createContacts(count: number, overrides?: Partial<Contact>): Contact[] {
  return Array.from({ length: count }, () => createContact(overrides))
}

/**
 * 複数のSmsLogを生成
 */
export function createSmsLogs(count: number, overrides?: Partial<SmsLog>): SmsLog[] {
  return Array.from({ length: count }, () => createSmsLog(overrides))
}

/**
 * テスト用のCampaign生成ファクトリ
 */
export function createCampaign(overrides?: Partial<Campaign>): Campaign {
  const currentId = campaignIdCounter++

  return {
    id: String(currentId),
    name: `Test Campaign ${currentId}`,
    message_template: `Hello {{name}}! Message ${currentId}`,
    status: 'draft',
    sent_at: null,
    created_at: new Date().toISOString(),
    ...overrides,
  }
}

/**
 * 複数のCampaignを生成
 */
export function createCampaigns(count: number, overrides?: Partial<Campaign>): Campaign[] {
  return Array.from({ length: count }, () => createCampaign(overrides))
}

/**
 * ファクトリのカウンターをリセット
 */
export function resetFixtureCounters() {
  contactIdCounter = 1
  smsLogIdCounter = 1
  campaignIdCounter = 1
}
