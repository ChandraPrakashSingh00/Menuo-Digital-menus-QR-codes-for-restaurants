// Defence in depth against NoSQL operator injection: drop object keys that start with "$"
// or contain "." from JSON bodies and route params. Zod schemas already reject anything
// that is not the expected primitive type; this covers any field that slips through.

const MAX_DEPTH = 20

function clean(value, depth = 0) {
  if (depth > MAX_DEPTH || value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) value[i] = clean(value[i], depth + 1)
    return value
  }
  for (const key of Object.keys(value)) {
    if (key.startsWith('$') || key.includes('.') || key === '__proto__' || key === 'constructor' || key === 'prototype') {
      delete value[key]
    } else {
      value[key] = clean(value[key], depth + 1)
    }
  }
  return value
}

export function sanitizeInput(req, res, next) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) clean(req.body)
  if (req.params) clean(req.params)
  next()
}
