import { CheckCircle, XCircle, Warning, Info } from '@phosphor-icons/react'

interface AlertProps {
  variant: 'success' | 'error' | 'warning' | 'info'
  title?: string
  children: React.ReactNode
}

const config = {
  success: {
    icon: CheckCircle,
    classes: 'bg-green-50 border-green-200 text-green-800',
    iconClass: 'text-green-500',
  },
  error: {
    icon: XCircle,
    classes: 'bg-red-50 border-red-200 text-red-800',
    iconClass: 'text-red-500',
  },
  warning: {
    icon: Warning,
    classes: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    iconClass: 'text-yellow-500',
  },
  info: {
    icon: Info,
    classes: 'bg-accent-50 border-accent-200 text-accent-800',
    iconClass: 'text-accent-500',
  },
}

export function Alert({ variant, title, children }: AlertProps) {
  const { icon: Icon, classes, iconClass } = config[variant]

  return (
    <div className={`p-3 rounded border flex gap-3 ${classes}`}>
      <Icon className={`w-5 h-5 flex-shrink-0 ${iconClass}`} weight="fill" />
      <div className="flex-1 min-w-0">
        {title && <p className="font-medium text-sm mb-0.5">{title}</p>}
        <p className="text-sm">{children}</p>
      </div>
    </div>
  )
}
