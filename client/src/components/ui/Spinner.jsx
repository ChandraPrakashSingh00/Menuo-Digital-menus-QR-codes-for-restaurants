import { LoaderCircle } from 'lucide-react'
import { cn } from '../../lib/utils'

export default function Spinner({ className, label = 'Loading' }) {
  return (
    <span role="status" className="inline-flex items-center">
      <LoaderCircle className={cn('size-6 animate-spin text-primary-600', className)} aria-hidden />
      <span className="sr-only">{label}</span>
    </span>
  )
}

export function PageLoader({ label }) {
  return (
    <div className="flex min-h-[50vh] w-full items-center justify-center">
      <Spinner label={label} />
    </div>
  )
}

export function Skeleton({ className }) {
  return <div className={cn('animate-pulse rounded-lg bg-slate-100', className)} />
}
