import { Link } from 'react-router-dom'
import { cn } from '../../lib/utils'

/** Two-leaf sprout mark. `light` switches to mint tones for dark backgrounds. */
export function LogoMark({ className, light = false }) {
  return (
    <svg viewBox="0 0 32 32" className={cn('size-8', className)} aria-hidden>
      <path d="M15.2 28.5C7.6 27.4 2.9 20.2 4.6 7.2c7.5.6 12.6 6.8 10.6 21.3Z" fill={light ? '#6FDCB0' : '#05805F'} />
      <path d="M17 28.5c.4-10.6 4.4-18.4 11.7-22.2 1.6 11-3.1 19.9-11.7 22.2Z" fill={light ? '#C4F3DF' : '#3FB68C'} />
      <path d="M15.2 28.5C13.6 21 11 15.4 7.6 11.6" fill="none" stroke={light ? '#071C23' : '#fff'} strokeOpacity=".35" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}

export default function Logo({ to = '/', className, light = false }) {
  return (
    <Link to={to} className={cn('inline-flex items-center gap-2 rounded-lg', className)} aria-label="Menuo home">
      <LogoMark light={light} />
      <span className={cn('text-xl font-extrabold tracking-tight', light ? 'text-white' : 'text-ink')}>Menuo</span>
    </Link>
  )
}
