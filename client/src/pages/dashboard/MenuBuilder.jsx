import {
  ArrowDown,
  ArrowUp,
  Copy,
  Ellipsis,
  Eye,
  EyeOff,
  Layers,
  Pencil,
  Plus,
  Search,
  Star,
  Trash2,
  UtensilsCrossed,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { useSearchParams } from 'react-router-dom'
import PageHeader from '../../components/layout/PageHeader'
import CategoryFormModal from '../../components/menu/CategoryFormModal'
import DietTag, { VegMark, dietType } from '../../components/menu/DietTag'
import FoodThumb from '../../components/menu/FoodThumb'
import ItemFormModal from '../../components/menu/ItemFormModal'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import Dropdown from '../../components/ui/Dropdown'
import EmptyState from '../../components/ui/EmptyState'
import { Input } from '../../components/ui/Field'
import { Skeleton } from '../../components/ui/Spinner'
import Switch from '../../components/ui/Switch'
import { useWorkspace } from '../../context/WorkspaceContext'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { cn, formatPrice, getErrorMessage } from '../../lib/utils'
import { categoryService, itemService } from '../../services/menu.service'

const ALL = 'all'
const QUICK_CATEGORIES = ['Starters', 'Main Course', 'Desserts', 'Drinks']
const AVAILABILITY_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'available', label: 'Available' },
  { value: 'soldout', label: 'Sold out' },
]

function IconMenuButton({ label, items }) {
  return (
    <Dropdown
      items={items}
      trigger={({ toggle, open }) => (
        <Button variant="ghost" size="icon-sm" onClick={toggle} aria-label={label} aria-haspopup="menu" aria-expanded={open}>
          <Ellipsis className="size-4" />
        </Button>
      )}
    />
  )
}

export default function MenuBuilder() {
  useDocumentTitle('Menu')
  const { restaurant } = useWorkspace()
  const [searchParams, setSearchParams] = useSearchParams()

  const [categories, setCategories] = useState([])
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(ALL)
  const [search, setSearch] = useState('')
  const [availability, setAvailability] = useState('all')

  const [categoryModal, setCategoryModal] = useState({ open: false, category: null })
  const [itemModal, setItemModal] = useState({ open: false, item: null })
  const [confirm, setConfirm] = useState(null)
  const [confirming, setConfirming] = useState(false)
  const [quickAdding, setQuickAdding] = useState(false)

  const load = useCallback(async () => {
    try {
      const [nextCategories, nextItems] = await Promise.all([categoryService.list(restaurant.id), itemService.list(restaurant.id)])
      setCategories(nextCategories)
      setItems(nextItems)
      return nextCategories
    } catch (error) {
      toast.error(getErrorMessage(error))
      return []
    } finally {
      setLoading(false)
    }
  }, [restaurant.id])

  useEffect(() => {
    load().then((loaded) => {
      if (searchParams.get('new') !== 'item') return
      setSearchParams({}, { replace: true })
      if (loaded.length) setItemModal({ open: true, item: null })
      else {
        toast('Create a category first, then add dishes to it.', { icon: '👋' })
        setCategoryModal({ open: true, category: null })
      }
    })
    // Run once on mount; the query param only triggers the initial modal.
  }, [])

  // The dashboard header search sends its term here as ?q=.
  const headerQuery = searchParams.get('q')
  useEffect(() => {
    if (headerQuery == null) return
    setSearch(headerQuery)
    setSelected(ALL)
    setAvailability('all')
    setSearchParams({}, { replace: true })
  }, [headerQuery, setSearchParams])

  // Keep category item counts in sync with the local item list.
  const categoriesWithCounts = useMemo(
    () => categories.map((c) => ({ ...c, itemCount: items.filter((i) => i.categoryId === c.id).length })),
    [categories, items],
  )
  const categoryById = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories])
  const selectedCategory = selected === ALL ? null : categoryById[selected]

  const visibleItems = useMemo(() => {
    const term = search.trim().toLowerCase()
    const order = Object.fromEntries(categories.map((c) => [c.id, c.sortOrder]))
    return items
      .filter((i) => selected === ALL || i.categoryId === selected)
      .filter((i) => availability === 'all' || (availability === 'available' ? i.isAvailable : !i.isAvailable))
      .filter((i) => !term || i.name.toLowerCase().includes(term) || i.description?.toLowerCase().includes(term))
      .sort((a, b) => (order[a.categoryId] ?? 0) - (order[b.categoryId] ?? 0) || a.sortOrder - b.sortOrder)
  }, [items, categories, selected, availability, search])

  // ---------- category actions ----------

  async function saveCategory(values) {
    try {
      if (categoryModal.category) {
        const updated = await categoryService.update(categoryModal.category.id, values)
        setCategories((list) => list.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)))
        toast.success('Category updated')
      } else {
        const created = await categoryService.create(restaurant.id, values)
        setCategories((list) => [...list, created])
        setSelected(created.id)
        toast.success(`“${created.name}” created`)
      }
      setCategoryModal({ open: false, category: null })
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  async function quickAddCategories() {
    setQuickAdding(true)
    try {
      for (const name of QUICK_CATEGORIES) {
        const created = await categoryService.create(restaurant.id, { name })
        setCategories((list) => [...list, created])
      }
      toast.success('Starter categories added')
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setQuickAdding(false)
    }
  }

  async function moveCategory(category, direction) {
    const ordered = [...categories].sort((a, b) => a.sortOrder - b.sortOrder)
    const index = ordered.findIndex((c) => c.id === category.id)
    const target = index + direction
    if (target < 0 || target >= ordered.length) return
    ;[ordered[index], ordered[target]] = [ordered[target], ordered[index]]
    const previous = categories
    setCategories(ordered.map((c, sortOrder) => ({ ...c, sortOrder })))
    try {
      await categoryService.reorder(restaurant.id, ordered.map((c) => c.id))
    } catch (error) {
      setCategories(previous)
      toast.error(getErrorMessage(error))
    }
  }

  async function toggleCategoryVisibility(category) {
    try {
      const updated = await categoryService.update(category.id, { isVisible: !category.isVisible })
      setCategories((list) => list.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)))
      toast.success(updated.isVisible ? 'Category is visible on your menu' : 'Category hidden from your menu')
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  function categoryActions(category) {
    const ordered = [...categories].sort((a, b) => a.sortOrder - b.sortOrder)
    const index = ordered.findIndex((c) => c.id === category.id)
    return [
      { label: 'Edit category', icon: Pencil, onClick: () => setCategoryModal({ open: true, category }) },
      index > 0 && { label: 'Move up', icon: ArrowUp, onClick: () => moveCategory(category, -1) },
      index < ordered.length - 1 && { label: 'Move down', icon: ArrowDown, onClick: () => moveCategory(category, 1) },
      {
        label: category.isVisible ? 'Hide from menu' : 'Show on menu',
        icon: category.isVisible ? EyeOff : Eye,
        onClick: () => toggleCategoryVisibility(category),
      },
      { divider: true },
      { label: 'Delete category', icon: Trash2, danger: true, onClick: () => setConfirm({ type: 'category', target: category }) },
    ]
  }

  // ---------- item actions ----------

  async function saveItem(values) {
    try {
      if (itemModal.item) {
        const updated = await itemService.update(itemModal.item.id, values)
        setItems((list) => list.map((i) => (i.id === updated.id ? updated : i)))
        toast.success('Item updated')
      } else {
        const created = await itemService.create(restaurant.id, values)
        setItems((list) => [...list, created])
        toast.success(`“${created.name}” added to your menu`)
      }
      setItemModal({ open: false, item: null })
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  async function toggleAvailability(item) {
    const next = !item.isAvailable
    setItems((list) => list.map((i) => (i.id === item.id ? { ...i, isAvailable: next } : i)))
    try {
      await itemService.update(item.id, { isAvailable: next })
      toast.success(next ? `${item.name} is back on the menu` : `${item.name} marked sold out`)
    } catch (error) {
      setItems((list) => list.map((i) => (i.id === item.id ? { ...i, isAvailable: !next } : i)))
      toast.error(getErrorMessage(error))
    }
  }

  async function duplicateItem(item) {
    try {
      const copy = await itemService.duplicate(item.id)
      setItems((list) => [...list, copy])
      toast.success('Item duplicated')
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  async function handleConfirm() {
    if (!confirm) return
    setConfirming(true)
    try {
      if (confirm.type === 'category') {
        await categoryService.remove(confirm.target.id)
        setCategories((list) => list.filter((c) => c.id !== confirm.target.id))
        setItems((list) => list.filter((i) => i.categoryId !== confirm.target.id))
        if (selected === confirm.target.id) setSelected(ALL)
        toast.success('Category deleted')
      } else {
        await itemService.remove(confirm.target.id)
        setItems((list) => list.filter((i) => i.id !== confirm.target.id))
        toast.success('Item deleted')
      }
      setConfirm(null)
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setConfirming(false)
    }
  }

  function openNewItem() {
    if (!categories.length) {
      toast('Create a category first, then add dishes to it.', { icon: '👋' })
      setCategoryModal({ open: true, category: null })
      return
    }
    setItemModal({ open: true, item: null })
  }

  const sortedCategories = [...categoriesWithCounts].sort((a, b) => a.sortOrder - b.sortOrder)
  const defaultCategoryId = selectedCategory?.id || sortedCategories[0]?.id
  const confirmCount = confirm?.type === 'category' ? items.filter((i) => i.categoryId === confirm.target.id).length : 0
  const filtering = Boolean(search) || availability !== 'all'

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Menu Management"
        description={loading ? 'Loading your menu…' : `Add, edit or remove your menu items · ${items.length} items in ${categories.length} categories`}
        actions={
          <>
            <Button variant="outline" icon={Layers} onClick={() => setCategoryModal({ open: true, category: null })}>
              New category
            </Button>
            <Button icon={Plus} onClick={openNewItem}>
              Add Item
            </Button>
          </>
        }
      />

      {loading ? (
        <>
          <div className="mb-6 flex gap-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-10 w-20 rounded-full" />
            ))}
          </div>
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-80 rounded-2xl" />
            ))}
          </div>
        </>
      ) : !categories.length ? (
        <div className="card">
          <EmptyState
            icon={Layers}
            title="Start by creating your menu categories"
            description="Categories group your dishes — like Pizza, Burgers or Drinks — and appear as tabs on your menu."
            action={
              <div className="flex flex-col items-center gap-3 sm:flex-row">
                <Button icon={Plus} onClick={() => setCategoryModal({ open: true, category: null })}>
                  Create category
                </Button>
                <Button variant="outline" onClick={quickAddCategories} loading={quickAdding}>
                  Quick add: {QUICK_CATEGORIES.join(', ')}
                </Button>
              </div>
            }
          />
        </div>
      ) : (
        <>
          <nav aria-label="Categories" className="-mx-4 overflow-x-auto px-4 scrollbar-none sm:mx-0 sm:px-0">
            <div className="flex gap-2 pb-1">
              {[{ id: ALL, name: 'All', itemCount: items.length, isVisible: true }, ...sortedCategories].map((c) => {
                const active = selected === c.id
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelected(c.id)}
                    aria-pressed={active}
                    className={cn(
                      'flex shrink-0 items-center gap-1.5 rounded-full px-4.5 py-2 text-sm font-semibold whitespace-nowrap transition',
                      active ? 'bg-primary-600 text-white shadow-[0_6px_16px_-6px_rgb(5_128_95/0.7)]' : 'text-ink-soft hover:bg-white hover:text-ink',
                    )}
                  >
                    {!c.isVisible && <EyeOff className="size-3.5" aria-label="Hidden" />}
                    {c.name}
                    <span className={cn('text-xs tabular-nums', active ? 'text-white/70' : 'text-ink-muted')}>{c.itemCount}</span>
                  </button>
                )
              })}
            </div>
          </nav>

          <div className="mt-4 mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-2">
              {selectedCategory ? (
                <>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="truncate text-base font-bold text-ink">{selectedCategory.name}</h2>
                      {!selectedCategory.isVisible && (
                        <Badge icon={EyeOff} tone="warning">
                          Hidden
                        </Badge>
                      )}
                    </div>
                    <p className="line-clamp-1 text-sm text-ink-muted">{selectedCategory.description || 'No description'}</p>
                  </div>
                  <IconMenuButton label={`Actions for ${selectedCategory.name}`} items={categoryActions(selectedCategory)} />
                </>
              ) : (
                <p className="text-sm text-ink-muted">
                  Showing <span className="font-semibold text-ink">{visibleItems.length}</span> of {items.length} items, in menu order.
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="sm:w-64">
                <Input
                  icon={Search}
                  placeholder="Search items…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  aria-label="Search items"
                  className="bg-white"
                  suffix={
                    search && (
                      <button type="button" onClick={() => setSearch('')} className="rounded-lg p-2 text-ink-muted hover:text-ink" aria-label="Clear search">
                        <X className="size-4" />
                      </button>
                    )
                  }
                />
              </div>
              <div role="radiogroup" aria-label="Filter by availability" className="inline-flex rounded-xl border border-line bg-white p-1">
                {AVAILABILITY_FILTERS.map((f) => (
                  <button
                    key={f.value}
                    type="button"
                    role="radio"
                    aria-checked={availability === f.value}
                    onClick={() => setAvailability(f.value)}
                    className={cn(
                      'flex-1 rounded-lg px-3 py-1.5 text-sm font-semibold whitespace-nowrap transition',
                      availability === f.value ? 'bg-primary-50 text-primary-700' : 'text-ink-muted hover:text-ink',
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {visibleItems.length ? (
            <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {visibleItems.map((item) => {
                const diet = dietType(item.tags)
                return (
                  <li key={item.id} className="card group flex flex-col overflow-hidden transition hover:shadow-lift">
                    <button
                      type="button"
                      onClick={() => setItemModal({ open: true, item })}
                      className="relative block aspect-[16/10] overflow-hidden bg-surface"
                      aria-label={`Edit ${item.name}`}
                    >
                      <FoodThumb
                        src={item.imageUrl}
                        name={item.name}
                        className={cn('size-full transition duration-300 group-hover:scale-[1.03]', !item.isAvailable && 'opacity-60 grayscale')}
                        iconClassName="max-h-12 max-w-12"
                      />
                      {diet && (
                        <span className="absolute top-3 left-3 rounded-md bg-white/95 p-1 shadow-xs">
                          <VegMark type={diet} />
                        </span>
                      )}
                      {item.isFeatured && (
                        <span className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-full bg-white/95 px-2 py-1 text-[11px] font-bold text-amber-600 shadow-xs">
                          <Star className="size-3 fill-amber-400 text-amber-400" aria-hidden /> Featured
                        </span>
                      )}
                    </button>

                    <div className="flex flex-1 flex-col p-4">
                      <div className="flex-1">
                        <h3 className="truncate text-[15px] font-bold text-ink">{item.name}</h3>
                        {selected === ALL && categoryById[item.categoryId] && (
                          <p className="mt-0.5 truncate text-xs text-ink-muted">{categoryById[item.categoryId].name}</p>
                        )}
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <span className="text-[15px] font-bold text-ink tabular-nums">{formatPrice(item.price, restaurant.currency)}</span>
                          <Badge tone={item.isAvailable ? 'success' : 'neutral'}>{item.isAvailable ? 'Available' : 'Sold out'}</Badge>
                        </div>
                      </div>

                      <div className="mt-4 flex items-center justify-between gap-2 border-t border-line pt-3">
                        <Switch size="sm" checked={item.isAvailable} onChange={() => toggleAvailability(item)} ariaLabel={`${item.name} available`} />
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => duplicateItem(item)}
                            className="flex size-8 items-center justify-center rounded-lg border border-line text-ink-muted transition hover:bg-surface hover:text-ink"
                            aria-label={`Duplicate ${item.name}`}
                            title="Duplicate"
                          >
                            <Copy className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setItemModal({ open: true, item })}
                            className="flex size-8 items-center justify-center rounded-lg border border-line text-primary-700 transition hover:border-primary-200 hover:bg-primary-50"
                            aria-label={`Edit ${item.name}`}
                            title="Edit"
                          >
                            <Pencil className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirm({ type: 'item', target: item })}
                            className="flex size-8 items-center justify-center rounded-lg border border-line text-red-600 transition hover:border-red-200 hover:bg-red-50"
                            aria-label={`Delete ${item.name}`}
                            title="Delete"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          ) : (
            <div className="card">
              <EmptyState
                icon={filtering ? Search : UtensilsCrossed}
                title={filtering ? 'No items match your filters' : 'No items in this category yet'}
                description={
                  filtering ? 'Try a different search term or clear the filters.' : 'Add dishes with prices and photos — they’ll show up on your live menu instantly.'
                }
                action={
                  filtering ? (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSearch('')
                        setAvailability('all')
                      }}
                    >
                      Clear filters
                    </Button>
                  ) : (
                    <Button icon={Plus} onClick={openNewItem}>
                      Add Item
                    </Button>
                  )
                }
              />
            </div>
          )}
        </>
      )}

      <CategoryFormModal
        open={categoryModal.open}
        category={categoryModal.category}
        onClose={() => setCategoryModal({ open: false, category: null })}
        onSubmit={saveCategory}
      />
      <ItemFormModal
        open={itemModal.open}
        item={itemModal.item}
        categories={sortedCategories}
        defaultCategoryId={defaultCategoryId}
        currency={restaurant.currency}
        onClose={() => setItemModal({ open: false, item: null })}
        onSubmit={saveItem}
      />
      <ConfirmDialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        onConfirm={handleConfirm}
        loading={confirming}
        title={`Delete “${confirm?.target.name}”?`}
        description={
          confirm?.type === 'category'
            ? confirmCount
              ? `This will permanently delete the category and its ${confirmCount} item${confirmCount === 1 ? '' : 's'}. This can’t be undone.`
              : 'This empty category will be permanently deleted.'
            : 'This item will be removed from your menu permanently. This can’t be undone.'
        }
        confirmLabel={confirm?.type === 'category' ? 'Delete category' : 'Delete item'}
      />
    </div>
  )
}
