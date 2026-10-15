import rateLimit from 'express-rate-limit'
import { config } from '../config/env.js'

function limiter({ windowMs, limit, message, skipSuccessfulRequests = false }) {
  return rateLimit({
    windowMs,
    limit,
    skipSuccessfulRequests,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: () => !config.rateLimit.enabled,
    handler: (req, res, next, options) => {
      res.status(options.statusCode).json({ message, code: 'RATE_LIMITED' })
    },
  })
}

/** Broad cap for all API traffic per IP. */
export const apiLimiter = limiter({
  windowMs: 15 * 60 * 1000,
  limit: config.rateLimit.apiMax,
  message: 'Too many requests. Please slow down and try again shortly.',
})

/** Failed login attempts per IP (successful logins do not count). */
export const loginLimiter = limiter({
  windowMs: 15 * 60 * 1000,
  limit: config.rateLimit.authMax,
  skipSuccessfulRequests: true,
  message: 'Too many login attempts. Please wait 15 minutes and try again.',
})

/** Account creation and password changes per IP. */
export const sensitiveAuthLimiter = limiter({
  windowMs: 60 * 60 * 1000,
  limit: config.rateLimit.authMax,
  message: 'Too many attempts from this network. Please try again later.',
})

/** Anonymous public menu traffic per IP. */
export const publicLimiter = limiter({
  windowMs: 60 * 1000,
  limit: config.rateLimit.publicMax,
  message: 'Too many requests. Please try again in a minute.',
})
