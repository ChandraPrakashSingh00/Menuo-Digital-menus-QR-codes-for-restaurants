import { ApiError } from '../utils/ApiError.js'

function issueMessage(issue) {
  if (issue.code === 'invalid_type' && /received undefined/i.test(issue.message)) return 'This field is required'
  return issue.message
}

export function zodErrorToApiError(error) {
  const errors = {}
  for (const issue of error.issues) {
    if (issue.code === 'unrecognized_keys') {
      for (const key of issue.keys) errors[[...issue.path, key].join('.')] = 'Unknown field'
      continue
    }
    const key = issue.path.join('.') || '_'
    errors[key] ??= issueMessage(issue)
  }
  const [firstKey, firstMessage] = Object.entries(errors)[0] || []
  const message =
    firstMessage === 'Unknown field'
      ? `Unknown field: ${firstKey}`
      : firstMessage === 'This field is required'
        ? `${firstKey} is required`
        : firstMessage || 'Invalid request.'
  return new ApiError(400, message, { code: 'VALIDATION_ERROR', errors })
}

/**
 * Validates req.params / req.query / req.body against Zod schemas.
 * Parsed (typed, trimmed, defaulted) values are stored on req.valid.
 */
export function validate(schemas) {
  return (req, res, next) => {
    req.valid ??= {}
    for (const part of ['params', 'query', 'body']) {
      if (!schemas[part]) continue
      const result = schemas[part].safeParse(req[part] ?? {})
      if (!result.success) return next(zodErrorToApiError(result.error))
      req.valid[part] = result.data
    }
    next()
  }
}
