import mongoose from 'mongoose'
import { ApiError } from '../utils/ApiError.js'
import { isDuplicateKeyError } from '../utils/helpers.js'

export function notFound(req, res, next) {
  next(ApiError.notFound('This API route does not exist.'))
}

// Every error leaves the API as { message, code?, errors? }. Stack traces and internal
// details are logged on the server only.
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  let error = err

  if (error instanceof mongoose.Error.ValidationError) {
    const errors = Object.fromEntries(Object.entries(error.errors).map(([path, e]) => [path, e.message]))
    error = new ApiError(400, Object.values(errors)[0] || 'Invalid data.', { code: 'VALIDATION_ERROR', errors })
  } else if (error instanceof mongoose.Error.CastError) {
    error = ApiError.badRequest(`Invalid value for ${error.path}.`, { code: 'INVALID_ID' })
  } else if (isDuplicateKeyError(error)) {
    const field = Object.keys(error.keyPattern || error.keyValue || {})[0]
    error = ApiError.conflict(field === 'email' ? 'An account with this email already exists.' : 'This record already exists.', {
      code: 'DUPLICATE',
      errors: field ? { [field]: 'Already in use' } : undefined,
    })
  } else if (error?.type === 'entity.parse.failed') {
    error = ApiError.badRequest('Request body is not valid JSON.', { code: 'INVALID_JSON' })
  } else if (error?.type === 'entity.too.large') {
    error = new ApiError(413, 'Request is too large. Use smaller images (under 1 MB).', { code: 'PAYLOAD_TOO_LARGE' })
  }

  if (!(error instanceof ApiError)) {
    console.error(`[error] ${req.method} ${req.originalUrl}`, err)
    error = new ApiError(500, 'Something went wrong on our side. Please try again.', { code: 'INTERNAL_ERROR' })
  } else if (error.status >= 500) {
    console.error(`[error] ${req.method} ${req.originalUrl}: ${error.code} ${error.message}`)
  }

  if (res.headersSent) return
  res.status(error.status).json({
    message: error.message,
    ...(error.code && { code: error.code }),
    ...(error.errors && { errors: error.errors }),
  })
}
