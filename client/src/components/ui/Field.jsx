import { cn } from '../../lib/utils'

/** Wraps a form control with a label, hint and error message. */
export function Field({ label, htmlFor, error, hint, optional, className, children, action }) {
  return (
    <div className={className}>
      {(label || action) && (
        <div className="flex items-center justify-between gap-2">
          {label && (
            <label htmlFor={htmlFor} className="label">
              {label}
              {optional && <span className="ml-1 font-normal text-ink-muted">(optional)</span>}
            </label>
          )}
          {action}
        </div>
      )}
      {children}
      {error ? (
        <p role="alert" className="mt-1.5 text-xs font-medium text-red-600">
          {error}
        </p>
      ) : (
        hint && <p className="mt-1.5 text-xs text-ink-muted">{hint}</p>
      )}
    </div>
  )
}

export function Input({ className, error, icon: Icon, suffix, prefix, ...props }) {
  if (!Icon && !suffix && !prefix) {
    return <input className={cn('field', error && 'field-error', className)} aria-invalid={error ? true : undefined} {...props} />
  }
  return (
    <div className="relative">
      {Icon && <Icon className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-muted" aria-hidden />}
      {prefix && (
        <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-sm font-medium text-ink-muted">
          {prefix}
        </span>
      )}
      <input
        className={cn('field', (Icon || prefix) && 'pl-10', suffix && 'pr-12', error && 'field-error', className)}
        aria-invalid={error ? true : undefined}
        {...props}
      />
      {suffix && <div className="absolute inset-y-0 right-1 flex items-center">{suffix}</div>}
    </div>
  )
}

export function Textarea({ className, error, rows = 3, ...props }) {
  return (
    <textarea
      rows={rows}
      className={cn('field resize-none leading-relaxed', error && 'field-error', className)}
      aria-invalid={error ? true : undefined}
      {...props}
    />
  )
}

const chevron =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%237a8090' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")"

export function Select({ className, error, children, style, ...props }) {
  return (
    <select
      className={cn('field appearance-none bg-[length:18px] bg-[right_0.75rem_center] bg-no-repeat pr-10', error && 'field-error', className)}
      style={{ backgroundImage: chevron, ...style }}
      aria-invalid={error ? true : undefined}
      {...props}
    >
      {children}
    </select>
  )
}
