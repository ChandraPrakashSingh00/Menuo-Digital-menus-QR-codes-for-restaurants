import { CalendarCheck, ChevronRight, Circle, CircleCheck, CirclePlus, CreditCard, Eye, QrCode, TrendingDown, TrendingUp } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../../components/layout/PageHeader'
import PerformanceChart from '../../components/menu/PerformanceChart'
import { Skeleton } from '../../components/ui/Spinner'
import { useAuth } from '../../context/AuthContext'
import { useWorkspace } from '../../context/WorkspaceContext'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { QR_DOWNLOADED_KEY } from '../../lib/constants'
import { cn, formatDate, formatNumber, getErrorMessage } from '../../lib/utils'
import { restaurantService } from '../../services/restaurant.service'

function greeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good Morning'
  if (hour < 17) return 'Good Afternoon'
  return 'Good Evening'
}

function Chip({ tone = 'good', icon: Icon, children }) {
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold',
        tone === 'good' && 'bg-primary-50 text-primary-700',
        tone === 'bad' && 'bg-red-50 text-red-700',
        tone === 'warn' && 'bg-amber-50 text-amber-800',
        tone === 'neutral' && 'bg-surface text-ink-soft',
      )}
    >
      {Icon && <Icon className="size-3.5 shrink-0" aria-hidden />}
      <span className="truncate">{children}</span>
    </span>
  )
}

function StatCard({ label, value, chip, loading }) {
  return (
    <div className="card p-5 sm:p-6">
      <p className="text-sm font-medium text-ink-muted">{label}</p>
      {loading ? <Skeleton className="mt-3 h-9 w-24" /> : <p className="mt-2 truncate text-3xl font-extrabold tracking-tight text-ink tabular-nums">{value}</p>}
      <div className="mt-3 min-h-6">{loading ? <Skeleton className="h-6 w-32 rounded-full" /> : chip}</div>
    </div>
  )
}

function subscriptionChip(subscription) {
  if (!subscription) return null
  const { status, hasAccess } = subscription
  if (!hasAccess) return <Chip tone="bad">Inactive — menu offline</Chip>
  if (status === 'trialing') return <Chip tone="warn" icon={CalendarCheck}>Trial ends {formatDate(subscription.trialEndsAt)}</Chip>
  if (status === 'past_due') return <Chip tone="bad">Payment due</Chip>
  if (subscription.cancelAtPeriodEnd || status === 'cancelled') {
    return <Chip tone="warn">Ends {formatDate(subscription.currentPeriodEnd || subscription.trialEndsAt)}</Chip>
  }
  return <Chip icon={CalendarCheck}>{subscription.currentPeriodEnd ? `Valid till ${formatDate(subscription.currentPeriodEnd)}` : 'Active'}</Chip>
}

function SetupChecklist({ stats, restaurant }) {
  let qrDone = false
  try {
    qrDone = localStorage.getItem(QR_DOWNLOADED_KEY) === '1'
  } catch {
    qrDone = false
  }
  const steps = [
    { label: 'Create your Menuo account', done: true },
    { label: 'Add your first category', done: stats.totals.categories > 0, to: '/dashboard/menu' },
    { label: 'Add at least 3 dishes', done: stats.totals.items >= 3, to: '/dashboard/menu' },
    { label: 'Complete your restaurant profile', done: Boolean(restaurant.description && restaurant.phone && restaurant.address), to: '/dashboard/settings' },
    { label: 'Download your QR code', done: qrDone, to: '/dashboard/qr' },
  ]
  const completed = steps.filter((s) => s.done).length
  if (completed === steps.length) return null

  return (
    <section className="card mt-6 overflow-hidden" aria-labelledby="setup-title">
      <div className="flex flex-col gap-4 border-b border-line p-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <h2 id="setup-title" className="text-base font-bold text-ink">
            Finish setting up your menu
          </h2>
          <p className="mt-0.5 text-sm text-ink-muted">
            {completed} of {steps.length} steps complete — you’re almost ready to welcome guests.
          </p>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-primary-100 sm:w-48" role="progressbar" aria-valuenow={completed} aria-valuemin={0} aria-valuemax={steps.length}>
          <div className="h-full rounded-full bg-primary-600 transition-all" style={{ width: `${(completed / steps.length) * 100}%` }} />
        </div>
      </div>
      <ul className="grid divide-y divide-line sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-5">
        {steps.map((step) => {
          const content = (
            <>
              {step.done ? <CircleCheck className="size-5 shrink-0 text-primary-600" aria-hidden /> : <Circle className="size-5 shrink-0 text-slate-300" aria-hidden />}
              <span className={cn('text-sm font-medium', step.done ? 'text-ink-muted line-through' : 'text-ink')}>{step.label}</span>
              <span className="sr-only">{step.done ? '(done)' : '(to do)'}</span>
            </>
          )
          return (
            <li key={step.label}>
              {step.done || !step.to ? (
                <div className="flex items-center gap-3 p-4">{content}</div>
              ) : (
                <Link to={step.to} className="flex items-center gap-3 p-4 transition hover:bg-surface">
                  {content}
                </Link>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export default function Overview() {
  useDocumentTitle('Dashboard')
  const { user } = useAuth()
  const { restaurant, plan, subscription } = useWorkspace()
  const [stats, setStats] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    restaurantService
      .stats(restaurant.id)
      .then(setStats)
      .catch((err) => setError(getErrorMessage(err)))
  }, [restaurant.id])

  const loading = !stats && !error
  const totals = stats?.totals

  const quickActions = [
    { label: 'Add Menu Item', icon: CirclePlus, to: '/dashboard/menu?new=item' },
    { label: 'Generate QR Code', icon: QrCode, to: '/dashboard/qr' },
    { label: 'View Menu', icon: Eye, href: `/m/${restaurant.slug}` },
    { label: 'Manage Subscription', icon: CreditCard, to: '/dashboard/billing' },
  ]

  return (
    <div className="animate-fade-in">
      <PageHeader title={`${greeting()}, ${user?.name?.split(' ')[0] || 'there'}! 👋`} description="Here’s what’s happening with your restaurant today." />

      {error && (
        <div role="alert" className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
        <StatCard
          label="Total Menu Items"
          loading={loading}
          value={formatNumber(totals?.items)}
          chip={totals && <Chip tone={totals.availableItems === totals.items ? 'good' : 'neutral'}>{totals.availableItems} available · {totals.items - totals.availableItems} sold out</Chip>}
        />
        <StatCard label="Active Subscription" value={`${plan.name} Plan`} chip={subscriptionChip(subscription)} />
        <StatCard
          label="Total Scans"
          loading={loading}
          value={formatNumber(totals?.viewsTotal)}
          chip={
            totals &&
            (totals.viewsChange != null ? (
              <Chip tone={totals.viewsChange >= 0 ? 'good' : 'bad'} icon={totals.viewsChange >= 0 ? TrendingUp : TrendingDown}>
                {totals.viewsChange >= 0 ? '+' : ''}
                {totals.viewsChange}% from last week
              </Chip>
            ) : (
              <Chip tone="neutral">{formatNumber(totals.views7d)} in the last 7 days</Chip>
            ))
          }
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_300px]">
        <section className="card min-w-0 p-5 sm:p-6" aria-labelledby="performance-title">
          <h2 id="performance-title" className="text-base font-bold text-ink">
            Menu Performance
          </h2>
          <p className="mt-0.5 text-sm text-ink-muted">Daily menu views, compared with last week</p>
          <div className="mt-4">{loading ? <Skeleton className="h-64 w-full" /> : <PerformanceChart data={stats?.viewsByDay || []} />}</div>
        </section>

        <section className="card p-5 sm:p-6" aria-labelledby="actions-title">
          <h2 id="actions-title" className="text-base font-bold text-ink">
            Quick Actions
          </h2>
          <ul className="mt-4 space-y-3">
            {quickActions.map(({ label, icon: Icon, to, href }) => {
              const className =
                'group flex items-center gap-3 rounded-xl border border-line bg-surface/60 px-4 py-3.5 text-sm font-semibold text-ink transition hover:border-primary-200 hover:bg-primary-50'
              const content = (
                <>
                  <Icon className="size-4.5 shrink-0 text-primary-600" aria-hidden />
                  <span className="flex-1">{label}</span>
                  <ChevronRight className="size-4 text-ink-muted transition group-hover:translate-x-0.5 group-hover:text-primary-600" aria-hidden />
                </>
              )
              return (
                <li key={label}>
                  {href ? (
                    <a href={href} target="_blank" rel="noreferrer" className={className}>
                      {content}
                    </a>
                  ) : (
                    <Link to={to} className={className}>
                      {content}
                    </Link>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      </div>

      {stats && <SetupChecklist stats={stats} restaurant={restaurant} />}
    </div>
  )
}
