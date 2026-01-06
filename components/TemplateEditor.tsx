'use client'

import { TextAa, Plus } from '@phosphor-icons/react'

interface TemplateEditorProps {
  value: string
  onChange: (value: string) => void
  availableVariables: string[]
}

export default function TemplateEditor({
  value,
  onChange,
  availableVariables,
}: TemplateEditorProps) {
  const insertVariable = (variable: string) => {
    onChange(value + `{{${variable}}}`)
  }

  const charCount = value.length
  const isLong = charCount > 70

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
          <TextAa className="w-4 h-4 text-gray-400" />
          メッセージテンプレート
        </label>
        <span className={`text-xs ${isLong ? 'text-warning-dark' : 'text-gray-400'}`}>
          {charCount}文字
          {isLong && ' (分割送信)'}
        </span>
      </div>

      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-32 px-3 py-2.5 text-sm bg-white border border-gray-300 rounded transition-all duration-150 placeholder:text-gray-400 hover:border-gray-400 focus:border-accent-400 focus:ring-2 focus:ring-accent-400/20 focus:outline-none resize-none"
        placeholder={`{{名前}}様

お知らせです。
ご確認をお願いいたします。`}
      />

      {availableVariables.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-gray-500 mr-1">変数:</span>
          {availableVariables.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => insertVariable(v)}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded text-gray-700 transition-colors duration-150"
            >
              <Plus className="w-3 h-3" />
              {v}
            </button>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-500">
        SMSは全角70文字、半角160文字を超えると分割送信されます。
      </p>
    </div>
  )
}
