import { app, createClient, registerOwner, request, uniqueEmail, useTestDatabase } from './helpers.js'
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

useTestDatabase()

describe('authentication', () => {
  test('register sets an HttpOnly session cookie and never returns secrets', async () => {
    const client = await createClient()
    const email = uniqueEmail().toUpperCase()
    const res = await client.post('/api/auth/register', { name: 'Aarav Mehta', email, password: 'password123' })

    assert.equal(res.status, 201)
    assert.equal(res.body.user.email, email.toLowerCase())
    assert.equal(res.body.user.role, 'owner')
    assert.ok(res.body.user.id)
    for (const secret of ['passwordHash', 'password', 'tokenVersion', '_id']) assert.equal(res.body.user[secret], undefined)

    const cookie = res.headers['set-cookie'].find((c) => c.startsWith('menuo_session='))
    assert.match(cookie, /HttpOnly/i)
    assert.match(cookie, /SameSite=Lax/i)
    assert.doesNotMatch(JSON.stringify(res.body), /eyJ/) // no JWT in the body

    const me = await client.get('/api/auth/me')
    assert.equal(me.status, 200)
    assert.equal(me.body.user.email, email.toLowerCase())
  })

  test('duplicate email is rejected with 409', async () => {
    const { credentials } = await registerOwner()
    const client = await createClient()
    const res = await client.post('/api/auth/register', { ...credentials, email: credentials.email.toUpperCase() })
    assert.equal(res.status, 409)
    assert.equal(res.body.code, 'EMAIL_TAKEN')
  })

  test('invalid registration data returns field errors', async () => {
    const client = await createClient()
    const res = await client.post('/api/auth/register', { name: 'A', email: 'not-an-email', password: 'short' })
    assert.equal(res.status, 400)
    assert.equal(res.body.code, 'VALIDATION_ERROR')
    assert.ok(res.body.errors.name && res.body.errors.email && res.body.errors.password)
  })

  test('clients cannot self-assign the admin role', async () => {
    const client = await createClient()
    const res = await client.post('/api/auth/register', { name: 'Mallory', email: uniqueEmail(), password: 'password123', role: 'admin' })
    assert.equal(res.status, 400)
    assert.equal(res.body.errors.role, 'Unknown field')
  })

  test('login checks the password and rejects operator injection', async () => {
    const { credentials } = await registerOwner()
    const client = await createClient()

    const wrong = await client.post('/api/auth/login', { email: credentials.email, password: 'wrong-password' })
    assert.equal(wrong.status, 401)
    assert.equal(wrong.body.code, 'INVALID_CREDENTIALS')

    const injection = await client.post('/api/auth/login', { email: { $ne: null }, password: { $ne: null } })
    assert.equal(injection.status, 400)

    const ok = await client.post('/api/auth/login', { email: credentials.email, password: credentials.password })
    assert.equal(ok.status, 200)
    assert.equal(ok.body.user.email, credentials.email)
  })

  test('protected routes require a session', async () => {
    const res = await request(app).get('/api/auth/me')
    assert.equal(res.status, 401)
    assert.equal(res.body.code, 'UNAUTHENTICATED')

    const forged = await request(app).get('/api/auth/me').set('Cookie', 'menuo_session=eyJhbGciOiJub25lIn0.eyJzdWIiOiIxIn0.')
    assert.equal(forged.status, 401)
  })

  test('state-changing requests need a CSRF token and an allowed origin', async () => {
    const noToken = await request(app).post('/api/auth/login').send({ email: 'a@b.co', password: 'x' })
    assert.equal(noToken.status, 403)
    assert.equal(noToken.body.code, 'CSRF_INVALID')

    const evil = await createClient({ origin: 'https://evil.example' })
    const badOrigin = await evil.post('/api/auth/login', { email: 'a@b.co', password: 'x' })
    assert.equal(badOrigin.status, 403)
    assert.equal(badOrigin.body.code, 'CSRF_ORIGIN')
  })

  test('logout clears the session', async () => {
    const { client } = await registerOwner()
    const out = await client.post('/api/auth/logout')
    assert.equal(out.status, 200)
    assert.equal((await client.get('/api/auth/me')).status, 401)
  })

  test('changing the password signs out other sessions', async () => {
    const { client, credentials } = await registerOwner()
    const otherDevice = await createClient()
    await otherDevice.post('/api/auth/login', { email: credentials.email, password: credentials.password })
    assert.equal((await otherDevice.get('/api/auth/me')).status, 200)

    const wrong = await client.patch('/api/auth/password', { currentPassword: 'nope-nope', newPassword: 'new-password-1' })
    assert.equal(wrong.status, 400)

    const changed = await client.patch('/api/auth/password', { currentPassword: credentials.password, newPassword: 'new-password-1' })
    assert.equal(changed.status, 200)
    assert.equal((await client.get('/api/auth/me')).status, 200, 'current device keeps a fresh session')
    assert.equal((await otherDevice.get('/api/auth/me')).status, 401, 'other device is signed out')
  })

  test('profile update enforces unique email', async () => {
    const a = await registerOwner()
    const b = await registerOwner()
    const clash = await b.client.patch('/api/auth/profile', { email: a.credentials.email })
    assert.equal(clash.status, 409)
    const ok = await b.client.patch('/api/auth/profile', { name: 'Renamed Owner' })
    assert.equal(ok.status, 200)
    assert.equal(ok.body.user.name, 'Renamed Owner')
  })
})
