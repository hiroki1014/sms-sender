'use client'

import { Sliders, Hash } from '@phosphor-icons/react'

interface CountSliderProps {
  value: number
  onChange: (value: number) => void
  max: number
}

export default function CountSlider({ value, onChange, max }: CountSliderProps) {
  const percentage = max > 0 ? (value / max) * 100 : 0

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
        <Sliders className="w-4 h-4 text-gray-400" />
        送信件数
      </label>

      <div className="flex items-center gap-4">
        {/* Custom styled range slider */}
        <div className="flex-1 relative h-6 flex items-center">
          <div className="w-full h-1.5 bg-gray-200 rounded-full">
            <div
              className="h-full bg-accent-500 rounded-full transition-all duration-150"
              style={{ width: `${percentage}%` }}
            />
          </div>
          <input
            type="range"
            min={1}
            max={max || 1}
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            disabled={max === 0}
          />
        </div>

        {/* Number input */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Hash className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
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
              className="w-20 pl-7 pr-2 py-1.5 text-sm font-mono tabular-nums border border-gray-300 rounded text-center focus:border-accent-400 focus:ring-2 focus:ring-accent-400/20 focus:outline-none"
              disabled={max === 0}
            />
          </div>
          <span className="text-sm text-gray-500">/ {max}件</span>
        </div>
      </div>

      <p className="text-xs text-gray-500">
        リストの上位から指定件数を送信します
      </p>
    </div>
  )
}
