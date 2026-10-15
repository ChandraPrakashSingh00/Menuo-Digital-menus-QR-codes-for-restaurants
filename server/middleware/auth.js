import User from '../models/User.js'
import { ApiError } from '../utils/ApiError.js'
import { AUTH_COOKIE, clearAuthCookie } from '../utils/cookies.js'
import { isObjectId } from '../utils/helpers.js'
import { verifyAuthToken } from '../utils/tokens.js'

/** Requires a valid session cookie and loads the user onto req.user. */
export async function requireAuth(req, res, next) {
  const token = req.cookies?.[AUTH_COOKIE]
  if (!token) throw ApiError.unauthorized()

  let payload
  try {
    payload = verifyAuthToken(token)
  } catch {
    clearAuthCookie(res)
    throw ApiError.unauthorized('Your session has expired. Please log in again.')
  }

  const user = isObjectId(payload.sub) ? await User.findById(payload.sub).select('+tokenVersion') : null
  // tokenVersion changes on password change, which revokes every older session.
  if (!user || user.tokenVersion !== payload.tv) {
    clearAuthCookie(res)
    throw ApiError.unauthorized('Your session has expired. Please log in again.')
  }

  req.user = user
  next()
}

/** Allows the request only for users whose role is in `roles`. Use after requireAuth. */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) throw ApiError.forbidden()
    next()
  }
}
