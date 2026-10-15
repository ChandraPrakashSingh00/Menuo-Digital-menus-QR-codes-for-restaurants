import './razorpayEnv.js'
import { app, itemPayload, mongoose, ownerWithRestaurant, request, useTestDatabase } from './helpers.js'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { afterEach, beforeEach, describe, test } from 'node:test'

useTestDatabase()

const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET
const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET
const Payment = () => mongoose.model('Payment')

// ---- fake Razorpay REST API (only global fetch is replaced; no network) ----
const gateway = new Map()
const realFetch = globalThis.fetch
let seq = 0
let calls = []

function fakeFetch(url, options = {}) {
  calls.push({ url: String(url), method: options.method })
  const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } })
  const path = String(url).replace('https://api.razorpay.com/v1', '')
  if (options.method === 'POST' && path === '/subscriptions') {
    const body = JSON.parse(options.body)
    const sub = { id: `sub_TEST${String(++seq).padStart(6, '0')}`, status: 'created', plan_id: body.plan_id, notes: body.notes }
    gateway.set(sub.id, sub)
    return Promise.resolve(json(sub))
  }
  const cancel = path.match(/^\/subscriptions\/(sub_\w+)\/cancel$/)
  if (cancel) return Promise.resolve(json({ ...gateway.get(cancel[1]), status: 'cancelled' }))
  const fetchOne = path.match(/^\/subscriptions\/(sub_\w+)$/)
  if (fetchOne && gateway.has(fetchOne[1])) return Promise.resolve(json(gateway.get(fetchOne[1])))
  return Promise.resolve(json({ error: { code: 'BAD_REQUEST_ERROR', description: 'not found' } }, 400))
}

beforeEach(() => {
  calls = []
  globalThis.fetch = fakeFetch
})
afterEach(() => {
  globalThis.fetch = realFetch
})

const now = () => Math.floor(Date.now() / 1000)

function activeEntity(id, planId = 'plan_proTEST01', extra = {}) {
  return { id, entity: 'subscription', status: 'active', plan_id: planId, current_start: now(), current_end: now() + 30 * 86400, ...extra }
}

function sendWebhook(event, { eventId = `evt_${crypto.randomUUID()}`, secret = WEBHOOK_SECRET } = {}) {
  const raw = JSON.stringify(event)
  const signature = crypto.createHmac('sha256', secret).update(raw).digest('hex')
  return request(app)
    .post('/api/webhooks/razorpay')
    .set('Content-Type', 'application/json')
    .set('X-Razorpay-Signature', signature)
    .set('X-Razorpay-Event-Id', eventId)
    .send(raw)
}

async function current(ctx) {
  const res = await ctx.client.get(`/api/subscriptions/current?restaurantId=${ctx.restaurant.id}`)
  return res.body
}

describe('Razorpay checkout', () => {
  test('checkout creates a gateway subscription but grants nothing until verified', async () => {
    const ctx = await ownerWithRestaurant({ plan: 'starter' })
    const res = await ctx.client.post('/api/subscriptions/checkout', { restaurantId: ctx.restaurant.id, plan: 'pro' })
    assert.equal(res.status, 201)
    assert.equal(res.body.checkout.keyId, 'rzp_test_key123')
    assert.match(res.body.checkout.subscriptionId, /^sub_TEST/)
    assert.equal(res.body.checkout.amount, 39900)
    assert.equal(JSON.stringify(res.body).includes(KEY_SECRET), false, 'key secret must never be sent')

    const state = await current(ctx)
    assert.equal(state.subscription.status, 'trialing')
    assert.equal(state.subscription.plan, 'starter')
    assert.equal(state.subscription.pendingPlan, 'pro')
  })

  test('a forged checkout signature is rejected', async () => {
    const ctx = await ownerWithRestaurant()
    const { body } = await ctx.client.post('/api/subscriptions/checkout', { restaurantId: ctx.restaurant.id, plan: 'pro' })
    gateway.set(body.checkout.subscriptionId, activeEntity(body.checkout.subscriptionId))

    const res = await ctx.client.post('/api/subscriptions/verify', {
      restaurantId: ctx.restaurant.id,
      razorpay_payment_id: 'pay_FAKE000001',
      razorpay_subscription_id: body.checkout.subscriptionId,
      razorpay_signature: 'a'.repeat(64),
    })
    assert.equal(res.status, 400)
    assert.equal(res.body.code, 'INVALID_SIGNATURE')
    assert.equal((await current(ctx)).subscription.plan, 'starter')
  })

  test('a valid signature activates only what Razorpay reports', async () => {
    const ctx = await ownerWithRestaurant()
    const { body } = await ctx.client.post('/api/subscriptions/checkout', { restaurantId: ctx.restaurant.id, plan: 'pro' })
    const subId = body.checkout.subscriptionId
    const paymentId = 'pay_REAL000001'
    const signature = crypto.createHmac('sha256', KEY_SECRET).update(`${paymentId}|${subId}`).digest('hex')
    const verifyBody = { restaurantId: ctx.restaurant.id, razorpay_payment_id: paymentId, razorpay_subscription_id: subId, razorpay_signature: signature }

    // Razorpay still says "created" (not charged yet) -> no activation.
    let res = await ctx.client.post('/api/subscriptions/verify', verifyBody)
    assert.equal(res.status, 200)
    assert.equal(res.body.subscription.plan, 'starter')
    assert.equal(res.body.subscription.status, 'trialing')

    gateway.set(subId, activeEntity(subId))
    res = await ctx.client.post('/api/subscriptions/verify', verifyBody)
    assert.equal(res.body.subscription.status, 'active')
    assert.equal(res.body.subscription.plan, 'pro')
    assert.equal(res.body.subscription.isPaid, true)
    assert.ok(calls.some((c) => c.method === 'GET' && c.url.endsWith(`/subscriptions/${subId}`)), 'state was fetched from Razorpay')
  })

  test("verifying another restaurant's subscription id fails", async () => {
    const a = await ownerWithRestaurant()
    const b = await ownerWithRestaurant()
    const { body } = await a.client.post('/api/subscriptions/checkout', { restaurantId: a.restaurant.id, plan: 'pro' })
    const subId = body.checkout.subscriptionId
    const signature = crypto.createHmac('sha256', KEY_SECRET).update(`pay_X00000001|${subId}`).digest('hex')
    const res = await b.client.post('/api/subscriptions/verify', {
      restaurantId: b.restaurant.id,
      razorpay_payment_id: 'pay_X00000001',
      razorpay_subscription_id: subId,
      razorpay_signature: signature,
    })
    assert.equal(res.status, 400)
    assert.equal(res.body.code, 'PAYMENT_MISMATCH')
  })
})

describe('Razorpay webhooks', () => {
  test('rejects missing or invalid signatures', async () => {
    const event = { event: 'subscription.activated', payload: {} }
    const bad = await sendWebhook(event, { secret: 'wrong-secret' })
    assert.equal(bad.status, 400)
    assert.equal(bad.body.code, 'INVALID_SIGNATURE')

    const missing = await request(app).post('/api/webhooks/razorpay').set('Content-Type', 'application/json').send(JSON.stringify(event))
    assert.equal(missing.status, 400)
  })

  test('full lifecycle: charged → duplicate → pending → cancelled, with stale events ignored', async () => {
    const ctx = await ownerWithRestaurant()
    const { body } = await ctx.client.post('/api/subscriptions/checkout', { restaurantId: ctx.restaurant.id, plan: 'pro' })
    const subId = body.checkout.subscriptionId
    const t0 = now()

    const charged = {
      event: 'subscription.charged',
      created_at: t0,
      payload: {
        subscription: { entity: activeEntity(subId) },
        payment: {
          entity: { id: 'pay_CHARGE000001', amount: 39900, currency: 'INR', status: 'captured', method: 'upi', invoice_id: 'inv_0001', created_at: t0 },
        },
      },
    }
    const first = await sendWebhook(charged, { eventId: 'evt_charge_1' })
    assert.equal(first.status, 200)
    assert.equal(first.body.duplicate, false)

    let state = await current(ctx)
    assert.equal(state.subscription.status, 'active')
    assert.equal(state.subscription.plan, 'pro')
    assert.equal(state.usage.itemLimit, null)

    // Duplicate delivery: acknowledged, not applied twice.
    const again = await sendWebhook(charged, { eventId: 'evt_charge_1' })
    assert.equal(again.status, 200)
    assert.equal(again.body.duplicate, true)
    const recorded = await Payment().find({ gatewayPaymentId: 'pay_CHARGE000001' })
    assert.equal(recorded.length, 1)
    assert.equal(recorded[0].amount, 39900)
    assert.equal(recorded[0].status, 'captured')

    const payments = await ctx.client.get(`/api/subscriptions/payments?restaurantId=${ctx.restaurant.id}`)
    assert.equal(payments.body.payments.length, 1)
    assert.equal(payments.body.payments[0].method, 'upi')

    await sendWebhook(
      { event: 'subscription.pending', created_at: t0 + 10, payload: { subscription: { entity: { ...activeEntity(subId), status: 'pending' } } } },
      { eventId: 'evt_pending_1' },
    )
    state = await current(ctx)
    assert.equal(state.subscription.status, 'past_due')
    assert.equal(state.subscription.hasAccess, true, 'grace period while Razorpay retries')

    await sendWebhook(
      { event: 'subscription.cancelled', created_at: t0 + 20, payload: { subscription: { entity: { ...activeEntity(subId), status: 'cancelled' } } } },
      { eventId: 'evt_cancel_1' },
    )
    // Out-of-order older event must not resurrect the subscription.
    await sendWebhook(
      { event: 'subscription.activated', created_at: t0 + 5, payload: { subscription: { entity: activeEntity(subId) } } },
      { eventId: 'evt_late_activate' },
    )
    state = await current(ctx)
    assert.equal(state.subscription.status, 'cancelled')
  })

  test('failed payments are recorded and do not grant access', async () => {
    const ctx = await ownerWithRestaurant()
    const { body } = await ctx.client.post('/api/subscriptions/checkout', { restaurantId: ctx.restaurant.id, plan: 'starter' })
    const subId = body.checkout.subscriptionId
    await Promise.all([
      sendWebhook(
        {
          event: 'payment.failed',
          created_at: now(),
          payload: {
            payment: {
              entity: {
                id: 'pay_FAILED000001',
                amount: 19900,
                currency: 'INR',
                status: 'failed',
                subscription_id: subId,
                error_code: 'BAD_REQUEST_ERROR',
                error_description: 'Payment declined',
              },
            },
          },
        },
        { eventId: 'evt_fail_1' },
      ),
    ])
    const payment = await Payment().findOne({ gatewayPaymentId: 'pay_FAILED000001' })
    assert.equal(payment.status, 'failed')
    assert.equal(payment.errorDescription, 'Payment declined')
    const state = await current(ctx)
    assert.equal(state.subscription.isPaid, false)
    assert.equal(state.subscription.status, 'trialing')
  })

  test('plan change: the new subscription replaces the old one when it activates', async () => {
    const ctx = await ownerWithRestaurant()
    const first = await ctx.client.post('/api/subscriptions/checkout', { restaurantId: ctx.restaurant.id, plan: 'starter' })
    const oldId = first.body.checkout.subscriptionId
    await sendWebhook({ event: 'subscription.activated', created_at: now(), payload: { subscription: { entity: activeEntity(oldId, 'plan_starterTEST01') } } })
    assert.equal((await current(ctx)).subscription.plan, 'starter')

    const same = await ctx.client.post('/api/subscriptions/checkout', { restaurantId: ctx.restaurant.id, plan: 'starter' })
    assert.equal(same.status, 409)

    const upgrade = await ctx.client.post('/api/subscriptions/checkout', { restaurantId: ctx.restaurant.id, plan: 'pro' })
    const newId = upgrade.body.checkout.subscriptionId
    await sendWebhook({ event: 'subscription.activated', created_at: now(), payload: { subscription: { entity: activeEntity(newId) } } })

    const state = await current(ctx)
    assert.equal(state.subscription.plan, 'pro')
    assert.equal(state.subscription.status, 'active')
    await new Promise((resolve) => setTimeout(resolve, 50))
    assert.ok(calls.some((c) => c.url.endsWith(`/subscriptions/${oldId}/cancel`)), 'old subscription cancelled at Razorpay')

    // A late event for the replaced subscription is ignored.
    await sendWebhook({ event: 'subscription.cancelled', created_at: now() + 5, payload: { subscription: { entity: { ...activeEntity(oldId), status: 'cancelled' } } } })
    assert.equal((await current(ctx)).subscription.status, 'active')

    // Paid Pro restaurants can keep adding items.
    const item = await ctx.client.post(`/api/menu/${ctx.restaurant.id}`, itemPayload(ctx.category.id))
    assert.equal(item.status, 201)
  })

  test('cancelling a paid plan schedules cancellation at period end', async () => {
    const ctx = await ownerWithRestaurant()
    const { body } = await ctx.client.post('/api/subscriptions/checkout', { restaurantId: ctx.restaurant.id, plan: 'pro' })
    await sendWebhook({ event: 'subscription.activated', created_at: now(), payload: { subscription: { entity: activeEntity(body.checkout.subscriptionId) } } })

    const res = await ctx.client.post('/api/subscriptions/cancel', { restaurantId: ctx.restaurant.id })
    assert.equal(res.status, 200)
    assert.equal(res.body.subscription.status, 'active')
    assert.equal(res.body.subscription.cancelAtPeriodEnd, true)
    assert.ok(calls.some((c) => c.url.endsWith(`/subscriptions/${body.checkout.subscriptionId}/cancel`)))
  })
})
