'use client'

import { SmsLog } from '@/lib/supabase'
import { Badge } from '@/components/ui'
import { Table, TableHead, TableBody, Th, Td, Tr } from '@/components/ui'
import { CheckCircle, XCircle, ClockCounterClockwise } from '@phosphor-icons/react'

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
      <div className="py-12 text-center">
        <ClockCounterClockwise className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <p className="text-sm text-gray-500">送信ログがありません</p>
      </div>
    )
  }

  return (
    <Table>
      <TableHead>
        <tr>
          <Th>日時</Th>
          <Th>電話番号</Th>
          <Th>メッセージ</Th>
          <Th className="w-24">ステータス</Th>
        </tr>
      </TableHead>
      <TableBody>
        {logs.map((log) => (
          <Tr key={log.id}>
            <Td className="whitespace-nowrap text-gray-500 text-xs">
              {log.sent_at ? formatDate(log.sent_at) : '-'}
            </Td>
            <Td mono className="whitespace-nowrap">
              {maskPhone(log.phone_number)}
            </Td>
            <Td className="max-w-xs">
              <span className="truncate-1 text-gray-600">{log.message}</span>
            </Td>
            <Td>
              {log.status === 'success' ? (
                <Badge variant="success">
                  <CheckCircle className="w-3 h-3 mr-1" weight="fill" />
                  成功
                </Badge>
              ) : (
                <Badge variant="error" title={log.error_message || undefined}>
                  <XCircle className="w-3 h-3 mr-1" weight="fill" />
                  失敗
                </Badge>
              )}
            </Td>
          </Tr>
        ))}
      </TableBody>
    </Table>
  )
}
