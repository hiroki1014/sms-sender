'use client'

import { SmsLog } from '@/lib/supabase'

interface LogsTableProps {
  logs: SmsLog[]
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function maskPhone(phone: string): string {
  if (phone.length <= 4) return phone
  return phone.slice(0, 4) + '****' + phone.slice(-2)
}

export default function LogsTable({ logs }: LogsTableProps) {
  if (logs.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        送信ログがありません
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              日時
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              電話番号
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              メッセージ
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              ステータス
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {logs.map((log) => (
            <tr key={log.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                {log.sent_at ? formatDate(log.sent_at) : '-'}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm font-mono text-gray-900">
                {maskPhone(log.phone_number)}
              </td>
              <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">
                {log.message}
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                {log.status === 'success' ? (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    成功
                  </span>
                ) : (
                  <span
                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800"
                    title={log.error_message || undefined}
                  >
                    失敗
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
