import { Check } from 'lucide-react'
import { useEffect } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { DIETARY_TAGS } from '../../lib/constants'
import { cn, formatPrice } from '../../lib/utils'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import { Field, Input, Select, Textarea } from '../ui/Field'
import ImageUpload from '../ui/ImageUpload'
import Modal from '../ui/Modal'
import Switch from '../ui/Switch'
import { VegMark, dietType } from './DietTag'
import FoodThumb from './FoodThumb'

const CURRENCY_SYMBOL = { INR: '₹', USD: '$', EUR: '€', GBP: '£', AED: 'AED' }

function emptyItem(categoryId) {
  return { name: '', description: '', price: '', categoryId: categoryId || '', imageUrl: '', tags: [], isAvailable: true, isFeatured: false }
}

function TagPicker({ value = [], onChange }) {
  function toggle(tag) {
    let next = value.includes(tag) ? value.filter((t) => t !== tag) : [...value, tag]
    // Veg and non-veg are mutually exclusive.
    if (tag === 'veg' && next.includes('veg')) next = next.filter((t) => t !== 'non-veg')
    if (tag === 'non-veg' && next.includes('non-veg')) next = next.filter((t) => t !== 'veg' && t !== 'vegan')
    if (tag === 'vegan' && next.includes('vegan')) next = next.filter((t) => t !== 'non-veg')
    onChange(next)
  }
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Dietary tags">
      {DIETARY_TAGS.map((tag) => {
        const active = value.includes(tag.value)
        return (
          <button
            key={tag.value}
            type="button"
            onClick={() => toggle(tag.value)}
            aria-pressed={active}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition ring-inset',
              active ? tag.className : 'bg-white text-ink-soft ring-line hover:bg-surface',
            )}
          >
            {active && <Check className="size-3" strokeWidth={3} aria-hidden />}
            {tag.label}
          </button>
        )
      })}
    </div>
  )
}

/** Live preview of how the dish will look on the customer menu. */
function ItemPreview({ values, category, currency }) {
  const price = values.price === '' || values.price == null ? null : Number(values.price)
  const diet = dietType(values.tags)
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-soft">
      <p className="border-b border-line bg-surface/70 px-4 py-2.5 text-sm font-semibold text-ink">Preview</p>
      <div className="p-4">
        <div className="relative overflow-hidden rounded-xl">
          <FoodThumb src={values.imageUrl} name={values.name || 'New item'} className={cn('aspect-[4/3] w-full', !values.isAvailable && 'grayscale')} />
          {!values.isAvailable && (
            <span className="absolute inset-x-2 bottom-2 rounded-lg bg-ink/85 py-1 text-center text-xs font-bold text-white">Sold out</span>
          )}
        </div>
        <div className="mt-4 flex items-center gap-2">
          {diet && <VegMark type={diet} />}
          <h3 className={cn('truncate text-lg font-bold', values.name ? 'text-ink' : 'text-ink-muted')}>{values.name || 'Item name'}</h3>
        </div>
        {category && (
          <Badge tone="success" className="mt-2">
            {category.name}
          </Badge>
        )}
        <p className={cn('mt-2.5 line-clamp-3 text-sm leading-relaxed', values.description ? 'text-ink-soft' : 'text-ink-muted/70')}>
          {values.description || 'Your description appears here.'}
        </p>
        <p className="mt-3 text-2xl font-extrabold text-primary-700 tabular-nums">
          {price != null && !Number.isNaN(price) ? formatPrice(price, currency) : '—'}
        </p>
      </div>
    </div>
  )
}

export default function ItemFormModal({ open, onClose, onSubmit, item, categories, defaultCategoryId, currency = 'INR' }) {
  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({ defaultValues: emptyItem(defaultCategoryId) })

  useEffect(() => {
    if (!open) return
    reset(
      item
        ? {
            name: item.name,
            description: item.description,
            price: item.price,
            categoryId: item.categoryId,
            imageUrl: item.imageUrl,
            tags: item.tags || [],
            isAvailable: item.isAvailable,
            isFeatured: item.isFeatured,
          }
        : emptyItem(defaultCategoryId),
    )
  }, [open, item, defaultCategoryId, reset])

  const values = watch()
  const description = values.description || ''
  const category = categories.find((c) => c.id === values.categoryId)

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={item ? 'Edit Menu Item' : 'Add Menu Item'}
      description={item ? 'Changes go live on your menu instantly.' : 'Fill in the details to add a new item.'}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="item-form" loading={isSubmitting}>
            {item ? 'Save changes' : 'Save Item'}
          </Button>
        </>
      }
    >
      <form
        id="item-form"
        onSubmit={handleSubmit((values) => onSubmit({ ...values, name: values.name.trim(), price: Number(values.price) }))}
        className="grid gap-8 md:grid-cols-[1fr_280px]"
        noValidate
      >
        <div className="min-w-0 space-y-5">
          <Field label="Item Name" htmlFor="item-name" error={errors.name?.message}>
            <Input
              id="item-name"
              data-autofocus
              placeholder="e.g. Margherita Pizza"
              error={errors.name}
              {...register('name', {
                required: 'Item name is required',
                maxLength: { value: 80, message: 'Keep it under 80 characters' },
                validate: (v) => v.trim().length > 0 || 'Item name is required',
              })}
            />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Category" htmlFor="item-category" error={errors.categoryId?.message}>
              <Select id="item-category" error={errors.categoryId} {...register('categoryId', { required: 'Choose a category' })}>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Price" htmlFor="item-price" error={errors.price?.message}>
              <Input
                id="item-price"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                prefix={CURRENCY_SYMBOL[currency]}
                className={currency === 'AED' ? 'pl-13' : undefined}
                placeholder="0"
                error={errors.price}
                {...register('price', {
                  required: 'Price is required',
                  min: { value: 0, message: 'Price cannot be negative' },
                  max: { value: 1000000, message: 'That price looks too high' },
                })}
              />
            </Field>
          </div>

          <Field
            label="Description"
            htmlFor="item-description"
            optional
            error={errors.description?.message}
            hint={`${description.length}/200 · Mention key ingredients, portion size or allergens.`}
          >
            <Textarea
              id="item-description"
              rows={3}
              placeholder="Describe the item…"
              error={errors.description}
              {...register('description', { maxLength: { value: 200, message: 'Keep it under 200 characters' } })}
            />
          </Field>

          <Controller
            name="imageUrl"
            control={control}
            render={({ field }) => (
              <Field label="Item Image" optional>
                <ImageUpload
                  value={field.value}
                  onChange={field.onChange}
                  aspect="aspect-[3/1]"
                  maxSize={800}
                  label="Choose image"
                  hint="Drag & drop or click · JPG, PNG or WebP up to 8 MB"
                />
              </Field>
            )}
          />

          <Controller
            name="tags"
            control={control}
            render={({ field }) => (
              <Field label="Dietary & highlight tags" optional>
                <TagPicker value={field.value} onChange={field.onChange} />
              </Field>
            )}
          />

          <div className="grid gap-4 rounded-xl border border-line p-4 sm:grid-cols-2">
            <Controller
              name="isAvailable"
              control={control}
              render={({ field }) => (
                <Switch id="item-available" size="sm" checked={field.value} onChange={field.onChange} label="Available" description="Off shows “Sold out”." />
              )}
            />
            <Controller
              name="isFeatured"
              control={control}
              render={({ field }) => (
                <Switch id="item-featured" size="sm" checked={field.value} onChange={field.onChange} label="Featured" description="Shown under Popular Dishes." />
              )}
            />
          </div>
        </div>

        <aside className="hidden md:block">
          <div className="sticky top-0">
            <ItemPreview values={values} category={category} currency={currency} />
          </div>
        </aside>
      </form>
    </Modal>
  )
}
