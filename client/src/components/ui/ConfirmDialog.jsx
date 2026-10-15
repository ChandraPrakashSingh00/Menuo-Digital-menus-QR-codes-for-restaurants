import { TriangleAlert } from 'lucide-react'
import Button from './Button'
import Modal from './Modal'

export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Delete',
  loading = false,
  tone = 'danger',
}) {
  return (
    <Modal open={open} onClose={loading ? undefined : onClose} size="sm">
      <div className="flex gap-4">
        <div
          className={
            tone === 'danger'
              ? 'flex size-11 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600'
              : 'flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-600'
          }
        >
          <TriangleAlert className="size-5" aria-hidden />
        </div>
        <div className="min-w-0 pt-0.5">
          <h2 className="text-base font-bold text-ink">{title}</h2>
          {description && <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{description}</p>}
        </div>
      </div>
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  )
}
