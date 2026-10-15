import { Check, Clock, Copy, Link2, Lock, LogOut, Mail, MapPin, Phone, RotateCcw, Store, User } from 'lucide-react'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { useNavigate, useSearchParams } from 'react-router-dom'
import PageHeader from '../../components/layout/PageHeader'
import Button from '../../components/ui/Button'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { Field, Input, Select, Textarea } from '../../components/ui/Field'
import ImageUpload from '../../components/ui/ImageUpload'
import { useAuth } from '../../context/AuthContext'
import { useWorkspace } from '../../context/WorkspaceContext'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { USE_MOCK } from '../../lib/api'
import { BRAND_COLORS, CURRENCIES, DEFAULT_BRAND_COLOR, SUPPORT_EMAIL } from '../../lib/constants'
import { resetDb } from '../../lib/mock/db'
import { cn, getErrorMessage, getPublicMenuUrl } from '../../lib/utils'
import { authService } from '../../services/auth.service'
import { restaurantService } from '../../services/restaurant.service'

const TABS = [
  { id: 'restaurant', label: 'Restaurant' },
  { id: 'branding', label: 'Branding' },
  { id: 'account', label: 'Account' },
]

function SettingsCard({ title, description, children, footer }) {
  return (
    <section className="card">
      <div className="border-b border-line px-5 py-4 sm:px-6">
        <h2 className="text-base font-bold text-ink">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-ink-muted">{description}</p>}
      </div>
      <div className="p-5 sm:p-6">{children}</div>
      {footer && <div className="flex justify-end gap-2 border-t border-line bg-surface/50 px-5 py-3.5 sm:rounded-b-2xl sm:px-6">{footer}</div>}
    </section>
  )
}

function MenuLink({ slug }) {
  const url = getPublicMenuUrl(slug)
  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Menu link copied')
    } catch {
      toast.error('Could not copy the link')
    }
  }
  return (
    <div className="flex items-center gap-2 rounded-xl border border-line bg-surface/60 p-1.5 pl-3">
      <Link2 className="size-4 shrink-0 text-ink-muted" aria-hidden />
      <span className="min-w-0 flex-1 truncate text-sm text-ink-soft">{url.replace(/^https?:\/\//, '')}</span>
      <Button size="sm" variant="secondary" icon={Copy} onClick={copy}>
        Copy
      </Button>
    </div>
  )
}

function RestaurantForm() {
  const { restaurant, setRestaurant } = useWorkspace()
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm({
    defaultValues: {
      name: restaurant.name,
      cuisine: restaurant.cuisine,
      description: restaurant.description,
      phone: restaurant.phone,
      email: restaurant.email,
      address: restaurant.address,
      openingHours: restaurant.openingHours,
      currency: restaurant.currency,
    },
  })

  async function onSubmit(values) {
    try {
      const updated = await restaurantService.update(restaurant.id, values)
      setRestaurant(updated)
      reset(values)
      toast.success('Restaurant details saved')
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <SettingsCard
        title="Restaurant details"
        description="Shown at the top of your digital menu."
        footer={
          <>
            <Button variant="ghost" onClick={() => reset()} disabled={!isDirty || isSubmitting}>
              Discard
            </Button>
            <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
              Save changes
            </Button>
          </>
        }
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Restaurant name" htmlFor="r-name" error={errors.name?.message}>
            <Input id="r-name" icon={Store} error={errors.name} {...register('name', { required: 'Restaurant name is required' })} />
          </Field>
          <Field label="Cuisine" htmlFor="r-cuisine" optional>
            <Input id="r-cuisine" placeholder="North Indian · Chinese · Café" {...register('cuisine')} />
          </Field>
          <Field label="Menu link" className="sm:col-span-2" hint="Your link is permanent, so QR codes you’ve already printed keep working.">
            <MenuLink slug={restaurant.slug} />
          </Field>
          <Field label="About" htmlFor="r-description" optional className="sm:col-span-2" hint="One or two lines about your food and vibe.">
            <Textarea id="r-description" rows={3} {...register('description', { maxLength: { value: 240, message: 'Keep it under 240 characters' } })} />
          </Field>
          <Field label="Phone" htmlFor="r-phone" optional>
            <Input id="r-phone" type="tel" icon={Phone} placeholder="+91 98200 12345" {...register('phone')} />
          </Field>
          <Field label="Contact email" htmlFor="r-email" optional error={errors.email?.message} hint="Private — not shown on your menu.">
            <Input
              id="r-email"
              type="email"
              icon={Mail}
              error={errors.email}
              {...register('email', { pattern: { value: /^\S+@\S+\.\S+$/, message: 'Enter a valid email' } })}
            />
          </Field>
          <Field label="Address" htmlFor="r-address" optional className="sm:col-span-2">
            <Input id="r-address" icon={MapPin} placeholder="Street, area, city" {...register('address')} />
          </Field>
          <Field label="Opening hours" htmlFor="r-hours" optional>
            <Input id="r-hours" icon={Clock} placeholder="11:00 AM – 11:00 PM" {...register('openingHours')} />
          </Field>
          <Field label="Currency" htmlFor="r-currency">
            <Select id="r-currency" {...register('currency')}>
              {CURRENCIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </SettingsCard>
    </form>
  )
}

function BrandingForm() {
  const { restaurant, setRestaurant } = useWorkspace()
  const {
    handleSubmit,
    control,
    reset,
    formState: { isSubmitting, isDirty },
  } = useForm({ defaultValues: { logo: restaurant.logo, cover: restaurant.cover, brandColor: restaurant.brandColor } })

  async function onSubmit(values) {
    try {
      const updated = await restaurantService.update(restaurant.id, values)
      setRestaurant(updated)
      reset({ logo: updated.logo, cover: updated.cover, brandColor: updated.brandColor })
      toast.success('Branding updated')
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <SettingsCard
        title="Branding"
        description="Make your menu look and feel like your restaurant."
        footer={
          <>
            <Button variant="ghost" onClick={() => reset()} disabled={!isDirty || isSubmitting}>
              Discard
            </Button>
            <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
              Save branding
            </Button>
          </>
        }
      >
        <div className="grid gap-6 sm:grid-cols-[180px_1fr]">
          <Controller
            name="logo"
            control={control}
            render={({ field }) => (
              <Field label="Logo" hint="Square, at least 300×300px.">
                <ImageUpload value={field.value} onChange={field.onChange} aspect="aspect-square" maxSize={400} label="Upload logo" hint="PNG or JPG" />
              </Field>
            )}
          />
          <Controller
            name="cover"
            control={control}
            render={({ field }) => (
              <Field
                label="Cover photo"
                hint="Wide image of your dining room or signature dish."
              >
                <ImageUpload value={field.value} onChange={field.onChange} aspect="aspect-[16/7]" maxSize={1400} label="Upload cover photo" />
              </Field>
            )}
          />
        </div>
        <Controller
          name="brandColor"
          control={control}
          render={({ field }) => (
            <fieldset className="mt-6">
              <legend className="label">Brand colour</legend>
              <div className="flex flex-wrap items-center gap-2.5" role="radiogroup" aria-label="Brand colour">
                {BRAND_COLORS.map((color) => {
                  const active = field.value?.toLowerCase() === color.toLowerCase()
                  return (
                    <button
                      key={color}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      aria-label={color}
                      onClick={() => field.onChange(color)}
                      className={cn(
                        'flex size-9 items-center justify-center rounded-full ring-2 ring-offset-2 transition disabled:cursor-not-allowed',
                        active ? 'ring-primary-500' : 'ring-transparent hover:ring-slate-200',
                      )}
                      style={{ backgroundColor: color }}
                    >
                      {active && <Check className="size-4 text-white" strokeWidth={3} aria-hidden />}
                    </button>
                  )
                })}
                <label className="ml-1 flex items-center gap-2 text-sm text-ink-soft">
                  <input
                    type="color"
                    value={field.value || DEFAULT_BRAND_COLOR}
                    onChange={(e) => field.onChange(e.target.value)}
                    className="size-9 cursor-pointer rounded-lg border border-line bg-white p-1"
                  />
                  Custom
                </label>
              </div>
              <div className="mt-4 flex items-center gap-3 rounded-xl border border-line p-3">
                <span className="rounded-full px-3 py-1.5 text-xs font-semibold text-white" style={{ backgroundColor: field.value }}>
                  Starters
                </span>
                <span className="text-sm font-bold" style={{ color: field.value }}>
                  ₹289
                </span>
                <span className="text-xs text-ink-muted">Preview of tabs and prices on your menu</span>
              </div>
            </fieldset>
          )}
        />
      </SettingsCard>
    </form>
  )
}

function AccountForms() {
  const { user, setUser, logout } = useAuth()
  const navigate = useNavigate()
  const [confirmReset, setConfirmReset] = useState(false)

  const profile = useForm({ defaultValues: { name: user.name, email: user.email } })
  const password = useForm({ defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' } })

  async function saveProfile(values) {
    try {
      const updated = await authService.updateProfile(values)
      setUser(updated)
      profile.reset({ name: updated.name, email: updated.email })
      toast.success('Profile updated')
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  async function savePassword({ currentPassword, newPassword }) {
    try {
      await authService.changePassword({ currentPassword, newPassword })
      password.reset()
      toast.success('Password changed. Other devices were signed out.')
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  async function resetDemo() {
    resetDb()
    await logout()
    toast.success('Demo data restored')
    navigate('/login', { replace: true })
  }

  return (
    <div className="space-y-6">
      <form onSubmit={profile.handleSubmit(saveProfile)} noValidate>
        <SettingsCard
          title="Your profile"
          footer={
            <Button type="submit" loading={profile.formState.isSubmitting} disabled={!profile.formState.isDirty}>
              Save profile
            </Button>
          }
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Full name" htmlFor="a-name" error={profile.formState.errors.name?.message}>
              <Input id="a-name" icon={User} error={profile.formState.errors.name} {...profile.register('name', { required: 'Name is required' })} />
            </Field>
            <Field label="Email" htmlFor="a-email" error={profile.formState.errors.email?.message}>
              <Input
                id="a-email"
                type="email"
                icon={Mail}
                error={profile.formState.errors.email}
                {...profile.register('email', {
                  required: 'Email is required',
                  pattern: { value: /^\S+@\S+\.\S+$/, message: 'Enter a valid email' },
                })}
              />
            </Field>
          </div>
        </SettingsCard>
      </form>

      <form onSubmit={password.handleSubmit(savePassword)} noValidate>
        <SettingsCard
          title="Change password"
          footer={
            <Button type="submit" loading={password.formState.isSubmitting}>
              Update password
            </Button>
          }
        >
          <div className="grid gap-5 sm:grid-cols-3">
            <Field label="Current password" htmlFor="p-current" error={password.formState.errors.currentPassword?.message}>
              <Input
                id="p-current"
                type="password"
                autoComplete="current-password"
                icon={Lock}
                error={password.formState.errors.currentPassword}
                {...password.register('currentPassword', { required: 'Required' })}
              />
            </Field>
            <Field label="New password" htmlFor="p-new" error={password.formState.errors.newPassword?.message}>
              <Input
                id="p-new"
                type="password"
                autoComplete="new-password"
                icon={Lock}
                error={password.formState.errors.newPassword}
                {...password.register('newPassword', { required: 'Required', minLength: { value: 8, message: 'At least 8 characters' } })}
              />
            </Field>
            <Field label="Confirm new password" htmlFor="p-confirm" error={password.formState.errors.confirmPassword?.message}>
              <Input
                id="p-confirm"
                type="password"
                autoComplete="new-password"
                icon={Lock}
                error={password.formState.errors.confirmPassword}
                {...password.register('confirmPassword', {
                  required: 'Required',
                  validate: (value, values) => value === values.newPassword || 'Passwords don’t match',
                })}
              />
            </Field>
          </div>
        </SettingsCard>
      </form>

      <SettingsCard title="Session">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-ink-muted">Log out of Menuo on this device.</p>
          <Button
            variant="outline"
            icon={LogOut}
            onClick={async () => {
              await logout()
              navigate('/login', { replace: true })
            }}
          >
            Log out
          </Button>
        </div>
        {USE_MOCK && (
          <div className="mt-5 flex flex-col gap-4 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-ink">Reset demo data</p>
              <p className="text-sm text-ink-muted">Wipes everything saved in this browser and restores the sample restaurant.</p>
            </div>
            <Button variant="outline" icon={RotateCcw} className="text-red-600" onClick={() => setConfirmReset(true)}>
              Reset data
            </Button>
          </div>
        )}
      </SettingsCard>

      <ConfirmDialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={resetDemo}
        title="Reset all demo data?"
        description="Every account, menu and setting saved in this browser will be replaced with the sample data. You’ll be logged out."
        confirmLabel="Reset everything"
      />
    </div>
  )
}

export default function Settings() {
  useDocumentTitle('Settings')
  const [params, setParams] = useSearchParams()
  const tab = TABS.some((t) => t.id === params.get('tab')) ? params.get('tab') : 'restaurant'

  return (
    <div className="animate-fade-in">
      <PageHeader title="Settings" description="Manage your restaurant profile, branding and account." />
      <div role="tablist" aria-label="Settings sections" className="mb-6 flex gap-1 overflow-x-auto border-b border-line scrollbar-none">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            onClick={() => setParams({ tab: t.id }, { replace: true })}
            className={cn(
              '-mb-px border-b-2 px-4 py-3 text-sm font-semibold whitespace-nowrap transition',
              tab === t.id ? 'border-primary-600 text-primary-700' : 'border-transparent text-ink-muted hover:text-ink',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === 'restaurant' && <RestaurantForm />}
        {tab === 'branding' && <BrandingForm />}
        {tab === 'account' && <AccountForms />}
      </div>
      <p className="mt-8 text-center text-xs text-ink-muted">
        Need help? Email{' '}
        <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold text-primary-600">
          {SUPPORT_EMAIL}
        </a>
      </p>
    </div>
  )
}
