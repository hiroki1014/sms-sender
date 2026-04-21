'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import AppLayout from '@/components/AppLayout'
import { Button, Alert, Card, CardBody } from '@/components/ui'
import { Table, TableHead, TableBody, Th, Td, Tr } from '@/components/ui'
import { parseCsv } from '@/lib/csv'
import { FileArrowUp, Phone, User, Tag, CaretDown, ArrowRight } from '@phosphor-icons/react'

export default function ImportClient() {
  const [csvText, setCsvText] = useState('')
  const [phoneField, setPhoneField] = useState('')
  const [nameField, setNameField] = useState('')
  const [urlField, setUrlField] = useState('')
  const [genderField, setGenderField] = useState('')
  const [listTypeField, setListTypeField] = useState('')
  const [statusField, setStatusField] = useState('')
  const [prefectureField, setPrefectureField] = useState('')
  const [notesField, setNotesField] = useState('')
  const [tags, setTags] = useState('')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ added: number; updated?: number; duplicates: number } | null>(null)
  const [error, setError] = useState('')

  const parsed = useMemo(() => parseCsv(csvText), [csvText])

  // フィールド自動検出
  useMemo(() => {
    if (parsed.headers.length === 0) return
    const detect = (current: string, keywords: string[]) => {
      if (current) return
      return parsed.headers.find(h => keywords.some(k => h === k || h.toLowerCase() === k.toLowerCase())) || ''
    }
    if (!phoneField) {
      const found = parsed.headers.find(
        h => h.includes('電話') || h.toLowerCase().includes('phone') || h.toLowerCase().includes('tel')
      )
      setPhoneField(found || parsed.headers[0])
    }
    const trySet = (setter: (v: string) => void, current: string, keywords: string[]) => {
      const v = detect(current, keywords)
      if (v !== undefined) setter(v)
    }
    trySet(setNameField, nameField, ['名前', '氏名', 'お名前', '顧客名', 'name'])
    trySet(setUrlField, urlField, ['URL', 'url', 'ショップURL', 'サイトURL'])
    trySet(setGenderField, genderField, ['性別', 'gender'])
    trySet(setListTypeField, listTypeField, ['リスト種別', '種別', 'list_type'])
    trySet(setStatusField, statusField, ['ステータス', 'status'])
    trySet(setPrefectureField, prefectureField, ['都道府県', 'prefecture'])
    trySet(setNotesField, notesField, ['備考', 'メモ', 'notes', '備考（SMS）'])
  }, [parsed.headers, phoneField, nameField, urlField, genderField, listTypeField, statusField, prefectureField, notesField])

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
        url: urlField ? row[urlField] || null : null,
        gender: genderField ? row[genderField] || null : null,
        list_type: listTypeField ? row[listTypeField] || null : null,
        status: statusField ? row[statusField] || null : null,
        prefecture: prefectureField ? row[prefectureField] || null : null,
        notes: notesField ? row[notesField] || null : null,
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

  return (
    <AppLayout
      title="CSVインポート"
      subtitle="顧客データを一括インポート"
    >
      <div className="max-w-3xl space-y-6">
        <Card>
          <CardBody className="space-y-6">
            {/* CSV入力 */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <FileArrowUp className="w-4 h-4 text-gray-400" />
                CSVデータ
              </label>
              <div className="flex items-center gap-3">
                <label className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded cursor-pointer hover:border-gray-400 hover:bg-gray-50 transition-all duration-150">
                  ファイルを選択
                  <input
                    type="file"
                    accept=".csv,.tsv,.txt"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      const reader = new FileReader()
                      reader.onload = (ev) => {
                        const text = ev.target?.result
                        if (typeof text === 'string') setCsvText(text)
                      }
                      reader.readAsText(file, 'UTF-8')
                      e.target.value = ''
                    }}
                  />
                </label>
                <span className="text-xs text-gray-500">または下のテキストエリアに直接貼り付け</span>
              </div>
              <textarea
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                className="w-full h-44 px-3 py-2.5 text-xs font-mono bg-white border border-gray-300 rounded transition-all duration-150 placeholder:text-gray-400 hover:border-gray-400 focus:border-accent-400 focus:ring-2 focus:ring-accent-400/20 focus:outline-none resize-none"
                placeholder={`電話番号,名前
09012345678,田中太郎
09087654321,山田花子`}
              />
              <p className="text-xs text-gray-500">
                1行目はヘッダー行です。CSV・TSV形式に対応。
              </p>
            </div>

            {/* フィールドマッピング */}
            {parsed.headers.length > 0 && (
              <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Phone className="w-4 h-4 text-gray-400" />
                    電話番号の列 <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={phoneField}
                      onChange={(e) => setPhoneField(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded appearance-none cursor-pointer pr-8 transition-all duration-150 hover:border-gray-400 focus:border-accent-400 focus:ring-2 focus:ring-accent-400/20 focus:outline-none"
                    >
                      {parsed.headers.map((header) => (
                        <option key={header} value={header}>{header}</option>
                      ))}
                    </select>
                    <CaretDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <User className="w-4 h-4 text-gray-400" />
                    名前の列（任意）
                  </label>
                  <div className="relative">
                    <select
                      value={nameField}
                      onChange={(e) => setNameField(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded appearance-none cursor-pointer pr-8 transition-all duration-150 hover:border-gray-400 focus:border-accent-400 focus:ring-2 focus:ring-accent-400/20 focus:outline-none"
                    >
                      <option value="">なし</option>
                      {parsed.headers.map((header) => (
                        <option key={header} value={header}>{header}</option>
                      ))}
                    </select>
                    <CaretDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: 'URL', value: urlField, setter: setUrlField },
                  { label: '性別', value: genderField, setter: setGenderField },
                  { label: 'リスト種別', value: listTypeField, setter: setListTypeField },
                  { label: 'ステータス', value: statusField, setter: setStatusField },
                  { label: '都道府県', value: prefectureField, setter: setPrefectureField },
                  { label: 'メモ', value: notesField, setter: setNotesField },
                ].map(({ label, value, setter }) => (
                  <div key={label} className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-600">{label}</label>
                    <div className="relative">
                      <select
                        value={value}
                        onChange={(e) => setter(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-sm bg-white border border-gray-300 rounded appearance-none cursor-pointer pr-7 hover:border-gray-400 focus:border-accent-400 focus:ring-2 focus:ring-accent-400/20 focus:outline-none"
                      >
                        <option value="">なし</option>
                        {parsed.headers.map((header) => (
                          <option key={header} value={header}>{header}</option>
                        ))}
                      </select>
                      <CaretDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                ))}
              </div>
              </>
            )}

            {/* タグ */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Tag className="w-4 h-4 text-gray-400" />
                タグ（カンマ区切り）
              </label>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded transition-all duration-150 placeholder:text-gray-400 hover:border-gray-400 focus:border-accent-400 focus:ring-2 focus:ring-accent-400/20 focus:outline-none"
                placeholder="base, 新規"
              />
              <p className="text-xs text-gray-500">
                例: base, yahoo, rakuten など。インポートする全員に同じタグが付きます。
              </p>
            </div>
          </CardBody>
        </Card>

        {/* プレビュー */}
        {parsed.rows.length > 0 && (
          <Card>
            <div className="px-4 py-3 border-b border-gray-150">
              <h3 className="text-sm font-medium text-gray-700">
                プレビュー（先頭5件 / 合計 {parsed.rows.length}件）
              </h3>
            </div>
            <Table>
              <TableHead>
                <tr>
                  <Th>電話番号</Th>
                  <Th>名前</Th>
                </tr>
              </TableHead>
              <TableBody>
                {parsed.rows.slice(0, 5).map((row, i) => (
                  <Tr key={i}>
                    <Td mono>{row[phoneField] || '-'}</Td>
                    <Td>{nameField ? (row[nameField] || '-') : '-'}</Td>
                  </Tr>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}

        {/* エラー */}
        {error && <Alert variant="error">{error}</Alert>}

        {/* 結果 */}
        {result && (
          <Alert variant="success" title="インポート完了">
            <div className="space-y-2">
              <p>追加: {result.added}件{result.updated ? ` / 更新: ${result.updated}件` : ''} / スキップ: {result.duplicates}件</p>
              <Link href="/contacts" className="text-success-dark hover:underline inline-flex items-center gap-1">
                顧客一覧を見る <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </Alert>
        )}

        {/* ボタン */}
        <div className="flex gap-3">
          <Link href="/contacts" className="flex-1">
            <Button variant="secondary" className="w-full">
              キャンセル
            </Button>
          </Link>
          <Button
            variant="primary"
            onClick={handleImport}
            disabled={importing || parsed.rows.length === 0}
            loading={importing}
            icon={<FileArrowUp className="w-4 h-4" />}
            className="flex-1"
          >
            {importing ? 'インポート中...' : `${parsed.rows.length}件をインポート`}
          </Button>
        </div>
      </div>
    </AppLayout>
  )
}
