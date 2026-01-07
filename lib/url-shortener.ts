import { nanoid } from 'nanoid'
import { getSupabase, ShortUrl } from './supabase'

// URL検出用の正規表現
const URL_REGEX = /https?:\/\/[^\s]+/g

// 短縮URLのベースURL（環境変数から取得、未設定の場合はカレントドメインを使用）
function getShortUrlBase(): string {
  return process.env.SHORT_URL_BASE || ''
}

// メッセージ内のURLを全て抽出
export function extractUrls(message: string): string[] {
  return message.match(URL_REGEX) || []
}

// ユニークな短縮コードを生成（8文字）
export function generateShortCode(): string {
  return nanoid(8)
}

// 短縮URLを生成して保存
export async function createShortUrl(params: {
  originalUrl: string
  contactId?: string | null
  campaignId?: string | null
}): Promise<ShortUrl> {
  const supabase = getSupabase()
  const code = generateShortCode()

  const shortUrl: Omit<ShortUrl, 'id' | 'created_at'> = {
    code,
    original_url: params.originalUrl,
    contact_id: params.contactId || null,
    campaign_id: params.campaignId || null,
  }

  const { data, error } = await supabase
    .from('short_urls')
    .insert([shortUrl])
    .select()
    .single()

  if (error) {
    console.error('Failed to create short URL:', error)
    throw error
  }

  return data
}

// 短縮URLをsms_log_idと紐付け
export async function linkShortUrlToSmsLog(shortUrlId: string, smsLogId: string): Promise<void> {
  const supabase = getSupabase()

  const { error } = await supabase
    .from('short_urls')
    .update({ sms_log_id: smsLogId })
    .eq('id', shortUrlId)

  if (error) {
    console.error('Failed to link short URL to SMS log:', error)
    throw error
  }
}

// メッセージ内のURLを短縮URLに置換
export async function replaceUrlsWithShortUrls(params: {
  message: string
  contactId?: string | null
  campaignId?: string | null
}): Promise<{
  processedMessage: string
  shortUrls: ShortUrl[]
}> {
  const urls = extractUrls(params.message)

  if (urls.length === 0) {
    return { processedMessage: params.message, shortUrls: [] }
  }

  const shortUrls: ShortUrl[] = []
  let processedMessage = params.message
  const baseUrl = getShortUrlBase()

  for (const originalUrl of urls) {
    const shortUrl = await createShortUrl({
      originalUrl,
      contactId: params.contactId,
      campaignId: params.campaignId,
    })
    shortUrls.push(shortUrl)

    // 元のURLを短縮URLに置換
    const fullShortUrl = baseUrl ? `${baseUrl}/r/${shortUrl.code}` : `/r/${shortUrl.code}`
    processedMessage = processedMessage.replace(originalUrl, fullShortUrl)
  }

  return { processedMessage, shortUrls }
}

// codeから短縮URL情報を取得
export async function getShortUrlByCode(code: string): Promise<ShortUrl | null> {
  const supabase = getSupabase()

  const { data, error } = await supabase
    .from('short_urls')
    .select('*')
    .eq('code', code)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      // Not found
      return null
    }
    console.error('Failed to get short URL:', error)
    throw error
  }

  return data
}

// クリックを記録
export async function recordClick(params: {
  shortUrlId: string
  userAgent?: string | null
  ipAddress?: string | null
}): Promise<void> {
  const supabase = getSupabase()

  const { error } = await supabase
    .from('click_logs')
    .insert([{
      short_url_id: params.shortUrlId,
      user_agent: params.userAgent || null,
      ip_address: params.ipAddress || null,
    }])

  if (error) {
    console.error('Failed to record click:', error)
    throw error
  }
}
