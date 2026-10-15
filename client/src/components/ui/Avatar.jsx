import { cn, getInitials } from '../../lib/utils'

export default function Avatar({ name, src, className }) {
  if (src) return <img src={src} alt="" className={cn('size-9 rounded-full object-cover', className)} />
  return (
    <span
      className={cn(
        'inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-primary-500 to-primary-700 text-xs font-bold text-white',
        className,
      )}
      aria-hidden
    >
      {getInitials(name) || 'M'}
    </span>
  )
}
