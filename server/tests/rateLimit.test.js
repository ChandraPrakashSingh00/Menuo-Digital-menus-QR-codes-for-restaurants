process.env.RATE_LIMIT_ENABLED = 'true'
process.env.AUTH_RATE_LIMIT_MAX = '3'

const { createClient, registerOwner, useTestDatabase } = await import('./helpers.js')
const assert = (await import('node:assert/strict')).default
const { test } = await import('node:test')

useTestDatabase()

test('repeated failed logins are rate limited', async () => {
  const { credentials } = await registerOwner()
  const client = await createClient()
  const attempt = () => client.post('/api/auth/login', { email: credentials.email, password: 'wrong-password' })

  for (let i = 0; i < 3; i++) assert.equal((await attempt()).status, 401)
  const blocked = await attempt()
  assert.equal(blocked.status, 429)
  assert.equal(blocked.body.code, 'RATE_LIMITED')
})
