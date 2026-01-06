import { describe, it, expect } from 'vitest'
import { parseCsv } from '@/lib/csv'

describe('parseCsv', () => {
  it('シンプルなCSVをパースできる', () => {
    const csv = `電話番号,名前
09012345678,田中太郎
09087654321,山田花子`

    const result = parseCsv(csv)

    expect(result.headers).toEqual(['電話番号', '名前'])
    expect(result.rows).toHaveLength(2)
    expect(result.rows[0]).toEqual({ 電話番号: '09012345678', 名前: '田中太郎' })
    expect(result.rows[1]).toEqual({ 電話番号: '09087654321', 名前: '山田花子' })
  })

  it('空のCSVを処理できる', () => {
    const result = parseCsv('')
    expect(result.headers).toEqual([])
    expect(result.rows).toEqual([])
  })

  it('ヘッダーのみのCSVを処理できる', () => {
    const csv = '電話番号,名前'
    const result = parseCsv(csv)

    expect(result.headers).toEqual(['電話番号', '名前'])
    expect(result.rows).toEqual([])
  })

  it('ダブルクォートで囲まれた値を処理できる', () => {
    const csv = `名前,住所
"田中太郎","東京都渋谷区"`

    const result = parseCsv(csv)

    expect(result.rows[0]).toEqual({ 名前: '田中太郎', 住所: '東京都渋谷区' })
  })

  it('カンマを含む値を処理できる', () => {
    const csv = `名前,住所
"田中, 太郎","東京都"`

    const result = parseCsv(csv)

    expect(result.rows[0].名前).toBe('田中, 太郎')
  })

  it('空行をスキップする', () => {
    const csv = `電話番号,名前
09012345678,田中

09087654321,山田`

    const result = parseCsv(csv)

    expect(result.rows).toHaveLength(2)
  })
})
