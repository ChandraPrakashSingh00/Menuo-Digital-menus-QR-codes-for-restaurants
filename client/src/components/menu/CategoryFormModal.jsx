import { useEffect } from 'react'
import { Controller, useForm } from 'react-hook-form'
import Button from '../ui/Button'
import { Field, Input, Textarea } from '../ui/Field'
import Modal from '../ui/Modal'
import Switch from '../ui/Switch'

const EMPTY = { name: '', description: '', isVisible: true }

export default function CategoryFormModal({ open, onClose, onSubmit, category }) {
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm({ defaultValues: EMPTY })

  useEffect(() => {
    if (open) reset(category ? { name: category.name, description: category.description, isVisible: category.isVisible } : EMPTY)
  }, [open, category, reset])

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={category ? 'Edit category' : 'New category'}
      description="Categories appear as tabs on your digital menu."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="category-form" loading={isSubmitting}>
            {category ? 'Save changes' : 'Create category'}
          </Button>
        </>
      }
    >
      <form id="category-form" onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        <Field label="Category name" htmlFor="category-name" error={errors.name?.message}>
          <Input
            id="category-name"
            data-autofocus
            placeholder="e.g. Starters, Main Course, Beverages"
            error={errors.name}
            {...register('name', {
              required: 'Category name is required',
              maxLength: { value: 40, message: 'Keep it under 40 characters' },
              validate: (v) => v.trim().length > 0 || 'Category name is required',
            })}
          />
        </Field>
        <Field label="Short description" htmlFor="category-description" optional hint="Shown under the category heading on your menu.">
          <Textarea id="category-description" rows={2} placeholder="Smoky, charred and straight out of the tandoor." {...register('description')} />
        </Field>
        <Controller
          name="isVisible"
          control={control}
          render={({ field }) => (
            <Switch
              id="category-visible"
              checked={field.value}
              onChange={field.onChange}
              label="Show on menu"
              description="Hidden categories (and their items) stay saved but customers won’t see them."
            />
          )}
        />
      </form>
    </Modal>
  )
}
