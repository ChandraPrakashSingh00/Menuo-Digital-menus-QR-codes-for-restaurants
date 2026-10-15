import crypto from 'node:crypto'
import { config } from '../config/env.js'
import { ApiError } from '../utils/ApiError.js'
import { CSRF_COOKIE, setCsrfCookie } from '../utils/cookies.js'

// Double-submit CSRF protection for cookie-authenticated requests:
// GET /api/auth/csrf sets an HttpOnly cookie and returns the same token in JSON;
// every state-changing request must echo it in the X-CSRF-Token header. A cross-site
// attacker can make the browser send the cookie, but can't read the token (CORS).

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])
// No cookie-based authority on these paths (anonymous view counter, signed gateway webhooks).
const EXEMPT_PREFIXES = ['/api/public/', '/api/webhooks/']
const TOKEN_PATTERN = /^[a-f0-9]{64}$/

export function isAllowedOrigin(origin) {
  return config.clientOrigins.includes(origin)
}

/** Returns the current CSRF token, issuing a new cookie when there is none. */
export function issueCsrfToken(req, res) {
  const existing = req.cookies?.[CSRF_COOKIE]
  const token = TOKEN_PATTERN.test(existing || '') ? existing : crypto.randomBytes(32).toString('hex')
  setCsrfCookie(res, token)
  return token
}

function tokensMatch(a, b) {
  if (!TOKEN_PATTERN.test(a || '') || !TOKEN_PATTERN.test(b || '')) return false
  return crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'))
}

export function csrfProtection(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next()
  if (EXEMPT_PREFIXES.some((prefix) => req.path.startsWith(prefix))) return next()

  const origin = req.get('origin')
  if (origin && !isAllowedOrigin(origin)) {
    return next(ApiError.forbidden('Request origin is not allowed.', { code: 'CSRF_ORIGIN' }))
  }

  if (!tokensMatch(req.cookies?.[CSRF_COOKIE], req.get('x-csrf-token'))) {
    return next(new ApiError(403, 'Your security token is missing or expired. Please refresh the page and try again.', { code: 'CSRF_INVALID' }))
  }
  next()
}
