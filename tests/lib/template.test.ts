import { describe, it, expect } from 'vitest'
import { replaceVariables, extractVariables } from '@/lib/template'

describe('replaceVariables', () => {
  it('変数を置換できる', () => {
    const template = '{{名前}}様、こんにちは'
    const variables = { 名前: '田中太郎' }

    const result = replaceVariables(template, variables)

    expect(result).toBe('田中太郎様、こんにちは')
  })

  it('複数の変数を置換できる', () => {
    const template = '{{名前}}様、{{商品}}のご案内です'
    const variables = { 名前: '田中太郎', 商品: 'ブランドバッグ' }

    const result = replaceVariables(template, variables)

    expect(result).toBe('田中太郎様、ブランドバッグのご案内です')
  })

  it('存在しない変数はそのまま残す', () => {
    const template = '{{名前}}様、{{存在しない}}です'
    const variables = { 名前: '田中太郎' }

    const result = replaceVariables(template, variables)

    expect(result).toBe('田中太郎様、{{存在しない}}です')
  })

  it('英語の変数名も処理できる', () => {
    const template = 'Hello {{name}}'
    const variables = { name: 'Tanaka' }

    const result = replaceVariables(template, variables)

    expect(result).toBe('Hello Tanaka')
  })

  it('変数名の前後の空白を無視する', () => {
    const template = '{{ 名前 }}様'
    const variables = { 名前: '田中太郎' }

    const result = replaceVariables(template, variables)

    expect(result).toBe('田中太郎様')
  })

  it('空の変数オブジェクトでも動作する', () => {
    const template = '{{名前}}様'
    const variables = {}

    const result = replaceVariables(template, variables)

    expect(result).toBe('{{名前}}様')
  })

  it('変数のない文字列はそのまま返す', () => {
    const template = 'こんにちは'
    const variables = { 名前: '田中' }

    const result = replaceVariables(template, variables)

    expect(result).toBe('こんにちは')
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

  it('空白を含む変数名をトリムする', () => {
    const template = '{{ 名前 }}様'

    const result = extractVariables(template)

    expect(result).toEqual(['名前'])
  })
})
