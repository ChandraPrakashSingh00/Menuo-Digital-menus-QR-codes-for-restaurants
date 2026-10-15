import { ChevronDown, CircleX, Info, Receipt, RefreshCw, ShieldCheck } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import PricingCards from '../../components/landing/PricingCards'
import PageHeader from '../../components/layout/PageHeader'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import Dropdown from '../../components/ui/Dropdown'
import EmptyState from '../../components/ui/EmptyState'
import { Skeleton } from '../../components/ui/Spinner'
import { useWorkspace } from '../../context/WorkspaceContext'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { USE_MOCK } from '../../lib/api'
import { DEFAULT_BRAND_COLOR, TRIAL_CARD, getPlan } from '../../lib/constants'
import { cn, formatDate, formatPrice, getErrorMessage } from '../../lib/utils'
import { billingService } from '../../services/billing.service'

const RAZORPAY_CHECKOUT_SRC = 'https://checkout.razorpay.com/v1/checkout.js'

function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve(window.Razorpay)
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = RAZORPAY_CHECKOUT_SRC
    script.async = true
    script.onload = () => (window.Razorpay ? resolve(window.Razorpay) : reject(new Error('Razorpay failed to load.')))
    script.onerror = () => {
      script.remove()
      reject(new Error('Could not open the payment window. Check your connection and try again.'))
    }
    document.body.appendChild(script)
  })
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function daysLeft(date) {
  return Math.max(0, Math.ceil((new Date(date) - Date.now()) / 86400000))
}

function statusBadge(subscription) {
  const { status, hasAccess } = subscription
  if (status === 'trialing' && hasAccess) {
    const days = daysLeft(subscription.trialEndsAt)
    return { tone: 'warning', label: `Free trial · ${days} day${days === 1 ? '' : 's'} left` }
  }
  if (status === 'active' && subscription.cancelAtPeriodEnd) return { tone: 'warning', label: 'Cancels at period end' }
  if (status === 'active') return { tone: 'success', label: 'Active' }
  if (status === 'past_due' && hasAccess) return { tone: 'danger', label: 'Payment due' }
  if (status === 'cancelled' && hasAccess) return { tone: 'warning', label: 'Cancelled · access until period end' }
  return { tone: 'neutral', label: status === 'cancelled' ? 'Cancelled' : 'Inactive' }
}

function periodMessage(subscription) {
  const { status, hasAccess } = subscription
  const end = subscription.currentPeriodEnd
  if (!hasAccess) return 'Your menu is offline and editing is paused. Choose a plan above to bring it back.'
  if (status === 'trialing') return `Trial ends ${formatDate(subscription.trialEndsAt)} — subscribe before then to keep your menu online.`
  if (status === 'past_due') return 'Razorpay could not collect your last payment and will retry automatically.'
  if (status === 'cancelled' || subscription.cancelAtPeriodEnd) return `Ends ${formatDate(end || subscription.trialEndsAt)} and won’t renew.`
  return end ? `Valid till ${formatDate(end)} · renews monthly` : 'Renews monthly'
}

const PAYMENT_BADGE = {
  captured: { tone: 'success', label: 'Paid' },
  refunded: { tone: 'neutral', label: 'Refunded' },
  failed: { tone: 'danger', label: 'Failed' },
  authorized: { tone: 'warning', label: 'Processing' },
  created: { tone: 'warning', label: 'Pending' },
}

function UsageBar({ used, limit }) {
  const unlimited = limit == null || !Number.isFinite(limit)
  const percent = unlimited ? 0 : Math.min(100, (used / limit) * 100)
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-ink-muted">Menu items</span>
        <span className="font-semibold text-ink tabular-nums">
          {used} / {unlimited ? '∞' : limit}
        </span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className={cn('h-full rounded-full transition-all', percent >= 90 ? 'bg-amber-500' : 'bg-primary-600')}
          style={{ width: unlimited ? '6%' : `${percent}%` }}
        />
      </div>
    </div>
  )
}

export default function Billing() {
  useDocumentTitle('Subscription')
  const { restaurant, subscription, plan, usage, paymentsEnabled, setBilling, refreshBilling } = useWorkspace()
  const [payments, setPayments] = useState(null)
  const [busyPlan, setBusyPlan] = useState(null)
  const [confirmSwitch, setConfirmSwitch] = useState(null)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  const loadPayments = useCallback(() => {
    billingService
      .payments(restaurant.id)
      .then(setPayments)
      .catch(() => setPayments([]))
  }, [restaurant.id])

  useEffect(() => {
    refreshBilling().catch(() => {})
    loadPayments()
    // Refresh once when the page opens; later updates come from checkout/cancel responses.
  }, [])

  const paying = subscription.isPaid && ['active', 'past_due'].includes(subscription.status)
  const canCancel = (paying && !subscription.cancelAtPeriodEnd) || subscription.status === 'trialing'
  const badge = statusBadge(subscription)

  async function confirmPayment(target, response) {
    setBusyPlan(target.id)
    try {
      let next = await billingService.verify(restaurant.id, response)
      // The verified payment is applied from Razorpay's own records; give it a moment if it is not active yet.
      const activated = (summary) => summary.subscription.status === 'active' && summary.subscription.plan === target.id
      for (let attempt = 0; attempt < 5 && !activated(next); attempt++) {
        await wait(3000)
        next = await billingService.current(restaurant.id)
      }
      setBilling(next)
      loadPayments()
      if (activated(next)) toast.success(`You’re on ${target.name}. Thank you!`)
      else toast('Payment received — your plan activates as soon as Razorpay confirms it.', { icon: '⏳', duration: 6000 })
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setBusyPlan(null)
    }
  }

  async function startCheckout(target) {
    setConfirmSwitch(null)
    setBusyPlan(target.id)
    try {
      const session = await billingService.checkout(restaurant.id, target.id)
      const Razorpay = await loadRazorpay()
      const checkout = new Razorpay({
        key: session.keyId,
        subscription_id: session.subscriptionId,
        name: session.name,
        description: session.description,
        prefill: session.prefill,
        theme: { color: DEFAULT_BRAND_COLOR },
        handler: (response) => confirmPayment(target, response),
        modal: { ondismiss: () => setBusyPlan(null) },
      })
      checkout.on('payment.failed', (event) => {
        toast.error(event?.error?.description || 'The payment failed. Please try another method.')
      })
      checkout.open()
    } catch (error) {
      toast.error(getErrorMessage(error))
      setBusyPlan(null)
    }
  }

  async function cancelPlan() {
    setCancelling(true)
    try {
      const next = await billingService.cancel(restaurant.id)
      setBilling(next)
      setConfirmCancel(false)
      toast.success(next.subscription.cancelAtPeriodEnd ? 'Your plan will not renew.' : 'Your plan was cancelled.')
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setCancelling(false)
    }
  }

  function renderAction(target) {
    if (target.id === TRIAL_CARD.id) {
      const trialActive = subscription.status === 'trialing' && subscription.hasAccess
      return (
        <Button variant="outline-primary" className="w-full rounded-full" disabled>
          {trialActive ? `Active · ${daysLeft(subscription.trialEndsAt)} days left` : 'Trial already used'}
        </Button>
      )
    }
    if (paying && target.id === subscription.plan && !subscription.cancelAtPeriodEnd) {
      return (
        <Button variant="outline-primary" className="w-full rounded-full" disabled>
          Current plan
        </Button>
      )
    }
    const label = !paying ? 'Choose Plan' : target.id === subscription.plan ? `Resubscribe to ${target.name}` : `Switch to ${target.name}`
    return (
      <Button
        className="w-full rounded-full"
        disabled={!paymentsEnabled || Boolean(busyPlan)}
        loading={busyPlan === target.id}
        onClick={() => (paying ? setConfirmSwitch(target) : startCheckout(target))}
      >
        {label}
      </Button>
    )
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Choose Your Plan"
        description="Flexible plans for every restaurant."
        actions={
          <p className="flex items-center gap-1.5 text-sm text-ink-muted">
            <ShieldCheck className="size-4 text-primary-600" aria-hidden />
            Secure recurring payments by Razorpay
          </p>
        }
      />

      {!paymentsEnabled && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-line bg-white p-4 text-sm text-ink-soft">
          <Info className="mt-0.5 size-4.5 shrink-0 text-primary-600" aria-hidden />
          {USE_MOCK
            ? 'Payments are disabled in demo mode. Connect the real backend with Razorpay test keys to try checkout.'
            : 'Online payments are not set up yet. Please contact support to activate a plan.'}
        </div>
      )}

      <section aria-label="Plans">
        <PricingCards currentPlanId={paying ? subscription.plan : null} renderAction={renderAction} />
      </section>

      <section className="card mx-auto mt-8 max-w-5xl" aria-labelledby="current-plan-title">
        <div className="flex flex-col gap-5 p-5 sm:p-6 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <p id="current-plan-title" className="text-sm font-semibold text-ink">
              Your Current Plan
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <span className="text-lg font-bold text-primary-700">{plan.name} Plan</span>
              <Badge tone={badge.tone}>{badge.label}</Badge>
            </div>
            <p className="mt-1 text-sm text-ink-muted">{periodMessage(subscription)}</p>
          </div>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center md:shrink-0">
            <div className="sm:w-44">{usage ? <UsageBar used={usage.items} limit={usage.itemLimit} /> : <Skeleton className="h-8" />}</div>
            <Dropdown
              items={[
                { label: 'Refresh status', icon: RefreshCw, onClick: () => refreshBilling().catch(() => toast.error('Could not refresh your plan')) },
                canCancel && { divider: true },
                canCancel && { label: 'Cancel plan', icon: CircleX, danger: true, onClick: () => setConfirmCancel(true) },
              ]}
              trigger={({ toggle, open }) => (
                <Button variant="outline-primary" iconRight={ChevronDown} onClick={toggle} aria-haspopup="menu" aria-expanded={open}>
                  Manage Subscription
                </Button>
              )}
            />
          </div>
        </div>
        {subscription.pendingPlan && (
          <div className="flex flex-col gap-3 border-t border-line bg-primary-50/50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p className="text-sm text-primary-800">
              A checkout for <span className="font-semibold">{getPlan(subscription.pendingPlan).name}</span> was started. If you completed the payment,
              it can take a minute to confirm.
            </p>
            <Button size="sm" variant="outline" icon={RefreshCw} onClick={() => refreshBilling().catch(() => {})}>
              Refresh
            </Button>
          </div>
        )}
      </section>

      <section className="card mx-auto mt-6 max-w-5xl" aria-labelledby="payments-title">
        <h2 id="payments-title" className="border-b border-line px-5 py-4 text-base font-bold text-ink sm:px-6">
          Payment history
        </h2>
        {payments === null ? (
          <div className="space-y-3 p-6">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
        ) : payments.length ? (
          <ul className="divide-y divide-line">
            {payments.slice(0, 6).map((payment) => {
              const status = PAYMENT_BADGE[payment.status] || PAYMENT_BADGE.created
              return (
                <li key={payment.id} className="flex items-center gap-3 px-5 py-3.5 sm:px-6">
                  <span className="flex size-9 items-center justify-center rounded-xl bg-surface text-ink-muted">
                    <Receipt className="size-4" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink">{getPlan(payment.plan).name} plan</p>
                    <p className="truncate text-xs text-ink-muted">
                      {formatDate(payment.paidAt || payment.createdAt)} · {payment.gatewayPaymentId}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-ink tabular-nums">{formatPrice(payment.amount / 100, payment.currency)}</p>
                    <Badge tone={status.tone} className="mt-0.5">
                      {status.label}
                    </Badge>
                  </div>
                </li>
              )
            })}
          </ul>
        ) : (
          <EmptyState icon={Receipt} title="No payments yet" description="Payments appear here once you subscribe to a plan." className="py-10" />
        )}
      </section>

      <ConfirmDialog
        open={Boolean(confirmSwitch)}
        onClose={() => setConfirmSwitch(null)}
        onConfirm={() => startCheckout(confirmSwitch)}
        tone="primary"
        title={`Switch to ${confirmSwitch?.name}?`}
        description="A new monthly subscription starts as soon as the payment succeeds, and your current plan is cancelled at the same time. Unused days of the current plan are not refunded."
        confirmLabel="Continue to payment"
      />
      <ConfirmDialog
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        onConfirm={cancelPlan}
        loading={cancelling}
        title="Cancel your plan?"
        description={
          subscription.status === 'trialing'
            ? 'Your trial stays active until it ends, then your menu goes offline unless you subscribe.'
            : 'You keep access until the end of the period you’ve paid for. After that your menu goes offline.'
        }
        confirmLabel="Cancel plan"
      />
    </div>
  )
}
