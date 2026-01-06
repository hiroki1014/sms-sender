'use client'

interface CsvInputProps {
  value: string
  onChange: (value: string) => void
}

export default function CsvInput({ value, onChange }: CsvInputProps) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        送信リスト（CSV形式）
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-48 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
        placeholder={`電話番号,名前,会社名
09012345678,田中太郎,ABC株式会社
09087654321,山田花子,XYZ商事`}
      />
      <p className="text-xs text-gray-500">
        ※1行目はヘッダー行です。電話番号は090/080/070形式で入力してください。
      </p>
    </div>
  )
}
