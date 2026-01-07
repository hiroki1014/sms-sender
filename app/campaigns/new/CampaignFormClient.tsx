'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import AppLayout from '@/components/AppLayout'
import CsvInput from '@/components/CsvInput'
import TemplateEditor from '@/components/TemplateEditor'
import CountSlider from '@/components/CountSlider'
import Preview from '@/components/Preview'
import { Button, Alert, Card, CardBody, Badge } from '@/components/ui'
import { parseCsv } from '@/lib/csv'
import { replaceVariables } from '@/lib/template'
import {
  PaperPlaneTilt,
  Flask,
  Phone,
  CaretDown,
  FloppyDisk,
  Users,
  FileText,
  Funnel
} from '@phosphor-icons/react'

interface Contact {
  id: string
  phone_number: string
  name: string | null
  tags: string[]
}

interface SendResult {
  total: number
  success: number
  failed: number
}

type SourceType = 'csv' | 'contacts'

export default function CampaignFormClient() {
  const router = useRouter()

  // Campaign info
  const [campaignName, setCampaignName] = useState('')

  // Source selection
  const [sourceType, setSourceType] = useState<SourceType>('contacts')

  // CSV mode state
  const [csvText, setCsvText] = useState('')
  const [phoneField, setPhoneField] = useState('')

  // Contacts mode state
  const [contacts, setContacts] = useState<Contact[]>([])
  const [allTags, setAllTags] = useState<string[]>([])
  const [selectedTag, setSelectedTag] = useState('')
  const [contactsLoading, setContactsLoading] = useState(false)

  // Shared state
  const [template, setTemplate] = useState('')
  const [count, setCount] = useState(1)
  const [isSending, setIsSending] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [result, setResult] = useState<SendResult | null>(null)
  const [error, setError] = useState('')

  // CSV parsing
  const parsed = useMemo(() => parseCsv(csvText), [csvText])

  // Auto-detect phone field for CSV
  useMemo(() => {
    if (parsed.headers.length > 0 && !phoneField) {
      const phoneHeader = parsed.headers.find(
        (h) =>
          h.includes('電話') ||
          h.toLowerCase().includes('phone') ||
          h.toLowerCase().includes('tel')
      )
      setPhoneField(phoneHeader || parsed.headers[0])
    }
  }, [parsed.headers, phoneField])

  // Fetch contacts
  const fetchContacts = async () => {
    setContactsLoading(true)
    try {
      const params = new URLSearchParams()
      if (selectedTag) params.set('tag', selectedTag)

      const res = await fetch(`/api/contacts?${params}`)
      const data = await res.json()

      if (res.ok) {
        setContacts(data.contacts)

        // Extract all tags
        const tags = new Set<string>()
        data.contacts.forEach((c: Contact) => c.tags.forEach(t => tags.add(t)))
        setAllTags(Array.from(tags).sort())
      }
    } catch {
      setError('顧客の取得に失敗しました')
    } finally {
      setContactsLoading(false)
    }
  }

  useEffect(() => {
    if (sourceType === 'contacts') {
      fetchContacts()
    }
  }, [sourceType, selectedTag])

  // Calculate recipients based on source type
  const recipients = useMemo(() => {
    if (sourceType === 'csv') {
      return parsed.rows.slice(0, count).map((row) => ({
        phone: row[phoneField],
        message: replaceVariables(template, row),
      }))
    } else {
      return contacts.slice(0, count).map((contact) => ({
        phone: contact.phone_number,
        message: replaceVariables(template, {
          name: contact.name || '',
          phone: contact.phone_number,
        }),
        contact_id: contact.id,
      }))
    }
  }, [sourceType, parsed.rows, contacts, count, phoneField, template])

  // Available variables for template
  const availableVariables = useMemo(() => {
    if (sourceType === 'csv') {
      return parsed.headers
    }
    return ['name', 'phone']
  }, [sourceType, parsed.headers])

  // Preview rows
  const previewRows = useMemo(() => {
    if (sourceType === 'csv') {
      return parsed.rows
    }
    return contacts.map(c => ({
      name: c.name || '',
      phone: c.phone_number,
    }))
  }, [sourceType, parsed.rows, contacts])

  // Max count
  const maxCount = sourceType === 'csv' ? parsed.rows.length : contacts.length

  // Adjust count when source changes
  useEffect(() => {
    if (maxCount > 0 && count > maxCount) {
      setCount(maxCount)
    } else if (maxCount > 0 && count === 0) {
      setCount(1)
    }
  }, [maxCount, count])

  // Can send check
  const canSend = campaignName.trim().length > 0 && maxCount > 0 && template.trim().length > 0

  // Save draft
  const handleSaveDraft = async () => {
    if (!campaignName.trim()) {
      setError('キャンペーン名を入力してください')
      return
    }

    setIsSaving(true)
    setError('')

    try {
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: campaignName,
          message_template: template,
          status: 'draft',
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || '保存に失敗しました')
        return
      }

      router.push('/campaigns')
    } catch {
      setError('保存に失敗しました')
    } finally {
      setIsSaving(false)
    }
  }

  // Send SMS
  const handleSend = async (dryRun: boolean = false) => {
    if (!campaignName.trim()) {
      setError('キャンペーン名を入力してください')
      return
    }

    setError('')
    setResult(null)
    setIsSending(true)

    try {
      // Create campaign first (if not dry run)
      let campaignId: string | undefined

      if (!dryRun) {
        const campaignRes = await fetch('/api/campaigns', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: campaignName,
            message_template: template,
            status: 'sent',
            sent_at: new Date().toISOString(),
          }),
        })

        if (!campaignRes.ok) {
          const data = await campaignRes.json()
          setError(data.error || 'キャンペーンの作成に失敗しました')
          return
        }

        const campaignData = await campaignRes.json()
        campaignId = campaignData.campaign.id
      }

      // Send SMS
      const res = await fetch('/api/send-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipients,
          dryRun,
          campaignId,
        }),
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

      if (!dryRun) {
        // Redirect to campaigns list after successful send
        setTimeout(() => {
          router.push('/campaigns')
        }, 2000)
      }
    } catch {
      setError('エラーが発生しました')
    } finally {
      setIsSending(false)
    }
  }

  return (
    <AppLayout
      title="キャンペーン作成"
      subtitle="新しいSMSキャンペーンを作成"
    >
      <div className="max-w-3xl space-y-6">
        {/* Campaign Name */}
        <Card>
          <CardBody className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">
                キャンペーン名
              </label>
              <input
                type="text"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                placeholder="例: 2025年1月_新規募集"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded transition-all duration-150 hover:border-gray-400 focus:border-accent-400 focus:ring-2 focus:ring-accent-400/20 focus:outline-none"
              />
            </div>
          </CardBody>
        </Card>

        {/* Source Selection */}
        <Card>
          <CardBody className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">
                送信先の選択
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setSourceType('contacts')}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded border transition-all ${
                    sourceType === 'contacts'
                      ? 'border-accent-400 bg-accent-50 text-accent-700'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <Users className="w-5 h-5" />
                  <span className="text-sm font-medium">顧客リストから</span>
                </button>
                <button
                  onClick={() => setSourceType('csv')}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded border transition-all ${
                    sourceType === 'csv'
                      ? 'border-accent-400 bg-accent-50 text-accent-700'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <FileText className="w-5 h-5" />
                  <span className="text-sm font-medium">CSV入力</span>
                </button>
              </div>
            </div>

            {/* Contacts Mode */}
            {sourceType === 'contacts' && (
              <div className="space-y-4">
                <div className="flex items-center gap-4 p-3 bg-gray-50 rounded">
                  <div className="flex items-center gap-2">
                    <Funnel className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-600">タグで絞り込み:</span>
                  </div>
                  <select
                    value={selectedTag}
                    onChange={(e) => setSelectedTag(e.target.value)}
                    className="px-2.5 py-1.5 text-sm border border-gray-300 rounded hover:border-gray-400 focus:border-accent-400 focus:ring-2 focus:ring-accent-400/20 focus:outline-none"
                  >
                    <option value="">すべての顧客</option>
                    {allTags.map(tag => (
                      <option key={tag} value={tag}>{tag}</option>
                    ))}
                  </select>
                </div>

                {contactsLoading ? (
                  <div className="py-4 text-center">
                    <div className="spinner mx-auto mb-2" />
                    <p className="text-sm text-gray-500">読み込み中...</p>
                  </div>
                ) : (
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                    <span className="text-sm text-gray-600">
                      対象顧客: <span className="font-medium text-gray-900">{contacts.length}件</span>
                    </span>
                    {selectedTag && (
                      <Badge variant="accent">{selectedTag}</Badge>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* CSV Mode */}
            {sourceType === 'csv' && (
              <>
                <CsvInput value={csvText} onChange={setCsvText} />

                {parsed.headers.length > 0 && (
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                      <Phone className="w-4 h-4 text-gray-400" />
                      電話番号の列
                    </label>
                    <div className="relative">
                      <select
                        value={phoneField}
                        onChange={(e) => setPhoneField(e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded appearance-none cursor-pointer pr-8 transition-all duration-150 hover:border-gray-400 focus:border-accent-400 focus:ring-2 focus:ring-accent-400/20 focus:outline-none"
                      >
                        {parsed.headers.map((header) => (
                          <option key={header} value={header}>
                            {header}
                          </option>
                        ))}
                      </select>
                      <CaretDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                )}
              </>
            )}
          </CardBody>
        </Card>

        {/* Template & Count */}
        <Card>
          <CardBody className="space-y-6">
            <TemplateEditor
              value={template}
              onChange={setTemplate}
              availableVariables={availableVariables}
            />

            <CountSlider
              value={count}
              onChange={setCount}
              max={maxCount}
            />
          </CardBody>
        </Card>

        {/* Preview */}
        <Card>
          <CardBody>
            <Preview
              rows={previewRows}
              template={template}
              count={count}
              phoneField={sourceType === 'csv' ? phoneField : 'phone'}
            />
          </CardBody>
        </Card>

        {error && <Alert variant="error">{error}</Alert>}

        {result && (
          <Alert variant="success" title="送信完了">
            成功: {result.success}件 / 失敗: {result.failed}件 / 合計: {result.total}件
          </Alert>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            variant="secondary"
            onClick={handleSaveDraft}
            disabled={isSaving || !campaignName.trim()}
            loading={isSaving}
            icon={<FloppyDisk className="w-4 h-4" />}
          >
            下書き保存
          </Button>
          <Button
            variant="secondary"
            onClick={() => handleSend(true)}
            disabled={isSending || !canSend}
            loading={isSending}
            icon={<Flask className="w-4 h-4" />}
            className="flex-1"
          >
            テスト送信
          </Button>
          <Button
            variant="primary"
            onClick={() => handleSend(false)}
            disabled={isSending || !canSend}
            loading={isSending}
            icon={<PaperPlaneTilt className="w-4 h-4" />}
            className="flex-1"
          >
            {count}件を送信
          </Button>
        </div>
      </div>
    </AppLayout>
  )
}
