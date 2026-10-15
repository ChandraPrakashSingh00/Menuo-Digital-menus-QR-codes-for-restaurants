/** An error that is safe to show to API clients. Anything else becomes a generic 500. */
export class ApiError extends Error {
  constructor(status, message, { code, errors } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.errors = errors
  }

  static badRequest(message = 'Invalid request.', options) {
    return new ApiError(400, message, { code: 'BAD_REQUEST', ...options })
  }

  static unauthorized(message = 'Please log in to continue.', options) {
    return new ApiError(401, message, { code: 'UNAUTHENTICATED', ...options })
  }

  static paymentRequired(message, options) {
    return new ApiError(402, message, { code: 'SUBSCRIPTION_INACTIVE', ...options })
  }

  static forbidden(message = 'You do not have permission to do that.', options) {
    return new ApiError(403, message, { code: 'FORBIDDEN', ...options })
  }

  static notFound(message = 'Not found.', options) {
    return new ApiError(404, message, { code: 'NOT_FOUND', ...options })
  }

  static conflict(message, options) {
    return new ApiError(409, message, { code: 'CONFLICT', ...options })
  }

  static unavailable(message, options) {
    return new ApiError(503, message, { code: 'SERVICE_UNAVAILABLE', ...options })
  }
}
