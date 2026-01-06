'use client'

import { Table, UploadSimple } from '@phosphor-icons/react'

interface CsvInputProps {
  value: string
  onChange: (value: string) => void
}

export default function CsvInput({ value, onChange }: CsvInputProps) {
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        const content = event.target?.result as string
        onChange(content)
      }
      reader.readAsText(file)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
          <Table className="w-4 h-4 text-gray-400" />
          送信リスト（CSV形式）
        </label>
        <label className="inline-flex items-center gap-1 px-2 py-1 text-xs text-gray-600 rounded cursor-pointer hover:bg-gray-100 transition-colors">
          <UploadSimple className="w-3.5 h-3.5" />
          ファイルを選択
          <input
            type="file"
            accept=".csv,.txt"
            onChange={handleFileUpload}
            className="hidden"
          />
        </label>
      </div>

      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-44 px-3 py-2.5 text-xs font-mono bg-white border border-gray-300 rounded transition-all duration-150 placeholder:text-gray-400 hover:border-gray-400 focus:border-accent-400 focus:ring-2 focus:ring-accent-400/20 focus:outline-none resize-none"
        placeholder={`電話番号,名前
09012345678,田中太郎
09087654321,山田花子`}
      />

      <p className="text-xs text-gray-500">
        1行目はヘッダー行です。電話番号は090/080/070形式で入力してください。
      </p>
    </div>
  )
}
