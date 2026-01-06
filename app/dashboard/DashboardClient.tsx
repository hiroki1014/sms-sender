'use client'

import { useState, useMemo } from 'react'
import AppLayout from '@/components/AppLayout'
import CsvInput from '@/components/CsvInput'
import TemplateEditor from '@/components/TemplateEditor'
import CountSlider from '@/components/CountSlider'
import Preview from '@/components/Preview'
import { Button, Alert, Card, CardBody } from '@/components/ui'
import { parseCsv } from '@/lib/csv'
import { replaceVariables } from '@/lib/template'
import { PaperPlaneTilt, Flask, Phone, CaretDown } from '@phosphor-icons/react'

interface SendResult {
  total: number
  success: number
  failed: number
}

export default function DashboardClient() {
  const [csvText, setCsvText] = useState('')
  const [template, setTemplate] = useState('')
  const [count, setCount] = useState(1)
  const [phoneField, setPhoneField] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [result, setResult] = useState<SendResult | null>(null)
  const [error, setError] = useState('')

  const parsed = useMemo(() => parseCsv(csvText), [csvText])

  // Auto-detect phone field
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

  // Adjust count to CSV rows
  useMemo(() => {
    if (parsed.rows.length > 0 && count > parsed.rows.length) {
      setCount(parsed.rows.length)
    } else if (parsed.rows.length > 0 && count === 0) {
      setCount(1)
    }
  }, [parsed.rows.length, count])

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

  const canSend = parsed.rows.length > 0 && template.trim().length > 0

  return (
    <AppLayout
      title="SMS送信"
      subtitle={parsed.rows.length > 0 ? `${parsed.rows.length}件のデータを読み込み済み` : undefined}
    >
      <div className="max-w-3xl space-y-6">
        <Card>
          <CardBody className="space-y-6">
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
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <Preview
              rows={parsed.rows}
              template={template}
              count={count}
              phoneField={phoneField}
            />
          </CardBody>
        </Card>

        {error && <Alert variant="error">{error}</Alert>}

        {result && (
          <Alert variant="success" title="送信完了">
            成功: {result.success}件 / 失敗: {result.failed}件 / 合計: {result.total}件
          </Alert>
        )}

        <div className="flex gap-3">
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
