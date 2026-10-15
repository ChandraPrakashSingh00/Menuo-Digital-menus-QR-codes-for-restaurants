import crypto from 'node:crypto'

const MAX_LENGTH = 48

/** "The Spice Route!" -> "the-spice-route". Mirrors slugify() in the React app. */
export function slugify(value = '') {
  return value
    .toString()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_LENGTH)
    .replace(/-+$/g, '')
}

function randomSuffix() {
  return crypto.randomBytes(3).toString('hex')
}

/**
 * Returns a slug that `isTaken` reports as free. Tries "name", "name-2" … "name-9",
 * then falls back to a random suffix. The unique index on Restaurant.slug is the
 * final guard against races; callers retry on a duplicate-key error.
 */
export async function generateUniqueSlug(name, isTaken) {
  const base = slugify(name) || 'menu'
  const candidates = [base, ...Array.from({ length: 8 }, (_, i) => `${base}-${i + 2}`)]
  for (const candidate of candidates) {
    if (!(await isTaken(candidate))) return candidate
  }
  return `${base.slice(0, MAX_LENGTH - 7)}-${randomSuffix()}`
}

export function randomSlugVariant(name) {
  const base = slugify(name) || 'menu'
  return `${base.slice(0, MAX_LENGTH - 7)}-${randomSuffix()}`
}
