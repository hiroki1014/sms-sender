'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import CsvInput from '@/components/CsvInput'
import TemplateEditor from '@/components/TemplateEditor'
import CountSlider from '@/components/CountSlider'
import Preview from '@/components/Preview'
import { parseCsv, replaceVariables } from '@/lib/csv'

interface SendResult {
  total: number
  success: number
  failed: number
}

export default function DashboardClient() {
  const router = useRouter()
  const [csvText, setCsvText] = useState('')
  const [template, setTemplate] = useState('')
  const [count, setCount] = useState(1)
  const [phoneField, setPhoneField] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [result, setResult] = useState<SendResult | null>(null)
  const [error, setError] = useState('')

  const parsed = useMemo(() => parseCsv(csvText), [csvText])

  // CSVが変更されたら電話番号フィールドを自動検出
  useMemo(() => {
    if (parsed.headers.length > 0 && !phoneField) {
      // 「電話」「phone」「tel」を含むヘッダーを探す
      const phoneHeader = parsed.headers.find(
        (h) =>
          h.includes('電話') ||
          h.toLowerCase().includes('phone') ||
          h.toLowerCase().includes('tel')
      )
      if (phoneHeader) {
        setPhoneField(phoneHeader)
      } else {
        // 見つからなければ最初の列
        setPhoneField(parsed.headers[0])
      }
    }
  }, [parsed.headers, phoneField])

  // 送信件数の上限をCSVの行数に合わせる
  useMemo(() => {
    if (parsed.rows.length > 0 && count > parsed.rows.length) {
      setCount(parsed.rows.length)
    } else if (parsed.rows.length > 0 && count === 0) {
      setCount(1)
    }
  }, [parsed.rows.length, count])

  const handleLogout = async () => {
    await fetch('/api/auth', { method: 'DELETE' })
    router.push('/')
    router.refresh()
  }

  const handleSend = async (dryRun: boolean = false) => {
    setError('')
    setResult(null)
    setIsSending(true)

    try {
      const recipients = parsed.rows.slice(0, count).map((row) => ({
        phone: row[phoneField],
        message: replaceVariables(template, row),
      }))

      const res = await fetch('/api/send-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipients, dryRun }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || '送信に失敗しました')
        return
      }

      setResult({
        total: data.total,
        success: data.success,
        failed: data.failed,
      })
    } catch {
      setError('エラーが発生しました')
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="min-h-screen">
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">SMS一括送信</h1>
          <div className="flex items-center gap-4">
            <Link
              href="/contacts"
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              顧客管理
            </Link>
            <Link
              href="/logs"
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              送信ログ
            </Link>
            <button
              onClick={handleLogout}
              className="text-sm text-gray-600 hover:text-gray-800"
            >
              ログアウト
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-md p-6 space-y-6">
          <CsvInput value={csvText} onChange={setCsvText} />

          {parsed.headers.length > 0 && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                電話番号の列
              </label>
              <select
                value={phoneField}
                onChange={(e) => setPhoneField(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                {parsed.headers.map((header) => (
                  <option key={header} value={header}>
                    {header}
                  </option>
                ))}
              </select>
            </div>
          )}

          <TemplateEditor
            value={template}
            onChange={setTemplate}
            availableVariables={parsed.headers}
          />

          <CountSlider
            value={count}
            onChange={setCount}
            max={parsed.rows.length}
          />

          <Preview
            rows={parsed.rows}
            template={template}
            count={count}
            phoneField={phoneField}
          />

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-md text-red-700">
              {error}
            </div>
          )}

          {result && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-md">
              <h3 className="font-medium text-green-800">送信完了</h3>
              <p className="text-sm text-green-700 mt-1">
                成功: {result.success}件 / 失敗: {result.failed}件 / 合計:{' '}
                {result.total}件
              </p>
            </div>
          )}

          <div className="flex gap-4">
            <button
              onClick={() => handleSend(true)}
              disabled={isSending || parsed.rows.length === 0 || !template}
              className="flex-1 py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSending ? '処理中...' : 'テスト送信（実際には送信しない）'}
            </button>
            <button
              onClick={() => handleSend(false)}
              disabled={isSending || parsed.rows.length === 0 || !template}
              className="flex-1 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSending ? '送信中...' : `${count}件を送信`}
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
