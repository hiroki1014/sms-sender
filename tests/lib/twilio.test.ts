import { describe, it, expect } from 'vitest'
import { normalizePhoneNumber, validatePhoneNumber } from '@/lib/twilio'

describe('normalizePhoneNumber', () => {
  it('090から始まる番号を+81形式に変換', () => {
    expect(normalizePhoneNumber('09012345678')).toBe('+819012345678')
  })

  it('080から始まる番号を+81形式に変換', () => {
    expect(normalizePhoneNumber('08012345678')).toBe('+818012345678')
  })

  it('070から始まる番号を+81形式に変換', () => {
    expect(normalizePhoneNumber('07012345678')).toBe('+817012345678')
  })

  it('ハイフン入りの番号を処理できる', () => {
    expect(normalizePhoneNumber('090-1234-5678')).toBe('+819012345678')
  })

  it('スペース入りの番号を処理できる', () => {
    expect(normalizePhoneNumber('090 1234 5678')).toBe('+819012345678')
  })

  it('既に81で始まる番号に+を付ける', () => {
    expect(normalizePhoneNumber('819012345678')).toBe('+819012345678')
  })

  it('既に+81で始まる番号はそのまま', () => {
    expect(normalizePhoneNumber('+819012345678')).toBe('+819012345678')
  })
})

describe('validatePhoneNumber', () => {
  it('有効な090番号を受け入れる', () => {
    expect(validatePhoneNumber('09012345678')).toBe(true)
  })

  it('有効な080番号を受け入れる', () => {
    expect(validatePhoneNumber('08012345678')).toBe(true)
  })

  it('有効な070番号を受け入れる', () => {
    expect(validatePhoneNumber('07012345678')).toBe(true)
  })

  it('ハイフン入りの番号を受け入れる', () => {
    expect(validatePhoneNumber('090-1234-5678')).toBe(true)
  })

  it('桁数が足りない番号を拒否する', () => {
    expect(validatePhoneNumber('0901234567')).toBe(false)
  })

  it('桁数が多い番号を拒否する', () => {
    expect(validatePhoneNumber('090123456789')).toBe(false)
  })

  it('固定電話番号を拒否する', () => {
    expect(validatePhoneNumber('0312345678')).toBe(false)
  })

  it('060番号を拒否する', () => {
    expect(validatePhoneNumber('06012345678')).toBe(false)
  })

  it('空文字を拒否する', () => {
    expect(validatePhoneNumber('')).toBe(false)
  })
})
