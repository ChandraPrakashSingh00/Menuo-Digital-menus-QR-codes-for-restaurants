import { app, itemPayload, mongoose, ownerWithRestaurant, request, useTestDatabase } from './helpers.js'
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

useTestDatabase()

const MenuItem = () => mongoose.model('MenuItem')
const Subscription = () => mongoose.model('Subscription')

async function seedItems({ restaurant, category }, count) {
  const docs = Array.from({ length: count }, (_, i) => ({
    restaurantId: restaurant.id,
    categoryId: category.id,
    name: `Seed ${i}`,
    price: 100,
    sortOrder: i,
  }))
  await MenuItem().insertMany(docs)
}

async function expireTrial(restaurantId) {
  await Subscription().updateOne({ restaurantId }, { $set: { trialEndsAt: new Date(Date.now() - 60000) } })
}

describe('plans and trials', () => {
  test('plans endpoint exposes Starter ₹199 / 50 items and Pro ₹399 / unlimited', async () => {
    const res = await request(app).get('/api/subscriptions/plans')
    assert.equal(res.status, 200)
    const byId = Object.fromEntries(res.body.plans.map((p) => [p.id, p]))
    assert.equal(byId.starter.price, 199)
    assert.equal(byId.starter.itemLimit, 50)
    assert.equal(byId.pro.price, 399)
    assert.equal(byId.pro.itemLimit, null)
    assert.equal(res.body.trialDays, 7)
    assert.equal(res.body.paymentsEnabled, false)
  })

  test('a new restaurant starts a 7-day trial', async () => {
    const { subscription, client, restaurant } = await ownerWithRestaurant()
    assert.equal(subscription.status, 'trialing')
    assert.equal(subscription.hasAccess, true)
    const days = (new Date(subscription.trialEndsAt) - Date.now()) / 86400000
    assert.ok(days > 6.9 && days <= 7, `trial should be 7 days, got ${days}`)

    const current = await client.get(`/api/subscriptions/current?restaurantId=${restaurant.id}`)
    assert.equal(current.status, 200)
    assert.equal(current.body.subscription.status, 'trialing')
    assert.equal(current.body.usage.itemLimit, 50)
  })

  test('the same owner does not get a second trial', async () => {
    const { client } = await ownerWithRestaurant()
    const second = await client.post('/api/restaurants', { name: 'Second Outlet' })
    assert.equal(second.status, 201)
    assert.equal(second.body.subscription.status, 'expired')
    assert.equal(second.body.subscription.trialUsed, false)
    assert.equal(second.body.subscription.hasAccess, false)

    const category = await client.post(`/api/menu/${second.body.restaurant.id}/categories`, { name: 'Mains' })
    assert.equal(category.status, 402)
    assert.equal(category.body.code, 'SUBSCRIPTION_INACTIVE')
  })

  test('slugs are generated uniquely', async () => {
    const a = await ownerWithRestaurant({ restaurantName: 'Café Délice' })
    const b = await ownerWithRestaurant({ restaurantName: 'Cafe Delice' })
    assert.equal(a.restaurant.slug, 'cafe-delice')
    assert.equal(b.restaurant.slug, 'cafe-delice-2')
  })
})

describe('plan limits are enforced on the server', () => {
  test('Starter allows 50 items, the 51st is rejected', async () => {
    const ctx = await ownerWithRestaurant({ plan: 'starter' })
    await seedItems(ctx, 49)

    const fiftieth = await ctx.client.post(`/api/menu/${ctx.restaurant.id}`, itemPayload(ctx.category.id))
    assert.equal(fiftieth.status, 201)

    const fiftyFirst = await ctx.client.post(`/api/menu/${ctx.restaurant.id}`, itemPayload(ctx.category.id))
    assert.equal(fiftyFirst.status, 403)
    assert.equal(fiftyFirst.body.code, 'PLAN_LIMIT_REACHED')

    const duplicate = await ctx.client.post(`/api/menu/item/${fiftieth.body.item.id}/duplicate`)
    assert.equal(duplicate.status, 403)

    assert.equal(await MenuItem().countDocuments({ restaurantId: ctx.restaurant.id }), 50)
  })

  test('parallel requests cannot push Starter past 50 items', async () => {
    const ctx = await ownerWithRestaurant({ plan: 'starter' })
    await seedItems(ctx, 48)
    const results = await Promise.all(
      Array.from({ length: 6 }, (_, i) => ctx.client.post(`/api/menu/${ctx.restaurant.id}`, itemPayload(ctx.category.id, { name: `Rush ${i}` }))),
    )
    assert.equal(results.filter((r) => r.status === 201).length, 2)
    assert.ok(results.every((r) => r.status === 201 || r.status === 403))
    assert.equal(await MenuItem().countDocuments({ restaurantId: ctx.restaurant.id }), 50)
  })

  test('Pro has no item limit', async () => {
    const ctx = await ownerWithRestaurant({ plan: 'pro' })
    await seedItems(ctx, 75)
    const res = await ctx.client.post(`/api/menu/${ctx.restaurant.id}`, itemPayload(ctx.category.id))
    assert.equal(res.status, 201)
  })

  test('negative prices are rejected', async () => {
    const ctx = await ownerWithRestaurant()
    const res = await ctx.client.post(`/api/menu/${ctx.restaurant.id}`, itemPayload(ctx.category.id, { price: -5 }))
    assert.equal(res.status, 400)
    assert.equal(res.body.errors.price, 'Price cannot be negative')
  })
})

describe('expired subscriptions', () => {
  test('after the trial ends, menu edits are blocked and the public menu goes offline', async () => {
    const ctx = await ownerWithRestaurant()
    const created = await ctx.client.post(`/api/menu/${ctx.restaurant.id}`, itemPayload(ctx.category.id))
    assert.equal((await request(app).get(`/api/public/menu/${ctx.restaurant.slug}`)).status, 200)

    await expireTrial(ctx.restaurant.id)

    const current = await ctx.client.get(`/api/subscriptions/current?restaurantId=${ctx.restaurant.id}`)
    assert.equal(current.body.subscription.status, 'expired')
    assert.equal(current.body.subscription.hasAccess, false)

    const add = await ctx.client.post(`/api/menu/${ctx.restaurant.id}`, itemPayload(ctx.category.id))
    assert.equal(add.status, 402)
    const edit = await ctx.client.patch(`/api/menu/item/${created.body.item.id}`, { price: 1 })
    assert.equal(edit.status, 402)

    const publicMenu = await request(app).get(`/api/public/menu/${ctx.restaurant.slug}`)
    assert.equal(publicMenu.status, 404)

    // Owners can still clean up and still read their data.
    assert.equal((await ctx.client.get(`/api/menu/${ctx.restaurant.id}`)).status, 200)
    assert.equal((await ctx.client.delete(`/api/menu/item/${created.body.item.id}`)).status, 200)
  })

  test('checkout without Razorpay credentials returns 503 and grants nothing', async () => {
    const ctx = await ownerWithRestaurant()
    await expireTrial(ctx.restaurant.id)
    const res = await ctx.client.post('/api/subscriptions/checkout', { restaurantId: ctx.restaurant.id, plan: 'pro' })
    assert.equal(res.status, 503)
    assert.equal(res.body.code, 'PAYMENTS_NOT_CONFIGURED')

    const current = await ctx.client.get(`/api/subscriptions/current?restaurantId=${ctx.restaurant.id}`)
    assert.equal(current.body.subscription.status, 'expired')
    assert.equal(current.body.subscription.plan, 'starter')
  })

  test('cancelling a trial keeps access until the trial would have ended', async () => {
    const ctx = await ownerWithRestaurant()
    const res = await ctx.client.post('/api/subscriptions/cancel', { restaurantId: ctx.restaurant.id })
    assert.equal(res.status, 200)
    assert.equal(res.body.subscription.status, 'cancelled')
    assert.equal(res.body.subscription.hasAccess, true)
    const again = await ctx.client.post('/api/subscriptions/cancel', { restaurantId: ctx.restaurant.id })
    assert.equal(again.status, 409)
  })
})

describe('public menu', () => {
  test('returns only published, visible and available data without private fields', async () => {
    const ctx = await ownerWithRestaurant({ restaurantName: 'Public Place' })
    const rid = ctx.restaurant.id
    await ctx.client.patch(`/api/restaurants/${rid}`, { email: 'owner-contact@example.com', phone: '+91 98200 12345' })
    const hidden = await ctx.client.post(`/api/menu/${rid}/categories`, { name: 'Secret', isVisible: false })
    await ctx.client.post(`/api/menu/${rid}`, itemPayload(ctx.category.id, { name: 'Visible dish' }))
    await ctx.client.post(`/api/menu/${rid}`, itemPayload(ctx.category.id, { name: 'Sold out dish', isAvailable: false }))
    await ctx.client.post(`/api/menu/${rid}`, itemPayload(hidden.body.category.id, { name: 'Hidden dish' }))

    const res = await request(app).get(`/api/public/menu/${ctx.restaurant.slug}`)
    assert.equal(res.status, 200)
    assert.equal(res.headers['cache-control'], 'no-cache')
    assert.deepEqual(
      res.body.items.map((i) => i.name),
      ['Visible dish'],
    )
    assert.deepEqual(
      res.body.categories.map((c) => c.name),
      ['Starters'],
    )
    const raw = JSON.stringify(res.body)
    for (const leak of [ctx.user.id, ctx.credentials.email, rid, 'owner-contact@example.com', 'ownerId', 'restaurantId', 'trial']) {
      assert.ok(!raw.includes(leak), `public menu leaked ${leak}`)
    }
    assert.equal(res.body.restaurant.phone, '+91 98200 12345')

    const views = await request(app).post(`/api/public/menu/${ctx.restaurant.slug}/views`)
    assert.equal(views.status, 200)
    const stats = await ctx.client.get(`/api/restaurants/${rid}/stats`)
    assert.equal(stats.body.totals.viewsTotal, 1)
  })

  test('price changes are visible immediately through the same slug', async () => {
    const ctx = await ownerWithRestaurant()
    const created = await ctx.client.post(`/api/menu/${ctx.restaurant.id}`, itemPayload(ctx.category.id, { price: 100 }))
    await ctx.client.patch(`/api/menu/item/${created.body.item.id}`, { price: 149.5 })
    const res = await request(app).get(`/api/public/menu/${ctx.restaurant.slug}`)
    assert.equal(res.body.items[0].price, 149.5)
  })

  test('unpublished and unknown menus return 404', async () => {
    const ctx = await ownerWithRestaurant()
    await ctx.client.patch(`/api/restaurants/${ctx.restaurant.id}`, { isPublished: false })
    assert.equal((await request(app).get(`/api/public/menu/${ctx.restaurant.slug}`)).status, 404)
    assert.equal((await request(app).get('/api/public/menu/does-not-exist')).status, 404)
  })
})

describe('menu queries', () => {
  test('category filter, search and pagination', async () => {
    const ctx = await ownerWithRestaurant()
    const rid = ctx.restaurant.id
    const mains = await ctx.client.post(`/api/menu/${rid}/categories`, { name: 'Mains' })
    await ctx.client.post(`/api/menu/${rid}`, itemPayload(ctx.category.id, { name: 'Paneer Tikka' }))
    await ctx.client.post(`/api/menu/${rid}`, itemPayload(mains.body.category.id, { name: 'Butter Chicken', description: 'Creamy tomato gravy' }))
    await ctx.client.post(`/api/menu/${rid}`, itemPayload(mains.body.category.id, { name: 'Dal Makhani', isAvailable: false }))

    const byCategory = await ctx.client.get(`/api/menu/${rid}?categoryId=${mains.body.category.id}`)
    assert.deepEqual(byCategory.body.items.map((i) => i.name).sort(), ['Butter Chicken', 'Dal Makhani'])
    assert.equal(byCategory.body.items[0].category, 'Mains')

    const search = await ctx.client.get(`/api/menu/${rid}?search=tomato`)
    assert.deepEqual(
      search.body.items.map((i) => i.name),
      ['Butter Chicken'],
    )

    const regexInjection = await ctx.client.get(`/api/menu/${rid}?search=.*`)
    assert.equal(regexInjection.body.items.length, 0)

    const available = await ctx.client.get(`/api/menu/${rid}?available=false`)
    assert.deepEqual(
      available.body.items.map((i) => i.name),
      ['Dal Makhani'],
    )

    const paged = await ctx.client.get(`/api/menu/${rid}?limit=2&page=2`)
    assert.equal(paged.body.items.length, 1)
    assert.deepEqual(paged.body.pagination, { page: 2, limit: 2, total: 3, pages: 2 })

    const categories = await ctx.client.get(`/api/menu/${rid}/categories`)
    assert.deepEqual(
      categories.body.categories.map((c) => [c.name, c.itemCount]),
      [
        ['Starters', 1],
        ['Mains', 2],
      ],
    )
  })
})
