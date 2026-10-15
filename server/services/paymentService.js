// Thin Razorpay Subscriptions client (REST API, no SDK) plus signature helpers.
// Docs: https://razorpay.com/docs/api/payments/subscriptions/
//
// If the RAZORPAY_* variables are missing, isConfigured() returns false and every
// checkout attempt fails with 503 PAYMENTS_NOT_CONFIGURED. Nothing is ever simulated.

import crypto from 'node:crypto'
import { config } from '../config/env.js'
import { ApiError } from '../utils/ApiError.js'

const rp = config.razorpay

export function isConfigured() {
  return Boolean(rp.keyId && rp.keySecret && rp.planIds.starter && rp.planIds.pro)
}

export function isWebhookConfigured() {
  return Boolean(rp.webhookSecret)
}

export function publicKeyId() {
  return rp.keyId
}

export function gatewayPlanIdFor(planId) {
  return rp.planIds[planId] || null
}

/** Maps a Razorpay plan_id back to our plan id, or null when it is not one of ours. */
export function planIdForGatewayPlan(gatewayPlanId) {
  const match = Object.entries(rp.planIds).find(([, id]) => id && id === gatewayPlanId)
  return match ? match[0] : null
}

function safeEqualHex(expected, received) {
  if (typeof received !== 'string' || !/^[a-f0-9]+$/i.test(received)) return false
  const a = Buffer.from(expected, 'hex')
  const b = Buffer.from(received, 'hex')
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

function hmacHex(secret, payload) {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex')
}

/**
 * Verifies the signature Checkout.js returns after a subscription payment:
 * HMAC_SHA256(razorpay_payment_id + "|" + razorpay_subscription_id, key_secret).
 */
export function verifyCheckoutSignature({ paymentId, subscriptionId, signature }) {
  if (!rp.keySecret) return false
  return safeEqualHex(hmacHex(rp.keySecret, `${paymentId}|${subscriptionId}`), signature)
}

/** Verifies X-Razorpay-Signature against the exact raw request body bytes. */
export function verifyWebhookSignature(rawBody, signature) {
  if (!rp.webhookSecret || !Buffer.isBuffer(rawBody)) return false
  return safeEqualHex(hmacHex(rp.webhookSecret, rawBody), signature)
}

async function request(method, path, body) {
  if (!isConfigured()) {
    throw ApiError.unavailable('Online payments are not configured yet. Please contact support.', { code: 'PAYMENTS_NOT_CONFIGURED' })
  }
  const auth = Buffer.from(`${rp.keyId}:${rp.keySecret}`).toString('base64')
  let response
  try {
    response = await fetch(`${rp.apiBase}${path}`, {
      method,
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15000),
    })
  } catch (error) {
    console.error('[razorpay] request failed', method, path, error.message)
    throw ApiError.unavailable('The payment provider could not be reached. Please try again.', { code: 'PAYMENT_PROVIDER_ERROR' })
  }

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    // Log the provider's description server-side; return a generic message to the client.
    console.error('[razorpay] error', response.status, method, path, data?.error?.code, data?.error?.description)
    throw new ApiError(502, 'The payment provider rejected the request. Please try again or contact support.', {
      code: 'PAYMENT_PROVIDER_ERROR',
    })
  }
  return data
}

export function createSubscription({ gatewayPlanId, notes, expireBy }) {
  return request('POST', '/subscriptions', {
    plan_id: gatewayPlanId,
    total_count: rp.totalCount,
    quantity: 1,
    customer_notify: 1,
    expire_by: expireBy,
    notes,
  })
}

export function fetchSubscription(gatewaySubscriptionId) {
  return request('GET', `/subscriptions/${encodeURIComponent(gatewaySubscriptionId)}`)
}

export function cancelSubscription(gatewaySubscriptionId, { atCycleEnd }) {
  return request('POST', `/subscriptions/${encodeURIComponent(gatewaySubscriptionId)}/cancel`, {
    cancel_at_cycle_end: atCycleEnd ? 1 : 0,
  })
}
