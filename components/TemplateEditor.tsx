'use client'

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

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        メッセージテンプレート
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-32 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
        placeholder={`{{name}}様

お知らせです。
ご確認をお願いいたします。`}
      />
      {availableVariables.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-gray-500">使える変数:</span>
          {availableVariables.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => insertVariable(v)}
              className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded-md text-gray-700"
            >
              {`{{${v}}}`}
            </button>
          ))}
        </div>
      )}
      <p className="text-xs text-gray-500">
        ※SMSは全角70文字、半角160文字を超えると分割送信されます（追加料金が発生する場合があります）
      </p>
    </div>
  )
}
