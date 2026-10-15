import { useEffect, useRef, useState } from 'react'
import { cn } from '../../lib/utils'

/** Small accessible popover menu. `items` = [{ label, icon, onClick, danger, divider }] */
export default function Dropdown({ trigger, items, align = 'right', className }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const onPointer = (e) => !rootRef.current?.contains(e.target) && setOpen(false)
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      {trigger({ open, toggle: () => setOpen((v) => !v) })}
      {open && (
        <div
          role="menu"
          className={cn(
            'absolute z-30 mt-1.5 min-w-48 animate-scale-in rounded-xl border border-line bg-white p-1.5 shadow-lift',
            align === 'right' ? 'right-0 origin-top-right' : 'left-0 origin-top-left',
          )}
        >
          {items.filter(Boolean).map((item, index) =>
            item.divider ? (
              <div key={`d${index}`} className="my-1 h-px bg-line" />
            ) : (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false)
                  item.onClick?.()
                }}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-medium transition',
                  item.danger ? 'text-red-600 hover:bg-red-50' : 'text-ink-soft hover:bg-surface hover:text-ink',
                )}
              >
                {item.icon && <item.icon className="size-4" aria-hidden />}
                {item.label}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  )
}
