import { LoaderCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '../../lib/utils'

const variants = {
  primary:
    'bg-primary-600 text-white shadow-[0_1px_2px_rgb(5_128_95/0.3),inset_0_1px_0_rgb(255_255_255/0.15)] hover:bg-primary-700 active:bg-primary-800',
  secondary: 'bg-primary-50 text-primary-700 hover:bg-primary-100',
  outline: 'border border-line bg-white text-ink shadow-xs hover:border-slate-300 hover:bg-surface',
  'outline-primary': 'border border-primary-600 bg-white text-primary-700 hover:bg-primary-50',
  soft: 'border border-line bg-surface text-ink-soft hover:bg-slate-100 hover:text-ink',
  ghost: 'text-ink-soft hover:bg-surface hover:text-ink',
  danger: 'bg-red-600 text-white shadow-xs hover:bg-red-700',
  dark: 'bg-night-900 text-white hover:bg-night-800',
}

const sizes = {
  sm: 'h-9 gap-1.5 rounded-lg px-3 text-sm',
  md: 'h-11 gap-2 rounded-xl px-4.5 text-sm',
  lg: 'h-13 gap-2 rounded-xl px-6 text-base',
  icon: 'size-10 rounded-xl',
  'icon-sm': 'size-8 rounded-lg',
}

export default function Button({
  to,
  href,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  icon: Icon,
  iconRight: IconRight,
  className,
  children,
  type = 'button',
  ...props
}) {
  const classes = cn(
    'inline-flex shrink-0 items-center justify-center font-semibold whitespace-nowrap transition-all duration-150 select-none',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600',
    'disabled:pointer-events-none disabled:opacity-55',
    variants[variant],
    sizes[size],
    className,
  )
  const content = (
    <>
      {loading ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : Icon && <Icon className="size-4" aria-hidden />}
      {children}
      {IconRight && !loading && <IconRight className="size-4" aria-hidden />}
    </>
  )

  if (to) {
    return (
      <Link to={to} className={classes} {...props}>
        {content}
      </Link>
    )
  }
  if (href) {
    return (
      <a href={href} className={classes} {...props}>
        {content}
      </a>
    )
  }
  return (
    <button type={type} className={classes} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
      {content}
    </button>
  )
}
