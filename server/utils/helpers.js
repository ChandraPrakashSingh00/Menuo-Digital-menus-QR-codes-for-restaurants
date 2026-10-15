import mongoose from 'mongoose'

/** Escapes user input so it can be used as a literal inside a RegExp. */
export function escapeRegex(value = '') {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function isObjectId(value) {
  return typeof value === 'string' && /^[a-f\d]{24}$/i.test(value) && mongoose.isValidObjectId(value)
}

export function paginate({ page = 1, limit = 20 }) {
  return { page, limit, skip: (page - 1) * limit }
}

export function paginationMeta({ page, limit, total }) {
  return { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) }
}

/** YYYY-MM-DD for `date` in the given IANA time zone. */
export function dayKey(date = new Date(), timeZone = 'UTC') {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
}

export function addDays(date, days) {
  return new Date(date.getTime() + days * 86400000)
}

export function isDuplicateKeyError(error) {
  return error?.code === 11000 || error?.cause?.code === 11000
}
