'use client'

import { CsvRow } from '@/lib/csv'
import { replaceVariables } from '@/lib/template'
import { Eye, DeviceMobile } from '@phosphor-icons/react'

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
      <div className="p-6 bg-gray-50 rounded border border-gray-200 text-center">
        <DeviceMobile className="w-8 h-8 text-gray-300 mx-auto mb-2" />
        <p className="text-sm text-gray-500">
          CSVデータを入力するとプレビューが表示されます
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
        <Eye className="w-4 h-4 text-gray-400" />
        プレビュー
        <span className="ml-1 text-xs font-normal text-gray-500">
          ({previewRows.length}件)
        </span>
      </label>

      <div className="border border-gray-200 rounded overflow-hidden">
        <div className="max-h-64 overflow-y-auto divide-y divide-gray-100">
          {previewRows.map((row, index) => {
            const message = replaceVariables(template, row)
            const phone = row[phoneField] || '電話番号なし'

            return (
              <div
                key={index}
                className="p-3 hover:bg-gray-50 transition-colors duration-100"
              >
                <div className="flex items-start gap-3">
                  {/* Index badge */}
                  <span className="flex-shrink-0 w-5 h-5 bg-accent-50 text-accent-600 rounded flex items-center justify-center text-xs font-medium">
                    {index + 1}
                  </span>

                  <div className="flex-1 min-w-0">
                    {/* Phone number - monospace */}
                    <div className="text-xs font-mono tabular-nums text-gray-900 mb-1">
                      {phone}
                    </div>
                    {/* Message */}
                    <div className="text-sm text-gray-600 whitespace-pre-wrap break-words">
                      {message || (
                        <span className="text-gray-400 italic">メッセージなし</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
