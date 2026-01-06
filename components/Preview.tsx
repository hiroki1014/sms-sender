'use client'

import { CsvRow } from '@/lib/csv'
import { replaceVariables } from '@/lib/template'

interface PreviewProps {
  rows: CsvRow[]
  template: string
  count: number
  phoneField: string
}

export default function Preview({ rows, template, count, phoneField }: PreviewProps) {
  const previewRows = rows.slice(0, count)

  if (previewRows.length === 0) {
    return (
      <div className="p-4 bg-gray-50 rounded-md text-gray-500 text-sm">
        CSVデータを入力するとプレビューが表示されます
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        プレビュー（{previewRows.length}件）
      </label>
      <div className="border border-gray-200 rounded-md divide-y divide-gray-200 max-h-64 overflow-y-auto">
        {previewRows.map((row, index) => {
          const message = replaceVariables(template, row)
          const phone = row[phoneField] || '電話番号なし'

          return (
            <div key={index} className="p-3 hover:bg-gray-50">
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium">
                  {index + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900">
                    {phone}
                  </div>
                  <div className="text-sm text-gray-600 whitespace-pre-wrap break-words">
                    {message || '（メッセージなし）'}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
