interface BadgeProps {
  variant?: 'default' | 'accent' | 'success' | 'error' | 'warning'
  children: React.ReactNode
  className?: string
  title?: string
}

const variants = {
  default: 'bg-gray-100 text-gray-700',
  accent: 'bg-accent-100 text-accent-700',
  success: 'bg-green-50 text-green-700',
  error: 'bg-red-50 text-red-700',
  warning: 'bg-yellow-50 text-yellow-700',
}

export function Badge({ variant = 'default', children, className = '', title }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded ${variants[variant]} ${className}`}
      title={title}
    >
      {children}
    </span>
  )
}
