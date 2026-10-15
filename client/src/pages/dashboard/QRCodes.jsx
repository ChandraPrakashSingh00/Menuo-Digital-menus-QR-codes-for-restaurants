import { Check, Copy, Download, ExternalLink, FileCode, Lightbulb, Printer, TriangleAlert } from 'lucide-react'
import { QRCodeCanvas, QRCodeSVG } from 'qrcode.react'
import { useRef, useState } from 'react'
import toast from 'react-hot-toast'
import PageHeader from '../../components/layout/PageHeader'
import Button from '../../components/ui/Button'
import { Field, Input } from '../../components/ui/Field'
import Switch from '../../components/ui/Switch'
import { useWorkspace } from '../../context/WorkspaceContext'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { QR_DOWNLOADED_KEY } from '../../lib/constants'
import { cn, downloadDataUrl, getErrorMessage, getPublicMenuUrl } from '../../lib/utils'
import { restaurantService } from '../../services/restaurant.service'

const QR_COLORS = ['#101828', '#05805F', '#071C23', '#DC2626', '#EA580C', '#2563EB', '#7C3AED']
const BG_COLORS = ['#FFFFFF', '#F4F7F9', '#EBF8F2', '#FFF7ED', '#EFF6FF']
const DEFAULT_CAPTION = 'Scan for Menu'
const EXPORT_SIZE = 1024

function ColorSwatches({ value, onChange, colors, label }) {
  return (
    <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label={label}>
      {colors.map((color) => (
        <button
          key={color}
          type="button"
          role="radio"
          aria-checked={value.toLowerCase() === color.toLowerCase()}
          aria-label={color}
          onClick={() => onChange(color)}
          className={cn(
            'flex size-8 items-center justify-center rounded-full ring-2 ring-offset-2 transition',
            color.toLowerCase() === '#ffffff' && 'border border-line',
            value.toLowerCase() === color.toLowerCase() ? 'ring-primary-500' : 'ring-transparent hover:ring-slate-200',
          )}
          style={{ backgroundColor: color }}
        >
          {value.toLowerCase() === color.toLowerCase() && (
            <Check className={cn('size-4', ['#ffffff', '#f4f7f9', '#ebf8f2', '#fff7ed', '#eff6ff'].includes(color.toLowerCase()) ? 'text-ink' : 'text-white')} strokeWidth={3} aria-hidden />
          )}
        </button>
      ))}
      <label className="relative flex size-8 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-dashed border-slate-300 bg-[conic-gradient(red,yellow,lime,aqua,blue,magenta,red)]">
        <span className="sr-only">Custom colour</span>
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" />
      </label>
    </div>
  )
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

export default function QRCodes() {
  useDocumentTitle('QR Code')
  const { restaurant, setRestaurant } = useWorkspace()
  const menuUrl = getPublicMenuUrl(restaurant.slug)
  const displayUrl = menuUrl.replace(/^https?:\/\//, '')

  const [fgColor, setFgColor] = useState('#101828')
  const [bgColor, setBgColor] = useState('#FFFFFF')
  const [showFrame, setShowFrame] = useState(true)
  const [showLogo, setShowLogo] = useState(Boolean(restaurant.logo))
  const [caption, setCaption] = useState(DEFAULT_CAPTION)
  const [publishing, setPublishing] = useState(false)
  const [copied, setCopied] = useState(false)

  const canvasRef = useRef(null)
  const svgRef = useRef(null)

  const imageSettings = showLogo && restaurant.logo ? { src: restaurant.logo, height: 34, width: 34, excavate: true } : undefined
  const exportImageSettings = imageSettings && { ...imageSettings, height: EXPORT_SIZE * 0.2, width: EXPORT_SIZE * 0.2 }
  const fileBase = `${restaurant.slug}-menu-qr`

  function markDownloaded() {
    try {
      localStorage.setItem(QR_DOWNLOADED_KEY, '1')
    } catch {
      // Ignore — only used for the onboarding checklist.
    }
  }

  async function downloadPng() {
    const qr = canvasRef.current
    if (!qr) return
    await document.fonts?.ready
    if (!showFrame) {
      downloadDataUrl(qr.toDataURL('image/png'), `${fileBase}.png`)
      markDownloaded()
      toast.success('QR code downloaded')
      return
    }
    // Same layout as the on-screen card: code first, then name, caption and link.
    const pad = 110
    const width = EXPORT_SIZE + pad * 2
    const height = EXPORT_SIZE + 500
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = bgColor
    roundRect(ctx, 0, 0, width, height, 64)
    ctx.fill()

    ctx.drawImage(qr, pad, pad, EXPORT_SIZE, EXPORT_SIZE)

    const textTop = pad + EXPORT_SIZE
    ctx.textAlign = 'center'
    ctx.fillStyle = fgColor
    ctx.font = '800 76px "Plus Jakarta Sans", system-ui, sans-serif'
    ctx.fillText(restaurant.name, width / 2, textTop + 120, width - pad * 2)
    ctx.font = '700 56px "Plus Jakarta Sans", system-ui, sans-serif'
    ctx.fillText(caption || DEFAULT_CAPTION, width / 2, textTop + 210, width - pad * 2)
    ctx.globalAlpha = 0.6
    ctx.font = '500 36px "Plus Jakarta Sans", system-ui, sans-serif'
    ctx.fillText(displayUrl, width / 2, textTop + 290, width - pad * 2)
    ctx.globalAlpha = 1

    downloadDataUrl(canvas.toDataURL('image/png'), `${fileBase}.png`)
    markDownloaded()
    toast.success('Print-ready QR downloaded')
  }

  function downloadSvg() {
    const svg = svgRef.current
    if (!svg) return
    const markup = new XMLSerializer().serializeToString(svg)
    const url = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml' }))
    downloadDataUrl(url, `${fileBase}.svg`)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    markDownloaded()
    toast.success('SVG downloaded')
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(menuUrl)
      setCopied(true)
      toast.success('Menu link copied')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Could not copy the link')
    }
  }

  async function togglePublished(next) {
    setPublishing(true)
    try {
      const updated = await restaurantService.update(restaurant.id, { isPublished: next })
      setRestaurant(updated)
      toast.success(next ? 'Your menu is live' : 'Your menu is now offline')
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setPublishing(false)
    }
  }

  return (
    <div className="animate-fade-in">
      <PageHeader title="QR Code Generator" description="Download your QR code and place it on your tables." />

      {!restaurant.isPublished && (
        <div role="alert" className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
          <p>
            <span className="font-semibold">Your menu is offline.</span> Guests who scan the code will see a “menu unavailable” page until you publish
            it again.
          </p>
        </div>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,380px)_1fr]">
        <div className="space-y-4">
          <section aria-label="QR code preview" className="card flex justify-center p-6">
            <div className="print-area w-full max-w-xs rounded-2xl p-6 text-center transition-colors" style={{ backgroundColor: bgColor, color: fgColor }}>
              <div className="mx-auto w-fit">
                <QRCodeSVG
                  ref={svgRef}
                  value={menuUrl}
                  size={220}
                  level={imageSettings ? 'H' : 'M'}
                  fgColor={fgColor}
                  bgColor={bgColor}
                  marginSize={showFrame ? 0 : 2}
                  imageSettings={imageSettings}
                  title={`QR code linking to ${restaurant.name} menu`}
                  className="h-auto w-full max-w-56"
                />
              </div>
              {showFrame && (
                <>
                  <p className="mt-5 truncate text-lg font-bold">{restaurant.name}</p>
                  <p className="mt-1 text-base font-semibold">{caption || DEFAULT_CAPTION}</p>
                  <p className="mt-1.5 truncate text-xs opacity-60">{displayUrl}</p>
                </>
              )}
            </div>
            {/* High-resolution canvas used for PNG export */}
            <QRCodeCanvas
              ref={canvasRef}
              value={menuUrl}
              size={EXPORT_SIZE}
              level={imageSettings ? 'H' : 'M'}
              fgColor={fgColor}
              bgColor={bgColor}
              marginSize={showFrame ? 0 : 4}
              imageSettings={exportImageSettings}
              className="hidden"
              aria-hidden
            />
          </section>

          <div className="card space-y-2.5 p-4">
            <Button icon={Download} className="w-full" onClick={downloadPng}>
              Download QR Code
            </Button>
            <Button variant="soft" icon={copied ? Check : Copy} className="w-full" onClick={copyLink}>
              {copied ? 'Copied' : 'Copy Link'}
            </Button>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button variant="ghost" size="sm" icon={FileCode} onClick={downloadSvg}>
                SVG
              </Button>
              <Button variant="ghost" size="sm" icon={Printer} onClick={() => window.print()}>
                Print
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <section className="card p-5 sm:p-6" aria-labelledby="link-title">
            <div className="flex items-start justify-between gap-4">
              <h2 id="link-title" className="text-base font-bold text-ink">
                Share Link
              </h2>
              <Switch
                id="menu-live"
                size="sm"
                checked={restaurant.isPublished}
                onChange={togglePublished}
                disabled={publishing}
                label={restaurant.isPublished ? 'Live' : 'Offline'}
              />
            </div>
            <div className="mt-4 flex items-center gap-2">
              <div className="flex h-11 min-w-0 flex-1 items-center rounded-xl border border-line bg-white px-3.5">
                <span className="truncate text-sm font-medium text-ink-soft">{menuUrl}</span>
              </div>
              <button
                type="button"
                onClick={copyLink}
                className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-700 transition hover:bg-primary-100"
                aria-label="Copy menu link"
              >
                {copied ? <Check className="size-4.5" /> : <Copy className="size-4.5" />}
              </button>
              <Button size="icon" variant="outline" className="size-11" href={menuUrl} target="_blank" rel="noreferrer" aria-label="Open menu in new tab">
                <ExternalLink className="size-4.5" />
              </Button>
            </div>
            <p className="mt-2.5 text-xs text-ink-muted">
              {restaurant.isPublished
                ? 'Live — share it on WhatsApp, Instagram or Google Maps.'
                : 'Offline — turn on the switch to publish your menu.'}
            </p>
          </section>

          <section className="flex gap-3 rounded-2xl border border-primary-100 bg-primary-50/60 p-5" aria-labelledby="tip-title">
            <Lightbulb className="mt-0.5 size-5 shrink-0 text-primary-600" aria-hidden />
            <div>
              <h2 id="tip-title" className="text-sm font-bold text-primary-800">
                Pro Tip
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-ink-soft">
                Place this QR code on your tables, counter or bill for easy access to your digital menu. It always opens your latest menu, so you never
                need to reprint it.
              </p>
            </div>
          </section>

          <section className="card space-y-6 p-5 sm:p-6" aria-labelledby="style-title">
            <h2 id="style-title" className="text-base font-bold text-ink">
              Customise
            </h2>
            <Field label="QR colour">
              <ColorSwatches value={fgColor} onChange={setFgColor} colors={QR_COLORS} label="QR colour" />
            </Field>
            <Field label="Background">
              <ColorSwatches value={bgColor} onChange={setBgColor} colors={BG_COLORS} label="Background colour" />
            </Field>
            <div className="space-y-4 rounded-xl border border-line p-4">
              <Switch
                id="qr-frame"
                checked={showFrame}
                onChange={setShowFrame}
                label="Show restaurant name & caption"
                description="Best for table tents and posters."
              />
              <Switch
                id="qr-logo"
                checked={showLogo && Boolean(restaurant.logo)}
                onChange={setShowLogo}
                disabled={!restaurant.logo}
                label="Show logo in the centre"
                description={restaurant.logo ? 'Uses your restaurant logo.' : 'Upload a logo in Settings to enable this.'}
              />
            </div>
            {showFrame && (
              <Field label="Caption" htmlFor="qr-caption" hint="Keep it short — it’s printed under the code.">
                <Input id="qr-caption" value={caption} maxLength={40} onChange={(e) => setCaption(e.target.value)} />
              </Field>
            )}
            {fgColor.toLowerCase() === bgColor.toLowerCase() && (
              <p role="alert" className="text-sm font-medium text-red-600">
                QR and background colours are identical — the code won’t scan.
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
