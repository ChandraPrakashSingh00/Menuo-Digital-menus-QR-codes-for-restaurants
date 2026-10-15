import {
  BookOpenText,
  ChevronDown,
  ChevronsUpDown,
  CreditCard,
  ExternalLink,
  House,
  LifeBuoy,
  LogOut,
  Menu as MenuIcon,
  Plus,
  QrCode,
  RefreshCw,
  Search,
  Settings,
  Sparkles,
  Store,
  TriangleAlert,
  X,
} from 'lucide-react'
import { Suspense, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { WorkspaceProvider, useWorkspace } from '../../context/WorkspaceContext'
import { PLANS, SUPPORT_EMAIL, TRIAL_DAYS } from '../../lib/constants'
import { cn, formatDate, getErrorMessage, getInitials } from '../../lib/utils'
import Avatar from '../ui/Avatar'
import Button from '../ui/Button'
import Dropdown from '../ui/Dropdown'
import EmptyState from '../ui/EmptyState'
import { Field, Input, Select } from '../ui/Field'
import Logo from '../ui/Logo'
import Modal from '../ui/Modal'
import { PageLoader } from '../ui/Spinner'

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: House, end: true },
  { to: '/dashboard/menu', label: 'Menu', icon: BookOpenText },
  { to: '/dashboard/qr', label: 'QR Code', icon: QrCode },
  { to: '/dashboard/billing', label: 'Subscription', icon: CreditCard },
  { to: '/dashboard/settings', label: 'Settings', icon: Settings },
]

function daysLeft(date) {
  return Math.max(0, Math.ceil((new Date(date) - Date.now()) / 86400000))
}

function PlanCard() {
  const { subscription, plan } = useWorkspace()
  if (!subscription) return null
  const { status, hasAccess } = subscription
  if (status === 'active' && plan.id === 'pro' && !subscription.cancelAtPeriodEnd) return null

  let content
  if (status === 'trialing' && hasAccess) {
    content = {
      title: `${plan.name} trial · ${daysLeft(subscription.trialEndsAt)} days left`,
      text: 'Subscribe before your trial ends to keep your menu online.',
      cta: 'Choose a plan',
    }
  } else if (!hasAccess) {
    content = { title: 'Menu offline', text: 'Your plan is inactive. Subscribe to bring your menu back online.', cta: 'Reactivate' }
  } else if (status === 'past_due') {
    content = { title: 'Payment due', text: 'Your last payment did not go through. Razorpay will retry it automatically.', cta: 'View billing' }
  } else if (subscription.cancelAtPeriodEnd || status === 'cancelled') {
    content = {
      title: `${plan.name} ends ${formatDate(subscription.currentPeriodEnd || subscription.trialEndsAt)}`,
      text: 'Your plan won’t renew. Subscribe again any time.',
      cta: 'Resubscribe',
    }
  } else {
    content = { title: `${plan.name} plan`, text: 'Need more than 50 items? Pro has no item limit.', cta: 'Upgrade to Pro' }
  }

  return (
    <div className="rounded-xl bg-white/[0.06] p-3.5 ring-1 ring-white/10">
      <div className="flex items-center gap-2 text-xs font-semibold text-mint">
        <Sparkles className="size-3.5 shrink-0" aria-hidden />
        <span className="truncate">{content.title}</span>
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-white/60">{content.text}</p>
      <Button to="/dashboard/billing" size="sm" className="mt-3 h-8 w-full">
        {content.cta}
      </Button>
    </div>
  )
}

function CreateRestaurantForm({ onCreated, submitLabel = 'Create restaurant', showTrialNote = true }) {
  const { createRestaurant } = useWorkspace()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ defaultValues: { name: '', plan: 'starter' } })

  async function onSubmit(values) {
    try {
      const created = await createRestaurant({ name: values.name.trim(), plan: values.plan })
      toast.success(`${created.name} is ready`)
      onCreated?.(created)
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 text-left" noValidate>
      <Field label="Restaurant name" htmlFor="new-restaurant-name" error={errors.name?.message}>
        <Input
          id="new-restaurant-name"
          data-autofocus
          icon={Store}
          placeholder="The Food Villa"
          error={errors.name}
          {...register('name', {
            required: 'Restaurant name is required',
            maxLength: { value: 80, message: 'Keep it under 80 characters' },
            validate: (v) => v.trim().length > 0 || 'Restaurant name is required',
          })}
        />
      </Field>
      <Field label="Plan" htmlFor="new-restaurant-plan" hint={showTrialNote ? `Your first restaurant includes a ${TRIAL_DAYS}-day free trial.` : undefined}>
        <Select id="new-restaurant-plan" {...register('plan')}>
          {PLANS.map((plan) => (
            <option key={plan.id} value={plan.id}>
              {plan.name} — ₹{plan.price}/month
            </option>
          ))}
        </Select>
      </Field>
      <Button type="submit" className="w-full" loading={isSubmitting} icon={Plus}>
        {submitLabel}
      </Button>
    </form>
  )
}

function RestaurantSwitcher({ onAdd }) {
  const { restaurant, restaurants, selectRestaurant } = useWorkspace()
  if (!restaurant) return null
  return (
    <Dropdown
      align="left"
      className="w-full"
      items={[
        ...restaurants.map((r) => ({
          label: r.id === restaurant.id ? `${r.name} ✓` : r.name,
          icon: Store,
          onClick: () => r.id !== restaurant.id && selectRestaurant(r.id),
        })),
        { divider: true },
        { label: 'Add restaurant', icon: Plus, onClick: onAdd },
      ]}
      trigger={({ toggle, open }) => (
        <button
          type="button"
          onClick={toggle}
          aria-haspopup="menu"
          aria-expanded={open}
          className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition hover:bg-white/[0.06]"
        >
          {restaurant.logo ? (
            <img src={restaurant.logo} alt="" className="size-10 shrink-0 rounded-xl bg-white object-cover p-0.5" />
          ) : (
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white text-sm font-extrabold text-primary-700">
              {getInitials(restaurant.name)}
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-white">{restaurant.name}</span>
            <span className="block truncate text-xs text-white/50">{restaurant.cuisine || `/m/${restaurant.slug}`}</span>
          </span>
          <ChevronsUpDown className="size-4 shrink-0 text-white/50" aria-hidden />
        </button>
      )}
    />
  )
}

function Sidebar({ onNavigate, onAddRestaurant }) {
  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto px-4 py-6 scrollbar-none">
      <div className="px-2">
        <Logo to="/dashboard" light />
      </div>

      <RestaurantSwitcher onAdd={onAddRestaurant} />

      <nav aria-label="Dashboard" className="flex flex-col gap-1">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition',
                isActive ? 'bg-primary-600 text-white shadow-[0_8px_20px_-8px_rgb(5_128_95/0.8)]' : 'text-white/70 hover:bg-white/[0.06] hover:text-white',
              )
            }
          >
            <Icon className="size-4.5 shrink-0" aria-hidden />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto space-y-4">
        <PlanCard />
        <a href={`mailto:${SUPPORT_EMAIL}`} className="flex items-center gap-3 rounded-xl px-2 py-1.5 text-white/60 transition hover:text-white">
          <LifeBuoy className="size-4.5 shrink-0" aria-hidden />
          <span className="text-xs leading-snug">
            <span className="block font-semibold text-white/80">Need help?</span>
            Contact support
          </span>
        </a>
      </div>
    </div>
  )
}

/** Sends the search term to the menu page, which filters its item grid with it. */
function HeaderSearch() {
  const navigate = useNavigate()
  const [term, setTerm] = useState('')
  return (
    <form
      role="search"
      className="relative hidden w-full max-w-sm md:block"
      onSubmit={(event) => {
        event.preventDefault()
        if (!term.trim()) return
        navigate(`/dashboard/menu?q=${encodeURIComponent(term.trim())}`)
        setTerm('')
      }}
    >
      <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-muted" aria-hidden />
      <input
        type="search"
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder="Search menu items…"
        aria-label="Search menu items"
        className="h-10 w-full rounded-xl border border-line bg-surface/70 pr-3 pl-10 text-sm text-ink transition outline-none placeholder:text-ink-muted/80 focus:border-primary-500 focus:bg-white focus:ring-4 focus:ring-primary-100"
      />
    </form>
  )
}

function AccessBanner() {
  const { subscription, hasAccess } = useWorkspace()
  const location = useLocation()
  if (!subscription || hasAccess || location.pathname === '/dashboard/billing') return null
  return (
    <div role="alert" className="mb-6 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="flex items-start gap-3 text-sm text-amber-900">
        <TriangleAlert className="mt-0.5 size-5 shrink-0 text-amber-600" aria-hidden />
        <span>
          <span className="font-semibold">Your menu is offline.</span>{' '}
          {subscription.trialUsed ? 'Your trial or subscription has ended' : 'This restaurant has no active plan'} — guests can’t open your menu
          and editing is paused until you subscribe.
        </span>
      </p>
      <Button to="/dashboard/billing" size="sm" className="shrink-0">
        Choose a plan
      </Button>
    </div>
  )
}

function WorkspaceGate() {
  const { loading, error, reload, restaurant, subscription } = useWorkspace()
  if (loading && !(restaurant && subscription)) return <PageLoader label="Loading your workspace" />
  if (error && !(restaurant && subscription)) {
    return (
      <EmptyState
        icon={RefreshCw}
        title="We couldn't load your workspace"
        description={error}
        action={
          <Button onClick={reload} icon={RefreshCw}>
            Try again
          </Button>
        }
      />
    )
  }
  if (!restaurant) {
    return (
      <div className="card mx-auto max-w-md p-6 sm:p-8">
        <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary-50 text-primary-600">
          <Store className="size-6" aria-hidden />
        </span>
        <h1 className="mt-4 text-center text-xl font-bold text-ink">Create your restaurant</h1>
        <p className="mt-1 mb-6 text-center text-sm text-ink-muted">Add your restaurant to start building its digital menu and QR code.</p>
        <CreateRestaurantForm />
      </div>
    )
  }
  return (
    <>
      <AccessBanner />
      <Suspense fallback={<PageLoader />}>
        {/* Remount pages when switching restaurants so they load the right data. */}
        <Outlet key={restaurant.id} />
      </Suspense>
    </>
  )
}

function Shell() {
  const { user, logout } = useAuth()
  const { restaurant } = useWorkspace()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)

  useEffect(() => setMobileOpen(false), [location.pathname])

  useEffect(() => {
    if (!mobileOpen) return
    const onKey = (e) => e.key === 'Escape' && setMobileOpen(false)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [mobileOpen])

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  function openAddRestaurant() {
    setMobileOpen(false)
    setAddOpen(true)
  }

  return (
    <div className="min-h-screen bg-surface">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 bg-night-900 lg:block">
        <Sidebar onAddRestaurant={openAddRestaurant} />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <div className="absolute inset-0 animate-fade-in bg-night-950/60" onClick={() => setMobileOpen(false)} aria-hidden />
          <aside className="relative h-full w-72 max-w-[85vw] animate-slide-in bg-night-900 shadow-lift">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="absolute top-6 right-3 z-10 rounded-lg p-1.5 text-white/60 hover:bg-white/10 hover:text-white"
              aria-label="Close navigation"
            >
              <X className="size-5" />
            </button>
            <Sidebar onNavigate={() => setMobileOpen(false)} onAddRestaurant={openAddRestaurant} />
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-line bg-white/90 backdrop-blur-md">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="-ml-1.5 rounded-lg p-2 text-ink-soft hover:bg-surface lg:hidden"
              aria-label="Open navigation"
            >
              <MenuIcon className="size-5" />
            </button>
            <div className="md:hidden">
              <Logo to="/dashboard" className="[&>span]:hidden sm:[&>span]:inline" />
            </div>

            <HeaderSearch />

            <div className="ml-auto flex items-center gap-2">
              <span className="hidden h-10 items-center rounded-xl border border-line px-3.5 text-sm font-medium text-ink-soft sm:inline-flex">
                {formatDate(new Date())}
              </span>
              {restaurant && (
                <Button
                  href={`/m/${restaurant.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  variant="ghost"
                  size="icon"
                  aria-label="View live menu"
                  title="View live menu"
                >
                  <ExternalLink className="size-4.5" />
                </Button>
              )}
              <Dropdown
                items={[
                  { label: 'Account settings', icon: Settings, onClick: () => navigate('/dashboard/settings?tab=account') },
                  { label: 'Subscription', icon: CreditCard, onClick: () => navigate('/dashboard/billing') },
                  restaurant && { label: 'View live menu', icon: ExternalLink, onClick: () => window.open(`/m/${restaurant.slug}`, '_blank') },
                  { divider: true },
                  { label: 'Log out', icon: LogOut, onClick: handleLogout, danger: true },
                ]}
                trigger={({ toggle, open }) => (
                  <button
                    type="button"
                    onClick={toggle}
                    aria-expanded={open}
                    aria-haspopup="menu"
                    aria-label="Account menu"
                    className="flex items-center gap-2 rounded-full py-1 pr-2 pl-1 transition hover:bg-surface"
                  >
                    <Avatar name={user?.name} className="size-9" />
                    <span className="hidden max-w-32 truncate text-sm font-semibold text-ink xl:inline">{user?.name}</span>
                    <ChevronDown className="size-4 text-ink-muted" aria-hidden />
                  </button>
                )}
              />
            </div>
          </div>
        </header>

        <main className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto max-w-6xl">
            <WorkspaceGate />
          </div>
        </main>
      </div>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add a restaurant" description="Each restaurant gets its own menu, QR code and plan.">
        <CreateRestaurantForm submitLabel="Add restaurant" showTrialNote={false} onCreated={() => setAddOpen(false)} />
      </Modal>
    </div>
  )
}

export default function DashboardLayout() {
  return (
    <WorkspaceProvider>
      <Shell />
    </WorkspaceProvider>
  )
}
