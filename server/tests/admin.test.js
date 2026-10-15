import { app, createClient, mongoose, ownerWithRestaurant, registerOwner, request, useTestDatabase } from './helpers.js'
import assert from 'node:assert/strict'
import { before, describe, test } from 'node:test'

useTestDatabase()

describe('super admin API', () => {
  let admin
  let owner

  before(async () => {
    owner = await ownerWithRestaurant({ restaurantName: 'Owner Diner' })
    const registered = await registerOwner({ name: 'Site Admin' })
    // Admins are created with scripts/createAdmin.js; here we promote directly in the DB.
    await mongoose.model('User').updateOne({ email: registered.credentials.email }, { $set: { role: 'admin' } })
    admin = await createClient()
    const login = await admin.post('/api/auth/login', { email: registered.credentials.email, password: registered.credentials.password })
    assert.equal(login.status, 200)
  })

  test('anonymous users and restaurant owners are refused', async () => {
    assert.equal((await request(app).get('/api/admin/users')).status, 401)
    for (const path of ['/api/admin/users', '/api/admin/restaurants', '/api/admin/subscriptions', '/api/admin/payments', '/api/admin/stats']) {
      const res = await owner.client.get(path)
      assert.equal(res.status, 403, path)
    }
  })

  test('admins can list users with search and pagination, without password hashes', async () => {
    const res = await admin.get(`/api/admin/users?search=${encodeURIComponent(owner.credentials.email)}&limit=5`)
    assert.equal(res.status, 200)
    assert.equal(res.body.users.length, 1)
    assert.equal(res.body.users[0].email, owner.credentials.email)
    assert.equal(res.body.users[0].passwordHash, undefined)
    assert.deepEqual(res.body.pagination, { page: 1, limit: 5, total: 1, pages: 1 })

    const admins = await admin.get('/api/admin/users?role=admin')
    assert.ok(admins.body.users.every((u) => u.role === 'admin'))
  })

  test('admins can list restaurants and subscriptions with filters', async () => {
    const restaurants = await admin.get('/api/admin/restaurants?search=owner%20diner&status=published')
    assert.equal(restaurants.status, 200)
    assert.equal(restaurants.body.restaurants[0].owner.email, owner.credentials.email)

    const subs = await admin.get('/api/admin/subscriptions?status=trialing')
    assert.equal(subs.status, 200)
    assert.ok(subs.body.subscriptions.length >= 1)
    assert.ok(subs.body.subscriptions.every((s) => s.status === 'trialing'))

    const invalid = await admin.get('/api/admin/subscriptions?status=free')
    assert.equal(invalid.status, 400)

    const stats = await admin.get('/api/admin/stats')
    assert.equal(stats.status, 200)
    assert.ok(stats.body.users >= 2)
  })
})
