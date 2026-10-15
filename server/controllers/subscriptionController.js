import { config } from '../config/env.js'
import { PLAN_IDS, getPlan, publicPlan } from '../config/plans.js'
import MenuItem from '../models/MenuItem.js'
import Payment from '../models/Payment.js'
import { findOwnedRestaurant } from '../services/ownershipService.js'
import * as payments from '../services/paymentService.js'
import {
  cancelSubscription,
  confirmCheckout,
  getSubscription,
  processRazorpayWebhook,
  serializeSubscription,
  startCheckout,
} from '../services/subscriptionService.js'
import { paginate, paginationMeta } from '../utils/helpers.js'

async function subscriptionSummary(restaurant, subscription) {
  const items = await MenuItem.countDocuments({ restaurantId: restaurant._id })
  return {
    subscription: serializeSubscription(subscription),
    plan: publicPlan(subscription.plan),
    usage: { items, itemLimit: getPlan(subscription.plan).itemLimit },
    paymentsEnabled: payments.isConfigured(),
  }
}

function serializePayment(payment) {
  return {
    id: payment.id,
    plan: payment.plan,
    amount: payment.amount,
    currency: payment.currency,
    status: payment.status,
    method: payment.method,
    gatewayPaymentId: payment.gatewayPaymentId,
    gatewayInvoiceId: payment.gatewayInvoiceId,
    errorDescription: payment.errorDescription,
    paidAt: payment.paidAt,
    createdAt: payment.createdAt,
  }
}

/** GET /api/subscriptions/plans (public) */
export function listPlans(req, res) {
  res.json({
    plans: PLAN_IDS.map(publicPlan),
    trialDays: config.trialDays,
    paymentsEnabled: payments.isConfigured(),
  })
}

/** GET /api/subscriptions/current?restaurantId= */
export async function getCurrentSubscription(req, res) {
  const restaurant = await findOwnedRestaurant(req.valid.query.restaurantId, req.user._id)
  const subscription = await getSubscription(restaurant)
  res.json(await subscriptionSummary(restaurant, subscription))
}

/** GET /api/subscriptions/payments?restaurantId=&page=&limit= */
export async function listPayments(req, res) {
  const { restaurantId, ...pageQuery } = req.valid.query
  const restaurant = await findOwnedRestaurant(restaurantId, req.user._id)
  const { page, limit, skip } = paginate(pageQuery)
  const filter = { restaurantId: restaurant._id }
  const [list, total] = await Promise.all([
    Payment.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Payment.countDocuments(filter),
  ])
  res.json({ payments: list.map(serializePayment), pagination: paginationMeta({ page, limit, total }) })
}

/** POST /api/subscriptions/checkout { restaurantId, plan } */
export async function checkout(req, res) {
  const restaurant = await findOwnedRestaurant(req.valid.body.restaurantId, req.user._id)
  const session = await startCheckout({ restaurant, user: req.user, planId: req.valid.body.plan })
  res.status(201).json({ checkout: session })
}

/** POST /api/subscriptions/verify — Checkout.js handler payload */
export async function verifyCheckout(req, res) {
  const { restaurantId, razorpay_payment_id, razorpay_subscription_id, razorpay_signature } = req.valid.body
  const restaurant = await findOwnedRestaurant(restaurantId, req.user._id)
  const subscription = await confirmCheckout({
    restaurant,
    paymentId: razorpay_payment_id,
    subscriptionId: razorpay_subscription_id,
    signature: razorpay_signature,
  })
  res.json(await subscriptionSummary(restaurant, subscription))
}

/** POST /api/subscriptions/cancel { restaurantId } */
export async function cancel(req, res) {
  const restaurant = await findOwnedRestaurant(req.valid.body.restaurantId, req.user._id)
  const subscription = await cancelSubscription({ restaurant })
  res.json(await subscriptionSummary(restaurant, subscription))
}

/** POST /api/webhooks/razorpay — req.body is the raw Buffer (see routes/webhookRoutes.js). */
export async function razorpayWebhook(req, res) {
  const result = await processRazorpayWebhook({
    rawBody: req.body,
    signature: req.get('x-razorpay-signature'),
    eventId: req.get('x-razorpay-event-id'),
  })
  res.json({ received: true, duplicate: result.duplicate })
}
