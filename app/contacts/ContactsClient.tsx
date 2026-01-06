'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import AppLayout from '@/components/AppLayout'
import { Button, Badge, Alert, Card } from '@/components/ui'
import { Table, TableHead, TableBody, Th, Td, Tr } from '@/components/ui'
import {
  Plus,
  Funnel,
  Prohibit,
  Play,
  Trash,
  Users
} from '@phosphor-icons/react'

interface Contact {
  id: string
  phone_number: string
  name: string | null
  tags: string[]
  opted_out: boolean
  created_at: string
}

export default function ContactsClient() {
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

  return (
    <AppLayout
      title="顧客管理"
      subtitle={`${contacts.length}件の顧客`}
      actions={
        <Link href="/contacts/import">
          <Button variant="primary" icon={<Plus className="w-4 h-4" />}>
            インポート
          </Button>
        </Link>
      }
    >
      <Card>
        {/* Filters */}
        <div className="px-4 py-3 border-b border-gray-150 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Funnel className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-600">フィルター:</span>
          </div>

          <select
            value={selectedTag}
            onChange={(e) => setSelectedTag(e.target.value)}
            className="px-2.5 py-1.5 text-sm border border-gray-300 rounded hover:border-gray-400 focus:border-accent-400 focus:ring-2 focus:ring-accent-400/20 focus:outline-none"
          >
            <option value="">すべてのタグ</option>
            {allTags.map(tag => (
              <option key={tag} value={tag}>{tag}</option>
            ))}
          </select>

          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={includeOptedOut}
              onChange={(e) => setIncludeOptedOut(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-accent-500 focus:ring-accent-400/20"
            />
            配信停止を含む
          </label>
        </div>

        {error && (
          <div className="p-4 border-b border-gray-150">
            <Alert variant="error">{error}</Alert>
          </div>
        )}

        {loading ? (
          <div className="py-12 text-center">
            <div className="spinner mx-auto mb-3" />
            <p className="text-sm text-gray-500">読み込み中...</p>
          </div>
        ) : contacts.length === 0 ? (
          <div className="py-12 text-center">
            <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500 mb-3">顧客がいません</p>
            <Link href="/contacts/import">
              <Button variant="secondary" size="sm" icon={<Plus className="w-4 h-4" />}>
                CSVインポート
              </Button>
            </Link>
          </div>
        ) : (
          <Table>
            <TableHead>
              <tr>
                <Th>電話番号</Th>
                <Th>名前</Th>
                <Th>タグ</Th>
                <Th>状態</Th>
                <Th>登録日</Th>
                <Th className="w-32">操作</Th>
              </tr>
            </TableHead>
            <TableBody>
              {contacts.map((contact) => (
                <Tr key={contact.id} className={contact.opted_out ? 'bg-gray-50/50' : ''}>
                  <Td mono>{contact.phone_number}</Td>
                  <Td className="text-gray-900">{contact.name || '-'}</Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      {contact.tags.map(tag => (
                        <Badge key={tag} variant="accent">{tag}</Badge>
                      ))}
                    </div>
                  </Td>
                  <Td>
                    {contact.opted_out ? (
                      <Badge variant="error">配信停止</Badge>
                    ) : (
                      <Badge variant="success">有効</Badge>
                    )}
                  </Td>
                  <Td className="text-xs text-gray-500">
                    {new Date(contact.created_at).toLocaleDateString('ja-JP')}
                  </Td>
                  <Td>
                    <div className="flex items-center gap-1">
                      {contact.opted_out ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOptOut(contact.id, false)}
                          icon={<Play className="w-4 h-4" />}
                          title="配信再開"
                        />
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOptOut(contact.id, true)}
                          icon={<Prohibit className="w-4 h-4" />}
                          title="配信停止"
                        />
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(contact.id)}
                        icon={<Trash className="w-4 h-4 text-error" />}
                        title="削除"
                      />
                    </div>
                  </Td>
                </Tr>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </AppLayout>
  )
}
