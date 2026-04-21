const URL_REGEX = /https?:\/\/[^\s]+/g

export function getShortUrlLength(): number {
  const base = (process.env.NEXT_PUBLIC_SHORT_URL_BASE || '').replace(/\/$/, '')
  if (!base) return 11
  return base.length + 3 + 6
}

export function computeEffectiveLength(text: string): { raw: number; effective: number; urlCount: number } {
  const urls = text.match(URL_REGEX) || []
  const shortLen = getShortUrlLength()
  let effective = text.length
  for (const url of urls) {
    effective = effective - url.length + shortLen
  }
  return { raw: text.length, effective, urlCount: urls.length }
}

export function estimateSegments(charCount: number, hasNonAscii: boolean): { segments: number; encoding: 'GSM-7' | 'UCS-2'; limit: number } {
  if (charCount === 0) return { segments: 0, encoding: 'GSM-7', limit: 160 }
  if (!hasNonAscii) {
    if (charCount <= 160) return { segments: 1, encoding: 'GSM-7', limit: 160 }
    return { segments: Math.ceil(charCount / 153), encoding: 'GSM-7', limit: 160 }
  }
  if (charCount <= 70) return { segments: 1, encoding: 'UCS-2', limit: 70 }
  return { segments: Math.ceil(charCount / 67), encoding: 'UCS-2', limit: 70 }
}

// 短縮URL置換後のテキストからセグメント情報を取得
export function estimateSegmentsFromTemplate(text: string): { segments: number; encoding: 'GSM-7' | 'UCS-2'; limit: number; effective: number } {
  const shortLen = getShortUrlLength()
  const replaced = text.replace(URL_REGEX, 'x'.repeat(shortLen))
  // eslint-disable-next-line no-control-regex
  const hasNonAscii = /[^\x00-\x7F]/.test(replaced)
  const { effective } = computeEffectiveLength(text)
  const seg = estimateSegments(effective, hasNonAscii)
  return { ...seg, effective }
}

export function estimateCost(segments: number, recipientCount: number, perSegmentCost: number): number {
  return Math.round(segments * recipientCount * perSegmentCost)
}
