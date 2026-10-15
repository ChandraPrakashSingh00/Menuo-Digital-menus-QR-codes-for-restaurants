import { config } from '../config/env.js'

export const AUTH_COOKIE = 'menuo_session'
export const CSRF_COOKIE = 'menuo_csrf'

function baseOptions() {
  return {
    httpOnly: true,
    secure: config.cookies.secure,
    sameSite: config.cookies.sameSite,
    domain: config.cookies.domain,
    path: '/',
  }
}

export function setAuthCookie(res, token) {
  res.cookie(AUTH_COOKIE, token, { ...baseOptions(), maxAge: config.jwt.expiresDays * 86400000 })
}

export function clearAuthCookie(res) {
  res.clearCookie(AUTH_COOKIE, baseOptions())
}

export function setCsrfCookie(res, token) {
  // HttpOnly as well: the client reads the token from GET /api/auth/csrf, not from document.cookie,
  // which keeps the scheme working when the API lives on a different domain than the frontend.
  res.cookie(CSRF_COOKIE, token, { ...baseOptions(), maxAge: 7 * 86400000 })
}
