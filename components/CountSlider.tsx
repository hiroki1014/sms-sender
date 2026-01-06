'use client'

interface CountSliderProps {
  value: number
  onChange: (value: number) => void
  max: number
}

export default function CountSlider({ value, onChange, max }: CountSliderProps) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        送信件数
      </label>
      <div className="flex items-center gap-4">
        <input
          type="range"
          min={1}
          max={max || 1}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          disabled={max === 0}
        />
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            max={max || 1}
            value={value}
            onChange={(e) => {
              const num = Number(e.target.value)
              if (num >= 1 && num <= max) {
                onChange(num)
              }
            }}
            className="w-20 px-2 py-1 border border-gray-300 rounded-md text-center"
            disabled={max === 0}
          />
          <span className="text-sm text-gray-500">/ {max} 件</span>
        </div>
      </div>
      <p className="text-xs text-gray-500">
        リストの上位から指定件数を送信します
      </p>
    </div>
  )
}
