import crypto from 'node:crypto'
import { config } from '../config/env.js'
import { PLANS, getPlan } from '../config/plans.js'
import MenuItem from '../models/MenuItem.js'
import Payment from '../models/Payment.js'
import Subscription from '../models/Subscription.js'
import User from '../models/User.js'
import WebhookEvent from '../models/WebhookEvent.js'
import { ApiError } from '../utils/ApiError.js'
import { addDays, isDuplicateKeyError, isObjectId } from '../utils/helpers.js'
import * as payments from './paymentService.js'

const DAY_MS = 86400000
const graceMs = () => config.paymentGraceDays * DAY_MS
const toDate = (unixSeconds) => (unixSeconds ? new Date(unixSeconds * 1000) : null)

// ---------------------------------------------------------------------------
// Access rules
// ---------------------------------------------------------------------------

/** Whether the restaurant may use paid features right now (edit menu, public menu online). */
export function computeAccess(sub, now = new Date()) {
  if (!sub) return false
  const t = now.getTime()
  const end = sub.currentPeriodEnd ? sub.currentPeriodEnd.getTime() : null
  switch (sub.status) {
    case 'trialing':
      return Boolean(sub.trialEndsAt) && sub.trialEndsAt.getTime() > t
    case 'active':
      // Grace covers renewal webhooks that arrive a little after the period ends.
      return end === null || end + graceMs() > t
    case 'past_due':
      return end !== null && end + graceMs() > t
    case 'cancelled':
      // Already paid (or trial) time is honoured until the period ends.
      return end !== null && end > t
    default:
      return false
  }
}

function nextLifecycleStatus(sub, now) {
  const t = now.getTime()
  const end = sub.currentPeriodEnd ? sub.currentPeriodEnd.getTime() : null
  if (sub.status === 'trialing' && (!sub.trialEndsAt || sub.trialEndsAt.getTime() <= t)) return 'expired'
  if (sub.status === 'active' && end !== null && end <= t) return 'past_due'
  if (sub.status === 'past_due' && (end === null || end + graceMs() <= t)) return 'expired'
  return sub.status
}

/** Applies time-based transitions (trial ended, renewal overdue, grace over) and persists them. */
export async function syncLifecycle(sub, now = new Date()) {
  let current = sub
  for (let i = 0; i < 3; i++) {
    const next = nextLifecycleStatus(current, now)
    if (next === current.status) return current
    // Conditional on the old status so a webhook that changed it concurrently wins.
    const updated = await Subscription.findOneAndUpdate(
      { _id: current._id, status: current.status },
      { $set: { status: next } },
      { returnDocument: 'after' },
    )
    current = updated || (await Subscription.findById(current._id))
  }
  return current
}

function inactiveMessage(sub) {
  switch (sub.status) {
    case 'trialing':
    case 'expired':
      return sub.trialStartedAt
        ? 'Your free trial or subscription has ended. Choose a plan to keep editing your menu.'
        : 'Choose a plan to start building your menu.'
    case 'past_due':
      return 'Your last payment did not go through. Renew your plan to keep editing your menu.'
    case 'cancelled':
      return 'Your subscription has ended. Subscribe again to keep editing your menu.'
    default:
      return 'An active subscription is required for this action.'
  }
}

export function assertHasAccess(sub) {
  if (!computeAccess(sub)) throw ApiError.paymentRequired(inactiveMessage(sub))
}

function planLimitError(plan) {
  return new ApiError(403, `Your ${plan.name} plan allows up to ${plan.itemLimit} menu items. Upgrade to Pro for unlimited items.`, {
    code: 'PLAN_LIMIT_REACHED',
  })
}

/** Cheap pre-check before inserting `adding` new items. */
export async function assertCanAddItems(restaurantId, sub, adding = 1) {
  const plan = getPlan(sub.plan)
  if (plan.itemLimit == null) return
  const count = await MenuItem.countDocuments({ restaurantId })
  if (count + adding > plan.itemLimit) throw planLimitError(plan)
}

/**
 * Race-safe limit check after an insert: an item is kept only if fewer than `limit`
 * items of the restaurant were created before it (ObjectIds give a total order).
 * Two parallel requests at 49/50 items therefore leave exactly 50.
 */
export async function enforceItemLimitAfterInsert(restaurantId, sub, item) {
  const plan = getPlan(sub.plan)
  if (plan.itemLimit == null) return
  const before = await MenuItem.countDocuments({ restaurantId, _id: { $lt: item._id } })
  if (before >= plan.itemLimit) {
    await MenuItem.deleteOne({ _id: item._id })
    throw planLimitError(plan)
  }
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

/**
 * Creates the subscription record for a brand-new restaurant. The first restaurant of an
 * owner gets a TRIAL_DAYS trial; later restaurants (and owners who already used theirs)
 * start without access until they subscribe. trialUsedAt is claimed atomically.
 */
export async function createInitialSubscription({ restaurant, planId = 'starter' }) {
  const now = new Date()
  let trial = false
  if (config.trialDays > 0) {
    const claimed = await User.findOneAndUpdate({ _id: restaurant.ownerId, trialUsedAt: null }, { $set: { trialUsedAt: now } })
    trial = Boolean(claimed)
  }
  try {
    return await Subscription.create({
      restaurantId: restaurant._id,
      ownerId: restaurant.ownerId,
      plan: planId,
      status: trial ? 'trialing' : 'expired',
      trialStartedAt: trial ? now : null,
      trialEndsAt: trial ? addDays(now, config.trialDays) : null,
    })
  } catch (error) {
    if (trial) await User.updateOne({ _id: restaurant.ownerId, trialUsedAt: now }, { $set: { trialUsedAt: null } })
    throw error
  }
}

/** Loads (or lazily creates) the restaurant's subscription with up-to-date status. */
export async function getSubscription(restaurant) {
  let sub = await Subscription.findOne({ restaurantId: restaurant._id })
  if (!sub) {
    try {
      sub = await Subscription.create({ restaurantId: restaurant._id, ownerId: restaurant.ownerId, plan: 'starter', status: 'expired' })
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error
      sub = await Subscription.findOne({ restaurantId: restaurant._id })
    }
  }
  return syncLifecycle(sub)
}

export function serializeSubscription(sub, now = new Date()) {
  return {
    id: String(sub._id),
    restaurantId: String(sub.restaurantId),
    plan: sub.plan,
    status: sub.status,
    hasAccess: computeAccess(sub, now),
    trialUsed: Boolean(sub.trialStartedAt),
    trialStartedAt: sub.trialStartedAt,
    trialEndsAt: sub.trialEndsAt,
    currentPeriodStart: sub.currentPeriodStart,
    currentPeriodEnd: sub.currentPeriodEnd,
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    cancelledAt: sub.cancelledAt,
    isPaid: Boolean(sub.gatewaySubscriptionId),
    pendingPlan: sub.pendingGatewaySubscriptionId ? sub.pendingPlan : null,
    updatedAt: sub.updatedAt,
  }
}

// ---------------------------------------------------------------------------
// Checkout (Razorpay Subscriptions)
// ---------------------------------------------------------------------------

function assertPaymentsConfigured() {
  if (!payments.isConfigured()) {
    throw ApiError.unavailable('Online payments are not configured yet. Please contact support.', { code: 'PAYMENTS_NOT_CONFIGURED' })
  }
}

/** Creates a Razorpay subscription and returns what Checkout.js needs. Grants nothing by itself. */
export async function startCheckout({ restaurant, user, planId }) {
  assertPaymentsConfigured()
  const plan = PLANS[planId]
  const sub = await getSubscription(restaurant)

  const paying = Boolean(sub.gatewaySubscriptionId) && ['active', 'past_due'].includes(sub.status)
  if (paying && sub.plan === planId && !sub.cancelAtPeriodEnd) {
    throw ApiError.conflict(`You are already subscribed to the ${plan.name} plan.`, { code: 'ALREADY_SUBSCRIBED' })
  }

  const gatewaySub = await payments.createSubscription({
    gatewayPlanId: payments.gatewayPlanIdFor(planId),
    // Unpaid checkouts expire after a day so an abandoned one can't be paid much later.
    expireBy: Math.floor(Date.now() / 1000) + 86400,
    notes: { restaurantId: String(restaurant._id), plan: planId },
  })

  await Subscription.updateOne({ _id: sub._id }, { $set: { pendingGatewaySubscriptionId: gatewaySub.id, pendingPlan: planId } })

  return {
    provider: 'razorpay',
    keyId: payments.publicKeyId(),
    subscriptionId: gatewaySub.id,
    plan: planId,
    amount: plan.amount,
    currency: plan.currency,
    name: 'Menuo',
    description: `${plan.name} plan · billed monthly`,
    prefill: { name: user.name, email: user.email },
  }
}

/**
 * Called by the browser after Checkout.js succeeds. The signature is checked, then the
 * subscription is fetched from Razorpay and its real status applied — the browser's
 * "success" alone never activates anything.
 */
export async function confirmCheckout({ restaurant, paymentId, subscriptionId, signature }) {
  assertPaymentsConfigured()
  const sub = await getSubscription(restaurant)
  if (![sub.pendingGatewaySubscriptionId, sub.gatewaySubscriptionId].includes(subscriptionId)) {
    throw ApiError.badRequest('This payment does not belong to this restaurant.', { code: 'PAYMENT_MISMATCH' })
  }
  if (!payments.verifyCheckoutSignature({ paymentId, subscriptionId, signature })) {
    throw ApiError.badRequest('Payment verification failed.', { code: 'INVALID_SIGNATURE' })
  }
  const entity = await payments.fetchSubscription(subscriptionId)
  await applyGatewaySubscription(entity)
  return getSubscription(restaurant)
}

export async function cancelSubscription({ restaurant }) {
  const sub = await getSubscription(restaurant)
  const now = new Date()

  if (sub.gatewaySubscriptionId && ['active', 'past_due'].includes(sub.status)) {
    if (sub.cancelAtPeriodEnd) return sub
    if (sub.status === 'active') {
      // Keep access until the paid period ends; Razorpay sends subscription.cancelled then.
      await payments.cancelSubscription(sub.gatewaySubscriptionId, { atCycleEnd: true })
      await Subscription.updateOne({ _id: sub._id }, { $set: { cancelAtPeriodEnd: true, pendingGatewaySubscriptionId: null, pendingPlan: null } })
    } else {
      await payments.cancelSubscription(sub.gatewaySubscriptionId, { atCycleEnd: false })
      await Subscription.updateOne(
        { _id: sub._id },
        { $set: { status: 'cancelled', cancelledAt: now, cancelAtPeriodEnd: false, pendingGatewaySubscriptionId: null, pendingPlan: null } },
      )
    }
  } else if (sub.status === 'trialing') {
    await Subscription.updateOne(
      { _id: sub._id },
      {
        $set: {
          status: 'cancelled',
          cancelledAt: now,
          currentPeriodEnd: sub.trialEndsAt, // trial time already granted is kept
          pendingGatewaySubscriptionId: null,
          pendingPlan: null,
        },
      },
    )
  } else {
    throw ApiError.conflict('There is no active subscription to cancel.', { code: 'NOTHING_TO_CANCEL' })
  }
  return getSubscription(restaurant)
}

// ---------------------------------------------------------------------------
// Gateway state → local state
// ---------------------------------------------------------------------------

// Razorpay subscription status -> our status. created/authenticated leave it unchanged.
const GATEWAY_STATUS_MAP = {
  active: 'active',
  pending: 'past_due',
  halted: 'past_due',
  paused: 'past_due',
  cancelled: 'cancelled',
  completed: 'expired',
  expired: 'expired',
}
const GATEWAY_TERMINAL = ['cancelled', 'completed', 'expired', 'halted']

async function findSubscriptionForGateway(entity) {
  let sub = await Subscription.findOne({
    $or: [{ gatewaySubscriptionId: entity.id }, { pendingGatewaySubscriptionId: entity.id }],
  })
  // A checkout started in another tab may no longer be the "pending" one; our server set
  // notes.restaurantId when creating it, so it can still be matched once it is paid.
  if (!sub && entity.status === 'active' && isObjectId(entity.notes?.restaurantId)) {
    sub = await Subscription.findOne({ restaurantId: entity.notes.restaurantId })
  }
  if (sub?.supersededGatewaySubscriptionIds?.includes(entity.id)) return null
  return sub
}

/** Applies a Razorpay subscription entity (from a verified webhook or a server-side fetch). */
export async function applyGatewaySubscription(entity, { eventAt = null } = {}) {
  if (!entity?.id) return null
  const sub = await findSubscriptionForGateway(entity)
  if (!sub) return null

  const periodStart = toDate(entity.current_start)
  const periodEnd = toDate(entity.current_end)
  const gatewayPlan = payments.planIdForGatewayPlan(entity.plan_id)

  if (sub.gatewaySubscriptionId !== entity.id) {
    // A new checkout: it only takes over once Razorpay reports it active (first charge done).
    if (entity.status === 'active') {
      const previous = sub.gatewaySubscriptionId
      sub.set({
        gatewaySubscriptionId: entity.id,
        gatewayStatus: entity.status,
        plan: gatewayPlan || sub.pendingPlan || sub.plan,
        status: 'active',
        currentPeriodStart: periodStart || new Date(),
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
        cancelledAt: null,
        pendingGatewaySubscriptionId: null,
        pendingPlan: null,
        gatewayEventAt: eventAt,
      })
      if (previous) sub.supersededGatewaySubscriptionIds.push(previous)
      await sub.save()
      // Plan change: stop billing the old subscription (no proration — see README).
      if (previous) {
        payments.cancelSubscription(previous, { atCycleEnd: false }).catch((error) => {
          console.error(`[billing] could not cancel superseded subscription ${previous}:`, error.message)
        })
      }
    } else if (GATEWAY_TERMINAL.includes(entity.status) && sub.pendingGatewaySubscriptionId === entity.id) {
      sub.set({ pendingGatewaySubscriptionId: null, pendingPlan: null })
      await sub.save()
    }
    return sub
  }

  // Event for the current subscription. Ignore deliveries older than what we already applied.
  if (eventAt && sub.gatewayEventAt && eventAt < sub.gatewayEventAt) return sub

  const mapped = GATEWAY_STATUS_MAP[entity.status]
  if (mapped) sub.status = mapped
  if (entity.status === 'cancelled') {
    sub.cancelAtPeriodEnd = false
    sub.cancelledAt = sub.cancelledAt || new Date()
  }
  if (periodStart) sub.currentPeriodStart = periodStart
  if (periodEnd) sub.currentPeriodEnd = periodEnd
  if (gatewayPlan) sub.plan = gatewayPlan
  sub.gatewayStatus = entity.status
  if (eventAt) sub.gatewayEventAt = eventAt
  await sub.save()
  return sub
}

const PAYMENT_RANK = { created: 0, authorized: 1, failed: 2, captured: 3, refunded: 4 }

/** Upserts a Payment from a Razorpay payment entity. Idempotent per gateway payment id. */
export async function recordGatewayPayment(paymentEntity, gatewaySubscriptionId) {
  const p = paymentEntity
  if (!p?.id || !gatewaySubscriptionId || !(p.status in PAYMENT_RANK)) return null

  const sub = await Subscription.findOne({
    $or: [
      { gatewaySubscriptionId },
      { pendingGatewaySubscriptionId: gatewaySubscriptionId },
      { supersededGatewaySubscriptionIds: gatewaySubscriptionId },
    ],
  })
  if (!sub) return null

  const existing = await Payment.findOne({ gatewayPaymentId: p.id })
  if (existing && PAYMENT_RANK[existing.status] > PAYMENT_RANK[p.status]) return existing

  const fields = {
    restaurantId: sub.restaurantId,
    subscriptionId: sub._id,
    ownerId: sub.ownerId,
    plan: sub.gatewaySubscriptionId === gatewaySubscriptionId ? sub.plan : sub.pendingPlan || sub.plan,
    gateway: 'razorpay',
    gatewaySubscriptionId,
    gatewayInvoiceId: p.invoice_id || null,
    gatewayOrderId: p.order_id || null,
    amount: Number(p.amount) || 0,
    currency: p.currency || 'INR',
    status: p.status,
    method: typeof p.method === 'string' ? p.method : null,
    errorCode: p.error_code || null,
    errorDescription: p.error_description ? String(p.error_description).slice(0, 300) : null,
    paidAt: p.status === 'captured' ? toDate(p.created_at) || new Date() : existing?.paidAt || null,
  }

  const upsert = () =>
    Payment.findOneAndUpdate({ gatewayPaymentId: p.id }, { $set: fields }, { upsert: true, returnDocument: 'after', runValidators: true })
  try {
    return await upsert()
  } catch (error) {
    if (isDuplicateKeyError(error)) return upsert() // parallel duplicate delivery
    throw error
  }
}

// ---------------------------------------------------------------------------
// Webhooks
// ---------------------------------------------------------------------------

const SUBSCRIPTION_EVENTS = new Set([
  'subscription.authenticated',
  'subscription.activated',
  'subscription.charged',
  'subscription.pending',
  'subscription.halted',
  'subscription.cancelled',
  'subscription.completed',
  'subscription.paused',
  'subscription.resumed',
  'subscription.updated',
])

async function claimWebhookEvent(eventId, event) {
  try {
    return await WebhookEvent.create({ provider: 'razorpay', eventId, event, status: 'processing' })
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error
    // Already seen. Only a delivery that failed earlier (or got stuck) may be processed again.
    const staleBefore = new Date(Date.now() - 5 * 60000)
    return WebhookEvent.findOneAndUpdate(
      { provider: 'razorpay', eventId, $or: [{ status: 'failed' }, { status: 'processing', updatedAt: { $lt: staleBefore } }] },
      { $set: { status: 'processing', error: null } },
      { returnDocument: 'after' },
    )
  }
}

async function handleWebhookEvent(event) {
  const eventAt = event.created_at ? new Date(event.created_at * 1000) : null
  const subscriptionEntity = event.payload?.subscription?.entity
  const paymentEntity = event.payload?.payment?.entity

  if (SUBSCRIPTION_EVENTS.has(event.event)) {
    const sub = await applyGatewaySubscription(subscriptionEntity, { eventAt })
    if (paymentEntity) await recordGatewayPayment(paymentEntity, subscriptionEntity?.id)
    return Boolean(sub)
  }
  if (event.event === 'payment.failed' || event.event === 'payment.captured') {
    // Only payments we can link to one of our subscriptions are recorded.
    return Boolean(await recordGatewayPayment(paymentEntity, paymentEntity?.subscription_id))
  }
  return false
}

/**
 * Verifies and processes one Razorpay webhook delivery.
 * `rawBody` must be the untouched request bytes — the signature is computed over them.
 */
export async function processRazorpayWebhook({ rawBody, signature, eventId }) {
  if (!payments.isWebhookConfigured()) {
    throw ApiError.unavailable('Payment webhooks are not configured.', { code: 'PAYMENTS_NOT_CONFIGURED' })
  }
  if (!payments.verifyWebhookSignature(rawBody, signature)) {
    throw ApiError.badRequest('Invalid webhook signature.', { code: 'INVALID_SIGNATURE' })
  }

  let event
  try {
    event = JSON.parse(rawBody.toString('utf8'))
  } catch {
    throw ApiError.badRequest('Malformed webhook payload.')
  }
  if (typeof event?.event !== 'string') throw ApiError.badRequest('Malformed webhook payload.')

  const id = eventId || crypto.createHash('sha256').update(rawBody).digest('hex')
  const claim = await claimWebhookEvent(id, event.event)
  if (!claim) return { duplicate: true, handled: false }

  try {
    const handled = await handleWebhookEvent(event)
    await WebhookEvent.updateOne({ _id: claim._id }, { $set: { status: handled ? 'processed' : 'ignored', error: null } })
    return { duplicate: false, handled }
  } catch (error) {
    await WebhookEvent.updateOne({ _id: claim._id }, { $set: { status: 'failed', error: String(error.message).slice(0, 500) } })
    throw error
  }
}
