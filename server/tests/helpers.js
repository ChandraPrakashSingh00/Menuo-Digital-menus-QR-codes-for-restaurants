// Shared test setup. Import this module FIRST in every test file: it sets the environment
// before config/env.js is evaluated by the app import that follows.

process.env.NODE_ENV = 'test'
process.env.MONGODB_URI ??= 'mongodb://set-by-tests'
process.env.JWT_SECRET ??= 'test-only-secret-that-is-long-enough-for-validation'
process.env.CLIENT_ORIGINS ??= 'http://localhost:5173'
process.env.RATE_LIMIT_ENABLED ??= 'false'
process.env.TRIAL_DAYS ??= '7'

const { after, before } = await import('node:test')
const { MongoMemoryServer } = await import('mongodb-memory-server')
const { default: mongoose } = await import('mongoose')
const { default: request } = await import('supertest')
const { default: app } = await import('../app.js')

export { app, mongoose, request }

/** Starts an in-memory MongoDB for the current test file. */
export function useTestDatabase() {
  let mongo
  before(async () => {
    mongo = await MongoMemoryServer.create()
    await mongoose.connect(mongo.getUri())
    await Promise.all(Object.values(mongoose.models).map((model) => model.syncIndexes()))
  })
  after(async () => {
    await mongoose.disconnect()
    await mongo?.stop()
  })
}

let counter = 0
export const uniqueEmail = (prefix = 'owner') => `${prefix}.${Date.now()}.${++counter}@example.com`

/** A cookie-keeping client that sends the CSRF header on state-changing requests. */
export async function createClient({ origin } = {}) {
  const agent = request.agent(app)
  const { body } = await agent.get('/api/auth/csrf')
  const csrf = body.csrfToken
  const withHeaders = (req) => {
    req.set('X-CSRF-Token', csrf)
    if (origin) req.set('Origin', origin)
    return req
  }
  return {
    agent,
    csrf,
    get: (url) => agent.get(url),
    post: (url, data) => withHeaders(agent.post(url)).send(data),
    patch: (url, data) => withHeaders(agent.patch(url)).send(data),
    put: (url, data) => withHeaders(agent.put(url)).send(data),
    delete: (url) => withHeaders(agent.delete(url)),
  }
}

export async function registerOwner(overrides = {}) {
  const client = await createClient()
  const credentials = { name: 'Test Owner', email: uniqueEmail(), password: 'password123', ...overrides }
  const res = await client.post('/api/auth/register', credentials)
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`)
  return { client, user: res.body.user, credentials }
}

/** Registered owner + restaurant (with its trial) + one category. */
export async function ownerWithRestaurant({ plan = 'starter', restaurantName = 'Spice Route' } = {}) {
  const { client, user, credentials } = await registerOwner()
  const created = await client.post('/api/restaurants', { name: restaurantName, plan })
  if (created.status !== 201) throw new Error(`restaurant failed: ${created.status} ${JSON.stringify(created.body)}`)
  const { restaurant, subscription } = created.body
  const cat = await client.post(`/api/menu/${restaurant.id}/categories`, { name: 'Starters' })
  if (cat.status !== 201) throw new Error(`category failed: ${cat.status} ${JSON.stringify(cat.body)}`)
  return { client, user, credentials, restaurant, subscription, category: cat.body.category }
}

export function itemPayload(categoryId, overrides = {}) {
  return { categoryId, name: 'Paneer Tikka', price: 289, description: 'Grilled cottage cheese', tags: ['veg'], ...overrides }
}
