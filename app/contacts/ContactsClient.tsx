'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Contact {
  id: string
  phone_number: string
  name: string | null
  tags: string[]
  opted_out: boolean
  created_at: string
}

export default function ContactsClient() {
  const router = useRouter()
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedTag, setSelectedTag] = useState('')
  const [includeOptedOut, setIncludeOptedOut] = useState(false)
  const [allTags, setAllTags] = useState<string[]>([])

  const fetchContacts = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (selectedTag) params.set('tag', selectedTag)
      if (includeOptedOut) params.set('includeOptedOut', 'true')

      const res = await fetch(`/api/contacts?${params}`)
      const data = await res.json()

      if (!res.ok) {
        setError(data.error)
        return
      }

      setContacts(data.contacts)

      // タグを収集
      const tags = new Set<string>()
      data.contacts.forEach((c: Contact) => c.tags.forEach(t => tags.add(t)))
      setAllTags(Array.from(tags).sort())
    } catch {
      setError('顧客の取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchContacts()
  }, [selectedTag, includeOptedOut])

  const handleOptOut = async (id: string, optOut: boolean) => {
    try {
      const res = await fetch('/api/contacts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          opted_out: optOut,
          opted_out_at: optOut ? new Date().toISOString() : null,
        }),
      })

      if (res.ok) {
        fetchContacts()
      }
    } catch {
      setError('更新に失敗しました')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('この顧客を削除しますか？')) return

    try {
      const res = await fetch(`/api/contacts?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        fetchContacts()
      }
    } catch {
      setError('削除に失敗しました')
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
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">顧客管理</h1>
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-sm text-blue-600 hover:text-blue-800">
              SMS送信
            </Link>
            <Link href="/contacts/import" className="text-sm text-blue-600 hover:text-blue-800">
              CSVインポート
            </Link>
            <Link href="/logs" className="text-sm text-blue-600 hover:text-blue-800">
              送信ログ
            </Link>
            <button onClick={handleLogout} className="text-sm text-gray-600 hover:text-gray-800">
              ログアウト
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-md p-6">
          {/* フィルター */}
          <div className="flex flex-wrap gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">タグ</label>
              <select
                value={selectedTag}
                onChange={(e) => setSelectedTag(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                <option value="">すべて</option>
                {allTags.map(tag => (
                  <option key={tag} value={tag}>{tag}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={includeOptedOut}
                  onChange={(e) => setIncludeOptedOut(e.target.checked)}
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-gray-700">配信停止を含む</span>
              </label>
            </div>
            <div className="flex-1" />
            <div className="flex items-end">
              <span className="text-sm text-gray-500">{contacts.length}件</span>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md text-red-700">
              {error}
            </div>
          )}

          {loading ? (
            <div className="text-center py-8 text-gray-500">読み込み中...</div>
          ) : contacts.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              顧客がいません。
              <Link href="/contacts/import" className="text-blue-600 hover:underline ml-1">
                CSVインポート
              </Link>
              から追加してください。
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">電話番号</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">名前</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">タグ</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">状態</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">登録日</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {contacts.map((contact) => (
                    <tr key={contact.id} className={contact.opted_out ? 'bg-gray-50' : ''}>
                      <td className="px-4 py-3 text-sm text-gray-900">{contact.phone_number}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{contact.name || '-'}</td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex flex-wrap gap-1">
                          {contact.tags.map(tag => (
                            <span key={tag} className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {contact.opted_out ? (
                          <span className="text-red-600">配信停止</span>
                        ) : (
                          <span className="text-green-600">有効</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {new Date(contact.created_at).toLocaleDateString('ja-JP')}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex gap-2">
                          {contact.opted_out ? (
                            <button
                              onClick={() => handleOptOut(contact.id, false)}
                              className="text-green-600 hover:text-green-800"
                            >
                              配信再開
                            </button>
                          ) : (
                            <button
                              onClick={() => handleOptOut(contact.id, true)}
                              className="text-orange-600 hover:text-orange-800"
                            >
                              配信停止
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(contact.id)}
                            className="text-red-600 hover:text-red-800"
                          >
                            削除
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
