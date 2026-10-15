import { ChefHat, Coffee, CupSoda, Drumstick, IceCreamCone, Pizza, Salad, Sandwich, Soup, UtensilsCrossed } from 'lucide-react'
import { cn } from '../../lib/utils'

const ICONS = [Soup, Salad, Pizza, Coffee, IceCreamCone, CupSoda, Drumstick, Sandwich, ChefHat, UtensilsCrossed]
const TONES = [
  'from-orange-100 to-amber-50 text-orange-500',
  'from-emerald-100 to-lime-50 text-emerald-600',
  'from-rose-100 to-orange-50 text-rose-500',
  'from-primary-100 to-sky-50 text-primary-600',
  'from-amber-100 to-yellow-50 text-amber-600',
  'from-violet-100 to-fuchsia-50 text-violet-500',
]

function hash(value = '') {
  let h = 0
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) >>> 0
  return h
}

/** Shows the item photo, or a friendly illustrated placeholder when there is none. */
export default function FoodThumb({ src, name, className, iconClassName }) {
  if (src) return <img src={src} alt={name ? `Photo of ${name}` : ''} loading="lazy" className={cn('object-cover', className)} />
  const h = hash(name)
  const Icon = ICONS[h % ICONS.length]
  return (
    <div className={cn('flex items-center justify-center bg-linear-to-br', TONES[h % TONES.length], className)} aria-hidden>
      <Icon className={cn('size-1/3 max-h-10 max-w-10 opacity-80', iconClassName)} strokeWidth={1.6} />
    </div>
  )
}
