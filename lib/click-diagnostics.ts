export type ClickClassification = 'human_like' | 'suspected_automated' | 'unknown'

export interface ClickWithContext {
  id: string
  short_url_id: string
  clicked_at: string
  user_agent: string | null
  ip_address: string | null
  sec_fetch_site?: string | null
  sec_fetch_mode?: string | null
  sec_fetch_dest?: string | null
  sent_at: string | null
}

export interface ClassifiedClick {
  id: string
  short_url_id: string
  classification: ClickClassification
  reasons: string[]
}

const MOBILE_UA_PATTERN = /iPhone|iPad|Android/i

function secondsSinceSent(sentAt: string | null, clickedAt: string): number | null {
  if (!sentAt) return null
  return (new Date(clickedAt).getTime() - new Date(sentAt).getTime()) / 1000
}

export function classifyClicks(clicks: ClickWithContext[]): ClassifiedClick[] {
  return clicks.map(click => {
    // 1. モバイルUA + ブラウザヘッダ → human_like（時間不問）
    const isMobile = click.user_agent ? MOBILE_UA_PATTERN.test(click.user_agent) : false
    const hasBrowserHeaders = click.sec_fetch_mode === 'navigate' || click.sec_fetch_dest === 'document'
    if (isMobile && hasBrowserHeaders) {
      return { id: click.id, short_url_id: click.short_url_id, classification: 'human_like' as const, reasons: ['mobile_ua', 'browser_headers'] }
    }

    // 2. 送信30秒以内（かつ上でhuman判定されなかった） → suspected_automated
    const elapsed = secondsSinceSent(click.sent_at, click.clicked_at)
    if (elapsed !== null && elapsed < 30) {
      return { id: click.id, short_url_id: click.short_url_id, classification: 'suspected_automated' as const, reasons: ['quick_click'] }
    }

    // 3. 送信30秒以降 + モバイルUA → human_like
    if (elapsed !== null && isMobile) {
      return { id: click.id, short_url_id: click.short_url_id, classification: 'human_like' as const, reasons: ['mobile_ua', 'delayed_click'] }
    }

    // 4. それ以外（デスクトップUA/UA不明で30秒以降、sent_at不明など） → unknown
    return { id: click.id, short_url_id: click.short_url_id, classification: 'unknown' as const, reasons: [] }
  })
}
