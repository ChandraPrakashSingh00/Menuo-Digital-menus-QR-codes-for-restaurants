import { cn } from '../../lib/utils'

const tones = {
  neutral: 'bg-slate-100 text-ink-soft ring-slate-200',
  primary: 'bg-primary-50 text-primary-700 ring-primary-200',
  success: 'bg-primary-50 text-primary-700 ring-primary-200',
  warning: 'bg-amber-50 text-amber-700 ring-amber-200',
  danger: 'bg-red-50 text-red-700 ring-red-200',
}

export default function Badge({ tone = 'neutral', icon: Icon, className, children }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap ring-1 ring-inset',
        tones[tone],
        className,
      )}
    >
      {Icon && <Icon className="size-3" aria-hidden />}
      {children}
    </span>
  )
}
