'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { parseCsv } from '@/lib/csv'

export default function ImportClient() {
  const router = useRouter()
  const [csvText, setCsvText] = useState('')
  const [phoneField, setPhoneField] = useState('')
  const [nameField, setNameField] = useState('')
  const [tags, setTags] = useState('')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ added: number; duplicates: number } | null>(null)
  const [error, setError] = useState('')

  const parsed = useMemo(() => parseCsv(csvText), [csvText])

  // フィールド自動検出
  useMemo(() => {
    if (parsed.headers.length > 0) {
      if (!phoneField) {
        const phone = parsed.headers.find(
          h => h.includes('電話') || h.toLowerCase().includes('phone') || h.toLowerCase().includes('tel')
        )
        setPhoneField(phone || parsed.headers[0])
      }
      if (!nameField) {
        const name = parsed.headers.find(
          h => h.includes('名前') || h.includes('氏名') || h.toLowerCase().includes('name')
        )
        setNameField(name || '')
      }
    }
  }, [parsed.headers, phoneField, nameField])

  const handleImport = async () => {
    setError('')
    setResult(null)
    setImporting(true)

    try {
      const tagList = tags.split(',').map(t => t.trim()).filter(Boolean)

      const contacts = parsed.rows.map(row => ({
        phone_number: row[phoneField],
        name: nameField ? row[nameField] : null,
        tags: tagList,
      })).filter(c => c.phone_number)

      if (contacts.length === 0) {
        setError('インポートする顧客がありません')
        setImporting(false)
        return
      }

      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contacts }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error)
        return
      }

      setResult({ added: data.added, duplicates: data.duplicates })
    } catch {
      setError('インポートに失敗しました')
    } finally {
      setImporting(false)
    }
  }

  const handleLogout = async () => {
    await fetch('/api/auth', { method: 'DELETE' })
    router.push('/')
    router.refresh()
  }

  return (
    <div className="min-h-screen">
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">CSVインポート</h1>
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-sm text-blue-600 hover:text-blue-800">
              SMS送信
            </Link>
            <Link href="/contacts" className="text-sm text-blue-600 hover:text-blue-800">
              顧客一覧
            </Link>
            <button onClick={handleLogout} className="text-sm text-gray-600 hover:text-gray-800">
              ログアウト
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-md p-6 space-y-6">
          {/* CSV入力 */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              CSVデータ
            </label>
            <textarea
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              className="w-full h-48 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
              placeholder={`電話番号,名前
09012345678,田中太郎
09087654321,山田花子`}
            />
            <p className="text-xs text-gray-500">
              ※1行目はヘッダー行です。電話番号は090/080/070形式で入力してください。
            </p>
          </div>

          {/* フィールドマッピング */}
          {parsed.headers.length > 0 && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  電話番号の列 <span className="text-red-500">*</span>
                </label>
                <select
                  value={phoneField}
                  onChange={(e) => setPhoneField(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  {parsed.headers.map((header) => (
                    <option key={header} value={header}>{header}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  名前の列（任意）
                </label>
                <select
                  value={nameField}
                  onChange={(e) => setNameField(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">なし</option>
                  {parsed.headers.map((header) => (
                    <option key={header} value={header}>{header}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* タグ */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              タグ（カンマ区切り）
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="base, 新規"
            />
            <p className="text-xs text-gray-500">
              例: base, yahoo, rakuten など。インポートする全員に同じタグが付きます。
            </p>
          </div>

          {/* プレビュー */}
          {parsed.rows.length > 0 && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                プレビュー（先頭5件）
              </label>
              <div className="overflow-x-auto border border-gray-200 rounded-md">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">電話番号</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">名前</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {parsed.rows.slice(0, 5).map((row, i) => (
                      <tr key={i}>
                        <td className="px-4 py-2 text-sm">{row[phoneField] || '-'}</td>
                        <td className="px-4 py-2 text-sm">{nameField ? (row[nameField] || '-') : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-sm text-gray-600">
                合計: {parsed.rows.length}件
              </p>
            </div>
          )}

          {/* エラー */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-md text-red-700">
              {error}
            </div>
          )}

          {/* 結果 */}
          {result && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-md">
              <h3 className="font-medium text-green-800">インポート完了</h3>
              <p className="text-sm text-green-700 mt-1">
                追加: {result.added}件 / 重複スキップ: {result.duplicates}件
              </p>
              <Link href="/contacts" className="text-sm text-green-600 hover:underline mt-2 inline-block">
                顧客一覧を見る →
              </Link>
            </div>
          )}

          {/* ボタン */}
          <div className="flex gap-4">
            <Link
              href="/contacts"
              className="flex-1 py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 text-center"
            >
              キャンセル
            </Link>
            <button
              onClick={handleImport}
              disabled={importing || parsed.rows.length === 0}
              className="flex-1 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {importing ? 'インポート中...' : `${parsed.rows.length}件をインポート`}
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
