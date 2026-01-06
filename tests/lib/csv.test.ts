import { describe, it, expect } from 'vitest'
import { parseCsv, replaceVariables, extractVariables } from '@/lib/csv'

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

describe('replaceVariables', () => {
  it('変数を置換できる', () => {
    const template = '{{名前}}様、こんにちは'
    const row = { 名前: '田中太郎' }

    const result = replaceVariables(template, row)

    expect(result).toBe('田中太郎様、こんにちは')
  })

  it('複数の変数を置換できる', () => {
    const template = '{{名前}}様、{{商品}}のご案内です'
    const row = { 名前: '田中太郎', 商品: 'ブランドバッグ' }

    const result = replaceVariables(template, row)

    expect(result).toBe('田中太郎様、ブランドバッグのご案内です')
  })

  it('存在しない変数はそのまま残す', () => {
    const template = '{{名前}}様、{{存在しない}}です'
    const row = { 名前: '田中太郎' }

    const result = replaceVariables(template, row)

    expect(result).toBe('田中太郎様、{{存在しない}}です')
  })

  it('英語の変数名も処理できる', () => {
    const template = 'Hello {{name}}'
    const row = { name: 'Tanaka' }

    const result = replaceVariables(template, row)

    expect(result).toBe('Hello Tanaka')
  })

  it('変数名の前後の空白を無視する', () => {
    const template = '{{ 名前 }}様'
    const row = { 名前: '田中太郎' }

    const result = replaceVariables(template, row)

    expect(result).toBe('田中太郎様')
  })
})

describe('extractVariables', () => {
  it('テンプレートから変数を抽出できる', () => {
    const template = '{{名前}}様、{{商品}}のご案内です'

    const result = extractVariables(template)

    expect(result).toEqual(['名前', '商品'])
  })

  it('重複する変数は1つにまとめる', () => {
    const template = '{{名前}}様、{{名前}}さんへ'

    const result = extractVariables(template)

    expect(result).toEqual(['名前'])
  })

  it('変数がない場合は空配列を返す', () => {
    const template = 'こんにちは'

    const result = extractVariables(template)

    expect(result).toEqual([])
  })
})
