import { useId } from 'react'
import { cn } from '../../lib/utils'

export default function Switch({ checked, onChange, label, description, disabled, size = 'md', id, className, ariaLabel }) {
  const fallbackId = useId()
  const controlId = id || fallbackId
  const control = (
    <button
      id={controlId}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={!label ? ariaLabel : undefined}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className={cn(
        'relative inline-flex shrink-0 items-center rounded-full transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' ? 'h-5 w-9' : 'h-6 w-11',
        checked ? 'bg-primary-600' : 'bg-slate-200 hover:bg-slate-300',
      )}
    >
      <span
        className={cn(
          'inline-block rounded-full bg-white shadow-sm ring-1 ring-black/5 transition-transform duration-200',
          size === 'sm' ? 'size-4' : 'size-5',
          checked ? (size === 'sm' ? 'translate-x-4.5' : 'translate-x-5.5') : 'translate-x-0.5',
        )}
      />
    </button>
  )
  if (!label) return <span className={cn('inline-flex', className)}>{control}</span>
  return (
    <div className={cn('flex items-start justify-between gap-4', className)}>
      <label htmlFor={controlId} className="min-w-0 cursor-pointer">
        <span className="block text-sm font-medium text-ink">{label}</span>
        {description && <span className="mt-0.5 block text-xs leading-relaxed text-ink-muted">{description}</span>}
      </label>
      {control}
    </div>
  )
}
