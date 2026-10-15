import { Clock, MapPin, Phone, Search, Share2, Sparkles, Store, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { Link, useParams } from 'react-router-dom'
import DietTag, { VegMark, dietType } from '../../components/menu/DietTag'
import FoodThumb from '../../components/menu/FoodThumb'
import Button from '../../components/ui/Button'
import Logo, { LogoMark } from '../../components/ui/Logo'
import Modal from '../../components/ui/Modal'
import { Skeleton } from '../../components/ui/Spinner'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { DEFAULT_BRAND_COLOR } from '../../lib/constants'
import { cn, formatPrice, getErrorMessage, getInitials } from '../../lib/utils'
import { publicService } from '../../services/public.service'

const ALL = 'all'

/** Picks black or white text for readable contrast on a given background. */
function readableOn(hex = DEFAULT_BRAND_COLOR) {
  const value = hex.replace('#', '')
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16) / 255)
  const lin = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  const luminance = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
  return luminance > 0.45 ? '#101828' : '#ffffff'
}

function MenuSkeleton() {
  return (
    <div className="min-h-screen bg-surface">
      <div className="h-16 border-b border-line bg-white" />
      <div className="mx-auto max-w-6xl sm:px-6">
        <Skeleton className="h-64 rounded-none sm:mt-4 sm:rounded-3xl" />
        <div className="space-y-4 px-4 py-6 sm:px-0">
          <Skeleton className="h-11 w-full rounded-2xl" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-28 rounded-2xl sm:h-72" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function MenuUnavailable({ message }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface px-6 text-center">
      <span className="flex size-16 items-center justify-center rounded-2xl bg-white text-ink-muted shadow-soft">
        <Store className="size-7" aria-hidden />
      </span>
      <h1 className="mt-6 text-2xl font-extrabold text-ink">Menu unavailable</h1>
      <p className="mt-2 max-w-sm text-ink-muted">{message || 'This menu is not available right now. Please ask the staff for assistance.'}</p>
      <Link to="/" className="mt-10 inline-flex items-center gap-2 text-sm font-semibold text-ink-muted hover:text-ink">
        <LogoMark className="size-5" /> Powered by Menuo
      </Link>
    </div>
  )
}

/** A list row on phones (photo left, as in a delivery app) and a photo card from `sm` up. */
function DishCard({ item, currency, onOpen }) {
  const diet = dietType(item.tags)
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(item)}
        className={cn(
          'group flex h-full w-full gap-3.5 rounded-2xl border border-line bg-white p-3 text-left transition hover:border-slate-300 hover:shadow-lift sm:flex-col sm:gap-0 sm:overflow-hidden sm:p-0',
          !item.isAvailable && 'opacity-60',
        )}
      >
        <div className="relative shrink-0 overflow-hidden rounded-xl sm:rounded-none">
          <FoodThumb
            src={item.imageUrl}
            name={item.name}
            className={cn('size-22 sm:aspect-[4/3] sm:h-auto sm:w-full sm:transition sm:duration-300 sm:group-hover:scale-[1.03]', !item.isAvailable && 'grayscale')}
          />
          {!item.isAvailable && (
            <span className="absolute inset-x-1.5 bottom-1.5 rounded-lg bg-ink/85 py-1 text-center text-[11px] font-bold text-white sm:inset-x-3 sm:bottom-3">
              Sold out
            </span>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col sm:p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              {diet && <VegMark type={diet} />}
              <span className="truncate text-[15px] leading-snug font-bold text-ink">{item.name}</span>
            </div>
            <span className="shrink-0 text-[15px] font-bold text-ink tabular-nums sm:hidden">{formatPrice(item.price, currency)}</span>
          </div>
          {item.description && <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-ink-muted sm:mt-1.5">{item.description}</p>}
          <div className="mt-auto hidden items-center justify-between gap-2 pt-3 sm:flex">
            <span className="text-base font-bold text-ink tabular-nums">{formatPrice(item.price, currency)}</span>
            {item.isFeatured && item.isAvailable && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700">
                <Sparkles className="size-3" aria-hidden /> Popular
              </span>
            )}
          </div>
        </div>
      </button>
    </li>
  )
}

export default function PublicMenu() {
  const { slug } = useParams()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [vegOnly, setVegOnly] = useState(false)
  const [activeCategory, setActiveCategory] = useState(ALL)
  const [selectedItem, setSelectedItem] = useState(null)
  const contentRef = useRef(null)

  useDocumentTitle(data ? `${data.restaurant.name} menu` : 'Menu')

  useEffect(() => {
    let cancelled = false
    setData(null)
    setError(null)
    publicService
      .getMenu(slug)
      .then((menu) => {
        if (cancelled) return
        setData(menu)
        setActiveCategory(ALL)
        const key = `menuo_viewed_${slug}`
        try {
          if (!sessionStorage.getItem(key)) {
            sessionStorage.setItem(key, '1')
            publicService.trackView(slug)
          }
        } catch {
          publicService.trackView(slug)
        }
      })
      .catch((err) => !cancelled && setError(getErrorMessage(err, 'This menu could not be loaded.')))
    return () => {
      cancelled = true
    }
  }, [slug])

  const restaurant = data?.restaurant
  const accent = restaurant?.brandColor || DEFAULT_BRAND_COLOR
  const onAccent = readableOn(accent)

  const categoryById = useMemo(() => Object.fromEntries((data?.categories || []).map((c) => [c.id, c])), [data])

  const sections = useMemo(() => {
    if (!data) return []
    const term = search.trim().toLowerCase()
    return data.categories
      .filter((category) => activeCategory === ALL || category.id === activeCategory)
      .map((category) => ({
        ...category,
        items: data.items.filter(
          (item) =>
            item.categoryId === category.id &&
            (!vegOnly || dietType(item.tags) === 'veg') &&
            (!term || item.name.toLowerCase().includes(term) || item.description?.toLowerCase().includes(term)),
        ),
      }))
      .filter((section) => section.items.length > 0)
  }, [data, search, vegOnly, activeCategory])

  const popular = useMemo(
    () => (data && activeCategory === ALL && !search && !vegOnly ? data.items.filter((i) => i.isFeatured && i.isAvailable).slice(0, 6) : []),
    [data, activeCategory, search, vegOnly],
  )
  const hasVegInfo = useMemo(() => data?.items.some((i) => dietType(i.tags)), [data])
  const tabs = useMemo(() => (data ? data.categories.filter((c) => data.items.some((i) => i.categoryId === c.id)) : []), [data])

  function selectCategory(id) {
    setActiveCategory(id)
    const top = contentRef.current?.getBoundingClientRect().top
    // Bring the list back into view when the reader had scrolled past its start.
    if (top != null && top < 0) window.scrollTo({ top: window.scrollY + top - 140, behavior: 'smooth' })
  }

  async function share() {
    const url = window.location.href
    try {
      if (navigator.share) await navigator.share({ title: `${restaurant.name} menu`, url })
      else {
        await navigator.clipboard.writeText(url)
        toast.success('Menu link copied')
      }
    } catch {
      // User dismissed the share sheet.
    }
  }

  if (error) return <MenuUnavailable message={error} />
  if (!data) return <MenuSkeleton />

  const taglineParts = (restaurant.cuisine || '').split(/[·|•]/).map((part) => part.trim()).filter(Boolean)
  const mapUrl = restaurant.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${restaurant.name} ${restaurant.address}`)}`
    : null

  return (
    <div className="min-h-screen bg-surface" style={{ '--accent': accent }}>
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          {data.showBranding ? (
            <Logo />
          ) : (
            <span className="truncate text-base font-extrabold text-ink">{restaurant.name}</span>
          )}
          <button
            type="button"
            onClick={share}
            className="inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold shadow-xs transition hover:opacity-90"
            style={{ backgroundColor: accent, color: onAccent }}
          >
            <Share2 className="size-4" aria-hidden /> Share menu
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl sm:px-6 sm:pt-5">
        <section aria-label={restaurant.name} className="relative overflow-hidden sm:rounded-3xl">
          {restaurant.cover ? (
            <img src={restaurant.cover} alt="" className="absolute inset-0 size-full object-cover" />
          ) : (
            <div
              className="absolute inset-0"
              style={{ background: `linear-gradient(135deg, #071C23, color-mix(in srgb, ${accent} 55%, #071C23))` }}
              aria-hidden
            >
              <div className="size-full bg-grid opacity-30" />
            </div>
          )}
          <div className="absolute inset-0 bg-linear-to-t from-black/85 via-black/65 to-black/45 sm:bg-linear-to-r sm:from-black/80 sm:via-black/55 sm:to-black/20" aria-hidden />

          <div className="relative flex flex-col gap-5 px-5 py-8 sm:flex-row sm:items-center sm:gap-6 sm:px-10 sm:py-14">
            {restaurant.logo ? (
              <img
                src={restaurant.logo}
                alt={`${restaurant.name} logo`}
                className="size-20 shrink-0 rounded-2xl bg-white object-cover p-1 shadow-lift sm:size-28"
              />
            ) : (
              <span
                className="flex size-20 shrink-0 items-center justify-center rounded-2xl text-2xl font-extrabold shadow-lift sm:size-28 sm:text-3xl"
                style={{ backgroundColor: accent, color: onAccent }}
                aria-hidden
              >
                {getInitials(restaurant.name)}
              </span>
            )}
            <div className="min-w-0 text-white">
              <h1 className="text-3xl leading-tight font-extrabold tracking-tight text-balance sm:text-4xl">{restaurant.name}</h1>
              {taglineParts.length > 0 && (
                <p className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm font-medium text-white/85">
                  {taglineParts.map((part, index) => (
                    <span key={part} className="flex items-center gap-2.5">
                      {index > 0 && <span className="h-3.5 w-px bg-white/40" aria-hidden />}
                      {part}
                    </span>
                  ))}
                </p>
              )}
              {restaurant.description && <p className="mt-3 line-clamp-2 max-w-xl text-sm leading-relaxed text-white/70">{restaurant.description}</p>}
              <div className="mt-5 flex flex-wrap items-center gap-2">
                {mapUrl && (
                  <a
                    href={mapUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-10 items-center gap-2 rounded-full px-4.5 text-sm font-semibold shadow-lift transition hover:opacity-90"
                    style={{ backgroundColor: accent, color: onAccent }}
                  >
                    <MapPin className="size-4" aria-hidden /> View on Map
                  </a>
                )}
                {restaurant.phone && (
                  <a
                    href={`tel:${restaurant.phone.replace(/\s/g, '')}`}
                    className="inline-flex h-10 items-center gap-2 rounded-full bg-white/10 px-4 text-sm font-semibold text-white ring-1 ring-white/25 backdrop-blur transition hover:bg-white/20"
                  >
                    <Phone className="size-4" aria-hidden /> Call
                  </a>
                )}
                {restaurant.openingHours && (
                  <span className="inline-flex h-10 items-center gap-2 rounded-full px-1 text-sm font-medium text-white/80">
                    <Clock className="size-4" aria-hidden /> {restaurant.openingHours}
                  </span>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>

      <div className="sticky top-0 z-20 mt-2 border-b border-line bg-surface/95 backdrop-blur-md sm:mt-4">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex flex-col gap-3 py-3 md:flex-row md:items-center">
            <nav aria-label="Menu categories" className="-mx-4 flex flex-1 gap-1.5 overflow-x-auto px-4 scrollbar-none md:mx-0 md:px-0">
              {[{ id: ALL, name: 'All' }, ...tabs].map((tab) => {
                const active = activeCategory === tab.id
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => selectCategory(tab.id)}
                    aria-pressed={active}
                    className={cn('shrink-0 rounded-full px-4.5 py-2 text-sm font-semibold whitespace-nowrap transition', !active && 'text-ink-soft hover:bg-white hover:text-ink')}
                    style={active ? { backgroundColor: accent, color: onAccent } : undefined}
                  >
                    {tab.name}
                  </button>
                )
              })}
            </nav>
            <div className="flex items-center gap-2 md:w-96">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-muted" aria-hidden />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search for dishes"
                  aria-label="Search for dishes"
                  className="h-10 w-full rounded-xl border border-line bg-white pr-10 pl-10 text-sm text-ink shadow-xs outline-none placeholder:text-ink-muted focus:border-[var(--accent)] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--accent)_15%,transparent)]"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="absolute top-1/2 right-2 -translate-y-1/2 rounded-lg p-1.5 text-ink-muted hover:text-ink"
                    aria-label="Clear search"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>
              {hasVegInfo && (
                <button
                  type="button"
                  onClick={() => setVegOnly((v) => !v)}
                  aria-pressed={vegOnly}
                  className={cn(
                    'flex h-10 shrink-0 items-center gap-2 rounded-xl border px-3 text-sm font-semibold transition',
                    vegOnly ? 'border-emerald-600 bg-emerald-50 text-emerald-700' : 'border-line bg-white text-ink-soft',
                  )}
                >
                  <VegMark type="veg" /> Veg
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <main ref={contentRef} className="mx-auto max-w-6xl px-4 pt-6 pb-12 sm:px-6">
        {popular.length > 0 && (
          <section aria-labelledby="popular-title" className="mb-10">
            <h2 id="popular-title" className="text-xl font-extrabold text-ink">
              Popular Dishes
            </h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
              {popular.map((item) => (
                <DishCard key={item.id} item={item} currency={restaurant.currency} onOpen={setSelectedItem} />
              ))}
            </ul>
          </section>
        )}

        {sections.length ? (
          <div className="space-y-10">
            {sections.map((section) => (
              <section key={section.id} aria-labelledby={`cat-${section.id}`}>
                <div className="mb-4">
                  <h2 id={`cat-${section.id}`} className="text-xl font-extrabold text-ink">
                    {section.name} <span className="text-sm font-semibold text-ink-muted">({section.items.length})</span>
                  </h2>
                  {section.description && <p className="mt-0.5 text-sm text-ink-muted">{section.description}</p>}
                </div>
                <ul className="grid gap-3 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
                  {section.items.map((item) => (
                    <DishCard key={item.id} item={item} currency={restaurant.currency} onOpen={setSelectedItem} />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-line bg-white px-6 py-14 text-center">
            <Search className="mx-auto size-8 text-ink-muted" aria-hidden />
            <p className="mt-3 font-semibold text-ink">{data.items.length ? 'No dishes found' : 'The menu is being prepared'}</p>
            <p className="mt-1 text-sm text-ink-muted">
              {data.items.length ? 'Try a different search or turn off filters.' : 'Please check back soon or ask the staff.'}
            </p>
            {(search || vegOnly || activeCategory !== ALL) && (
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => {
                  setSearch('')
                  setVegOnly(false)
                  setActiveCategory(ALL)
                }}
              >
                Clear filters
              </Button>
            )}
          </div>
        )}
      </main>

      <footer className="px-4 pb-10 text-center">
        <p className="text-xs text-ink-muted">Prices are inclusive of all taxes unless stated otherwise.</p>
        {data.showBranding && (
          <Link to="/" className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-semibold text-ink-soft shadow-xs ring-1 ring-line hover:text-ink">
            <LogoMark className="size-4" /> Create your own digital menu with Menuo
          </Link>
        )}
      </footer>

      <Modal open={Boolean(selectedItem)} onClose={() => setSelectedItem(null)} size="md" className="overflow-hidden">
        {selectedItem && (
          <div className="-mx-5 -my-5 sm:-mx-6">
            <div className="relative">
              <FoodThumb src={selectedItem.imageUrl} name={selectedItem.name} className="aspect-[4/3] w-full" iconClassName="max-h-16 max-w-16" />
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="absolute top-3 right-3 flex size-9 items-center justify-center rounded-full bg-white/90 text-ink shadow-soft hover:bg-white"
                aria-label="Close"
              >
                <X className="size-4.5" />
              </button>
            </div>
            <div className="p-5 sm:p-6">
              <div className="flex items-center gap-2">
                {dietType(selectedItem.tags) && <VegMark type={dietType(selectedItem.tags)} />}
                {!selectedItem.isAvailable && <span className="rounded-full bg-ink px-2 py-0.5 text-[11px] font-bold text-white">Sold out</span>}
              </div>
              <h2 className="mt-2 text-xl font-extrabold text-ink">{selectedItem.name}</h2>
              <p className="mt-1 text-xl font-bold text-ink tabular-nums">{formatPrice(selectedItem.price, restaurant.currency)}</p>
              {selectedItem.description && <p className="mt-3 text-sm leading-relaxed text-ink-soft">{selectedItem.description}</p>}
              {categoryById[selectedItem.categoryId] && (
                <p className="mt-4 text-sm text-ink-muted">
                  Category: <span className="font-semibold text-ink">{categoryById[selectedItem.categoryId].name}</span>
                </p>
              )}
              {selectedItem.tags?.filter((t) => t !== 'veg' && t !== 'non-veg').length > 0 && (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {selectedItem.tags
                    .filter((t) => t !== 'veg' && t !== 'non-veg')
                    .map((tag) => (
                      <DietTag key={tag} value={tag} />
                    ))}
                </div>
              )}
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="mt-6 h-12 w-full rounded-full text-sm font-bold transition hover:opacity-90"
                style={{ backgroundColor: accent, color: onAccent }}
              >
                Back to menu
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
