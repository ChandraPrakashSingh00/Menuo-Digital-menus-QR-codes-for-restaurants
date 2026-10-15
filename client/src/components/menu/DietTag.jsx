import { DIETARY_TAGS } from '../../lib/constants'
import { cn } from '../../lib/utils'

const BY_VALUE = Object.fromEntries(DIETARY_TAGS.map((tag) => [tag.value, tag]))

/** Indian-menu style square veg / non-veg marker. */
export function VegMark({ type, className }) {
  const veg = type !== 'non-veg'
  return (
    <span
      title={veg ? 'Vegetarian' : 'Non-vegetarian'}
      className={cn(
        // `relative` keeps the absolutely-positioned sr-only label inside scroll containers.
        'relative inline-flex size-4 shrink-0 items-center justify-center rounded-[3px] border-[1.5px] bg-white',
        veg ? 'border-emerald-600' : 'border-rose-700',
        className,
      )}
    >
      <span className={cn('size-2 rounded-full', veg ? 'bg-emerald-600' : 'bg-rose-700')} />
      <span className="sr-only">{veg ? 'Vegetarian' : 'Non-vegetarian'}</span>
    </span>
  )
}

export default function DietTag({ value, className }) {
  const tag = BY_VALUE[value]
  if (!tag) return null
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset', tag.className, className)}>
      {tag.label}
    </span>
  )
}

export function dietType(tags = []) {
  if (tags.includes('non-veg')) return 'non-veg'
  if (tags.includes('veg') || tags.includes('vegan')) return 'veg'
  return null
}
