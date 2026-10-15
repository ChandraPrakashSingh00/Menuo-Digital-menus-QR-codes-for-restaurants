import { ImagePlus, LoaderCircle, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { cn, readImageFile } from '../../lib/utils'

/** Drag-and-drop image picker. Emits a compressed data URL through onChange. */
export default function ImageUpload({ value, onChange, aspect = 'aspect-[4/3]', maxSize = 900, label = 'Upload image', hint, disabled, className, rounded = 'rounded-xl' }) {
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)

  async function handleFile(file) {
    if (!file || disabled) return
    setBusy(true)
    try {
      onChange(await readImageFile(file, { maxSize }))
    } catch (error) {
      toast.error(error.message)
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className={className}>
      <div
        onDragOver={(e) => {
          e.preventDefault()
          if (!disabled) setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          handleFile(e.dataTransfer.files?.[0])
        }}
        className={cn(
          'group relative overflow-hidden border-2 border-dashed transition',
          aspect,
          rounded,
          value ? 'border-transparent' : 'border-slate-300/70 bg-surface hover:border-primary-300 hover:bg-primary-50/40',
          dragging && 'border-primary-500 bg-primary-50',
          disabled && 'pointer-events-none opacity-60',
        )}
      >
        {value ? (
          <>
            <img src={value} alt="" className="size-full object-cover" />
            <div className="absolute inset-0 flex items-center justify-center gap-2 bg-ink/45 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-ink shadow-sm hover:bg-surface"
              >
                Replace
              </button>
              <button
                type="button"
                onClick={() => onChange('')}
                className="rounded-lg bg-white p-1.5 text-red-600 shadow-sm hover:bg-red-50"
                aria-label="Remove image"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex size-full flex-col items-center justify-center gap-2 p-4 text-center"
          >
            {busy ? (
              <LoaderCircle className="size-6 animate-spin text-primary-600" aria-hidden />
            ) : (
              <span className="flex size-10 items-center justify-center rounded-full bg-white text-primary-600 shadow-soft">
                <ImagePlus className="size-5" aria-hidden />
              </span>
            )}
            <span className="text-sm font-semibold text-primary-700">{label}</span>
            <span className="text-xs text-ink-muted">{hint || 'Drag & drop or click · PNG, JPG up to 8 MB'}</span>
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
    </div>
  )
}
