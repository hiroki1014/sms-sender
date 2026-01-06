interface TableProps {
  children: React.ReactNode
  className?: string
}

export function Table({ children, className = '' }: TableProps) {
  return (
    <div className="overflow-x-auto">
      <table className={`w-full text-sm ${className}`}>
        {children}
      </table>
    </div>
  )
}

export function TableHead({ children }: { children: React.ReactNode }) {
  return <thead className="bg-gray-50 border-b border-gray-200">{children}</thead>
}

export function TableBody({ children }: { children: React.ReactNode }) {
  return <tbody className="divide-y divide-gray-100">{children}</tbody>
}

export function Th({ children, className = '' }: TableProps) {
  return (
    <th className={`px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${className}`}>
      {children}
    </th>
  )
}

interface TdProps extends TableProps {
  mono?: boolean
}

export function Td({ children, className = '', mono = false }: TdProps) {
  return (
    <td className={`px-4 py-3 ${mono ? 'font-mono tabular-nums text-xs' : ''} ${className}`}>
      {children}
    </td>
  )
}

export function Tr({ children, className = '' }: TableProps) {
  return (
    <tr className={`hover:bg-gray-50 transition-colors duration-100 ${className}`}>
      {children}
    </tr>
  )
}
