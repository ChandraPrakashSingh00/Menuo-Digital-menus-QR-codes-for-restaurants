// Axios adapter that answers API calls from the localStorage mock database (demo mode).
// Every route mirrors the Express API in server/ — paths, validation, status codes, error
// codes and response shapes — so switching to the real backend only needs VITE_USE_MOCK=false.
// The HttpOnly session cookie is emulated with a localStorage key (see ./db).
// Payments are never simulated: checkout always answers 503, like a server without Razorpay keys.

import { AxiosError } from 'axios'
import { DEFAULT_BRAND_COLOR } from '../constants'
import { slugify } from '../utils'
import { clearSession, daysFromNow, getDb, getSession, isoDay, saveDb, setSession, uid } from './db'

// Default error codes per status, as in server/utils/ApiError.js.
const DEFAULT_CODES = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHENTICATED',
  402: 'SUBSCRIPTION_INACTIVE',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  503: 'SERVICE_UNAVAILABLE',
}

class HttpError extends Error {
  constructor(status, message, { code, errors } = {}) {
    super(message)
    this.status = status
    this.code = code || DEFAULT_CODES[status]
    this.errors = errors
  }
}

const routes = []
function route(method, path, handler, { auth = true } = {}) {
  const keys = []
  const pattern = new RegExp(
    '^' + path.replace(/:(\w+)/g, (_, key) => (keys.push(key), '([^/]+)')) + '/?$',
  )
  routes.push({ method, pattern, keys, handler, auth })
}

// ---------- config (server/config/plans.js and the server's env defaults) ----------

const DAY_MS = 86400000
const TRIAL_DAYS = 7
const PAYMENT_GRACE_MS = 3 * DAY_MS
const MAX_RESTAURANTS_PER_OWNER = 10
const MAX_CATEGORIES = 200

// Amounts are in paise (₹1 = 100 paise), like the server.
const PLANS = {
  starter: { id: 'starter', name: 'Starter', amount: 19900, currency: 'INR', interval: 'monthly', itemLimit: 50 },
  pro: { id: 'pro', name: 'Pro', amount: 39900, currency: 'INR', interval: 'monthly', itemLimit: null },
}
const PLAN_IDS = Object.keys(PLANS)

function getPlan(planId) {
  return PLANS[planId] || PLANS.starter
}

function publicPlan(planId) {
  const plan = getPlan(planId)
  return { ...plan, price: plan.amount / 100 }
}

const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED']
const ITEM_TAGS = ['veg', 'non-veg', 'vegan', 'spicy', 'gluten-free', 'bestseller']
const MAX_PRICE = 1_000_000

const PAYMENTS_DISABLED =
  'Payments are not available in demo mode. Connect the real backend with Razorpay test keys to try checkout.'
const MENU_UNAVAILABLE = 'This menu is not available right now.'

// ---------- helpers ----------

const clone = (value) => JSON.parse(JSON.stringify(value))
const nowIso = () => new Date().toISOString()
const time = (value) => (value ? new Date(value).getTime() : null)
const bySortOrder = (a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt)

function pick(source, fields) {
  return Object.fromEntries(fields.filter((f) => source[f] !== undefined).map((f) => [f, source[f]]))
}

function paginationMeta({ page, limit, total }) {
  return { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) }
}

function nextSortOrder(records) {
  return records.length ? Math.floor(Math.max(...records.map((r) => r.sortOrder))) + 1 : 0
}

function publicUser(user) {
  const { password: _password, ...rest } = user
  return clone(rest)
}

function serializeRestaurant(restaurant) {
  const { ownerId: _ownerId, archivedAt: _archivedAt, ...data } = restaurant
  return clone(data)
}

function serializeItem(item, categoryName) {
  const data = clone(item)
  return categoryName === undefined ? data : { ...data, category: categoryName }
}

const emailTaken = () =>
  new HttpError(409, 'An account with this email already exists.', {
    code: 'EMAIL_TAKEN',
    errors: { email: 'Email already registered' },
  })

/** "name", "name-2" … "name-9", then a random suffix, like server/utils/generateSlug.js. */
function uniqueSlug(name) {
  const db = getDb()
  // Archived restaurants keep their slug reserved so old QR codes can't be taken over.
  const taken = (slug) => db.restaurants.some((r) => r.slug === slug)
  const base = slugify(name).replace(/-+$/, '') || 'menu'
  const candidates = [base, ...Array.from({ length: 8 }, (_, i) => `${base}-${i + 2}`)]
  let slug = candidates.find((candidate) => !taken(candidate))
  while (!slug || taken(slug)) {
    slug = `${base.slice(0, 41)}-${Math.random().toString(16).slice(2, 8).padEnd(6, '0')}`
  }
  return slug
}

// ---------- validation (mirrors server/validators/schemas.js) ----------

class FieldError extends Error {}

function invalid(message) {
  throw new FieldError(message)
}

function validationError(errors) {
  const [key, message] = Object.entries(errors)[0]
  const summary =
    message === 'Unknown field' ? `Unknown field: ${key}` : message === 'This field is required' ? `${key} is required` : message
  return new HttpError(400, summary, { code: 'VALIDATION_ERROR', errors })
}

/**
 * Parses a body or query like the server's Zod schemas: values are type-checked and
 * trimmed, unknown keys are rejected when `strict`, and any problem becomes
 * 400 { code: 'VALIDATION_ERROR', errors: { field: message } }.
 */
function parseInput(input, fields, { required = [], strict = true, nonEmpty = false } = {}) {
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {}
  const allowed = Object.keys(fields)
  const data = {}
  const errors = {}
  for (const key of allowed) {
    if (source[key] === undefined && !required.includes(key)) continue
    try {
      data[key] = fields[key](source[key])
    } catch (error) {
      if (!(error instanceof FieldError)) throw error
      errors[key] = error.message
    }
  }
  if (strict) {
    for (const key of Object.keys(source)) if (!allowed.includes(key)) errors[key] = 'Unknown field'
  }
  if (nonEmpty && !Object.keys(errors).length && !Object.keys(data).length) {
    errors._ = 'Send at least one field to update'
  }
  if (Object.keys(errors).length) throw validationError(errors)
  return data
}

const text = (label, max, min = 0) => (value) => {
  if (typeof value !== 'string') invalid(value === undefined ? `${label} is required` : `${label} must be text`)
  const trimmed = value.trim()
  if (trimmed.length < min) invalid(`${label} is required`)
  if (trimmed.length > max) invalid(`${label} must be at most ${max} characters`)
  return trimmed
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function emailField(value) {
  if (typeof value !== 'string') invalid(value === undefined ? 'Email is required' : 'Email must be text')
  const email = value.trim().toLowerCase()
  if (email.length > 254) invalid('Email is too long')
  if (!EMAIL_PATTERN.test(email)) invalid('Enter a valid email address')
  return email
}

const optionalEmail = (value) => (value === '' ? '' : emailField(value))

function passwordField(value) {
  if (typeof value !== 'string') invalid(value === undefined ? 'Password is required' : 'Password must be text')
  if (value.length < 8) invalid('Password must be at least 8 characters')
  if (value.length > 72) invalid('Password must be at most 72 characters')
  if (new TextEncoder().encode(value).length > 72) invalid('Password is too long')
  return value
}

/** A password that is only compared (login, current password), never stored. */
const secret = (label) => (value) => {
  if (typeof value !== 'string' || !value) invalid(`${label} is required`)
  if (value.length > 200) invalid(`${label} is too long`)
  return value
}

const DATA_URL = /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/
const MAX_IMAGE_CHARS = 1_500_000 // ~1.1 MB once decoded

function isHttpUrl(value) {
  if (value.length > 2048) return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

/** An http(s) image URL, a base64 image data URL, or "" to clear. */
function imageField(value) {
  if (typeof value !== 'string') invalid('Image must be a URL')
  const image = value.trim()
  if (image.length > MAX_IMAGE_CHARS) invalid('Image is too large (max 1 MB)')
  if (image && !DATA_URL.test(image) && !isHttpUrl(image)) {
    invalid('Use an http(s) image URL or upload a PNG, JPG or WebP image')
  }
  return image
}

function hexColor(value) {
  const color = typeof value === 'string' ? value.trim() : ''
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) invalid('Use a hex colour like #05805F')
  return color
}

const phoneText = text('Phone', 30)
function phone(value) {
  const result = phoneText(value)
  if (!/^[0-9+()\-.\s]*$/.test(result)) invalid('Enter a valid phone number')
  return result
}

const oneOf = (values, message) => (value) => (values.includes(value) ? value : invalid(message))
const boolean = (label) => (value) => (typeof value === 'boolean' ? value : invalid(`${label} must be true or false`))

/** Record ids are opaque strings here; the server also checks the MongoDB ObjectId format. */
const recordId = (label) => (value) => {
  if (value === undefined) invalid('This field is required')
  if (typeof value !== 'string' || !value.trim()) invalid(`Invalid ${label}`)
  return value
}

function price(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    invalid(value === undefined ? 'Price is required' : 'Price must be a number')
  }
  if (value < 0) invalid('Price cannot be negative')
  if (value > MAX_PRICE) invalid('Price is too high')
  return Math.round(value * 100) / 100
}

function sortOrder(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > 1e6) {
    invalid('Sort order must be a number between -1000000 and 1000000')
  }
  return value
}

function tags(value) {
  if (!Array.isArray(value)) invalid('Tags must be a list')
  if (value.length > ITEM_TAGS.length) invalid(`Use at most ${ITEM_TAGS.length} tags`)
  if (value.some((tag) => !ITEM_TAGS.includes(tag))) invalid('Unknown tag')
  return [...new Set(value)]
}

function categoryIds(value) {
  if (!Array.isArray(value)) invalid(value === undefined ? 'This field is required' : 'ids must be a list')
  if (!value.length) invalid('Send the category ids in their new order')
  if (value.length > 500) invalid('Too many categories')
  for (const id of value) if (typeof id !== 'string' || !id.trim()) invalid('Invalid category')
  return value
}

/** Query numbers arrive as strings over HTTP and are coerced, like z.coerce.number(). */
const wholeNumber = (label, max) => (value) => {
  const number = Number(value)
  if (value === '' || !Number.isInteger(number) || number < 1 || number > max) {
    invalid(`${label} must be a whole number from 1 to ${max}`)
  }
  return number
}

function queryBoolean(value) {
  if (value === true || value === 'true') return true
  if (value === false || value === 'false') return false
  return invalid('Use true or false')
}

const REGISTER_FIELDS = { name: text('Name', 80, 2), email: emailField, password: passwordField }
const LOGIN_FIELDS = { email: emailField, password: secret('Password') }
const PROFILE_FIELDS = { name: text('Name', 80, 2), email: emailField }
const PASSWORD_FIELDS = { currentPassword: secret('Current password'), newPassword: passwordField }

// `slug` is intentionally absent: menu links are permanent once created.
const RESTAURANT_FIELDS = {
  name: text('Restaurant name', 80, 1),
  logo: imageField,
  cover: imageField,
  brandColor: hexColor,
  description: text('Description', 240),
  cuisine: text('Cuisine', 80),
  address: text('Address', 200),
  phone,
  email: optionalEmail,
  openingHours: text('Opening hours', 120),
  currency: oneOf(CURRENCIES, 'Unsupported currency'),
  isPublished: boolean('isPublished'),
}
const CREATE_RESTAURANT_FIELDS = { ...RESTAURANT_FIELDS, plan: oneOf(PLAN_IDS, 'Unknown plan') }

const ITEM_FIELDS = {
  categoryId: recordId('category'),
  name: text('Item name', 80, 1),
  description: text('Description', 300),
  price,
  imageUrl: imageField,
  tags,
  isAvailable: boolean('isAvailable'),
  isFeatured: boolean('isFeatured'),
  sortOrder,
}

const CATEGORY_FIELDS = {
  name: text('Category name', 40, 1),
  description: text('Description', 200),
  isVisible: boolean('isVisible'),
  sortOrder,
}

const ITEMS_QUERY = {
  categoryId: recordId('category'),
  search: text('Search', 100),
  available: queryBoolean,
  page: wholeNumber('page', 100000),
  limit: wholeNumber('limit', 500),
}

const RESTAURANT_REF = { restaurantId: recordId('restaurant id') }
const PAYMENTS_QUERY = { ...RESTAURANT_REF, page: wholeNumber('page', 100000), limit: wholeNumber('limit', 50) }

// ---------- ownership (server/services/ownershipService.js) ----------
// Records of other owners are reported as "not found" so their existence isn't revealed.

function ownedRestaurant(db, id, user) {
  const restaurant = db.restaurants.find((r) => r.id === id && r.ownerId === user.id && !r.archivedAt)
  if (!restaurant) throw new HttpError(404, 'Restaurant not found.')
  return restaurant
}

function ownedItem(db, id, user) {
  const item = db.items.find((i) => i.id === id)
  const restaurant = item && db.restaurants.find((r) => r.id === item.restaurantId && r.ownerId === user.id && !r.archivedAt)
  if (!item || !restaurant) throw new HttpError(404, 'Menu item not found.')
  return { item, restaurant }
}

function ownedCategory(db, id, user) {
  const category = db.categories.find((c) => c.id === id)
  const restaurant =
    category && db.restaurants.find((r) => r.id === category.restaurantId && r.ownerId === user.id && !r.archivedAt)
  if (!category || !restaurant) throw new HttpError(404, 'Category not found.')
  return { category, restaurant }
}

/** A category of the given restaurant, or a 400 if the client sent a foreign one. */
function restaurantCategory(db, restaurantId, categoryId) {
  const category = db.categories.find((c) => c.id === categoryId && c.restaurantId === restaurantId)
  if (!category) {
    throw new HttpError(400, 'Choose a category from this restaurant.', {
      code: 'INVALID_CATEGORY',
      errors: { categoryId: 'Category not found' },
    })
  }
  return category
}

// ---------- subscriptions (server/services/subscriptionService.js) ----------

/** Whether the restaurant may use paid features right now (edit menu, public menu online). */
function computeAccess(sub, now = Date.now()) {
  if (!sub) return false
  const end = time(sub.currentPeriodEnd)
  switch (sub.status) {
    case 'trialing':
      return Boolean(sub.trialEndsAt) && time(sub.trialEndsAt) > now
    case 'active':
      return end === null || end + PAYMENT_GRACE_MS > now
    case 'past_due':
      return end !== null && end + PAYMENT_GRACE_MS > now
    case 'cancelled':
      // Already granted (trial) time is honoured until the period ends.
      return end !== null && end > now
    default:
      return false
  }
}

function nextLifecycleStatus(sub, now = Date.now()) {
  const end = time(sub.currentPeriodEnd)
  if (sub.status === 'trialing' && (!sub.trialEndsAt || time(sub.trialEndsAt) <= now)) return 'expired'
  if (sub.status === 'active' && end !== null && end <= now) return 'past_due'
  if (sub.status === 'past_due' && (end === null || end + PAYMENT_GRACE_MS <= now)) return 'expired'
  return sub.status
}

function newSubscription(restaurant, plan, trial) {
  const now = nowIso()
  return {
    id: uid('sub_'),
    restaurantId: restaurant.id,
    ownerId: restaurant.ownerId,
    plan,
    status: trial ? 'trialing' : 'expired',
    trialStartedAt: trial ? now : null,
    trialEndsAt: trial ? daysFromNow(TRIAL_DAYS) : null,
    currentPeriodStart: null,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    cancelledAt: null,
    gatewaySubscriptionId: null,
    createdAt: now,
    updatedAt: now,
  }
}

/** The owner's first restaurant gets the free trial; later ones start without access. */
function createInitialSubscription(db, user, restaurant, plan) {
  const trial = TRIAL_DAYS > 0 && !user.trialUsedAt
  if (trial) user.trialUsedAt = nowIso()
  const subscription = newSubscription(restaurant, plan, trial)
  db.subscriptions.push(subscription)
  return subscription
}

/** Loads (or lazily creates) the restaurant's subscription with time-based transitions applied. */
function getSubscription(db, restaurant) {
  let sub = db.subscriptions.find((s) => s.restaurantId === restaurant.id)
  let changed = false
  if (!sub) {
    sub = newSubscription(restaurant, 'starter', false)
    db.subscriptions.push(sub)
    changed = true
  }
  for (let next = nextLifecycleStatus(sub); next !== sub.status; next = nextLifecycleStatus(sub)) {
    Object.assign(sub, { status: next, updatedAt: nowIso() })
    changed = true
  }
  if (changed) saveDb()
  return sub
}

function serializeSubscription(sub) {
  return {
    id: sub.id,
    restaurantId: sub.restaurantId,
    plan: sub.plan,
    status: sub.status,
    hasAccess: computeAccess(sub),
    trialUsed: Boolean(sub.trialStartedAt),
    trialStartedAt: sub.trialStartedAt,
    trialEndsAt: sub.trialEndsAt,
    currentPeriodStart: sub.currentPeriodStart,
    currentPeriodEnd: sub.currentPeriodEnd,
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    cancelledAt: sub.cancelledAt,
    isPaid: Boolean(sub.gatewaySubscriptionId),
    pendingPlan: null, // a checkout never starts in demo mode
    updatedAt: sub.updatedAt,
  }
}

function inactiveMessage(sub) {
  switch (sub.status) {
    case 'trialing':
    case 'expired':
      return sub.trialStartedAt
        ? 'Your free trial or subscription has ended. Choose a plan to keep editing your menu.'
        : 'Choose a plan to start building your menu.'
    case 'past_due':
      return 'Your last payment did not go through. Renew your plan to keep editing your menu.'
    case 'cancelled':
      return 'Your subscription has ended. Subscribe again to keep editing your menu.'
    default:
      return 'An active subscription is required for this action.'
  }
}

/** The subscription of a restaurant whose menu may be edited, or a 402. */
function writableSubscription(db, restaurant) {
  const subscription = getSubscription(db, restaurant)
  if (!computeAccess(subscription)) throw new HttpError(402, inactiveMessage(subscription))
  return subscription
}

function assertCanAddItems(db, restaurant, subscription, adding = 1) {
  const plan = getPlan(subscription.plan)
  if (plan.itemLimit == null) return
  const count = db.items.filter((i) => i.restaurantId === restaurant.id).length
  if (count + adding > plan.itemLimit) {
    throw new HttpError(
      403,
      `Your ${plan.name} plan allows up to ${plan.itemLimit} menu items. Upgrade to Pro for unlimited items.`,
      { code: 'PLAN_LIMIT_REACHED' },
    )
  }
}

function subscriptionSummary(db, restaurant, subscription) {
  return {
    subscription: serializeSubscription(subscription),
    plan: publicPlan(subscription.plan),
    usage: {
      items: db.items.filter((i) => i.restaurantId === restaurant.id).length,
      itemLimit: getPlan(subscription.plan).itemLimit,
    },
    paymentsEnabled: false,
  }
}

function paymentsUnavailable() {
  throw new HttpError(503, PAYMENTS_DISABLED, { code: 'PAYMENTS_NOT_CONFIGURED' })
}

// ---------- auth ----------

route('GET', '/auth/csrf', () => ({ data: { csrfToken: 'mock-csrf-token' } }), { auth: false })

route('POST', '/auth/register', ({ body }) => {
  const data = parseInput(body, REGISTER_FIELDS, { required: ['name', 'email', 'password'] })
  const db = getDb()
  if (db.users.some((u) => u.email === data.email)) throw emailTaken()

  const now = nowIso()
  const user = { id: uid('usr_'), ...data, role: 'owner', trialUsedAt: null, lastLoginAt: null, createdAt: now, updatedAt: now }
  db.users.push(user)
  saveDb()
  setSession(user.id)
  return { status: 201, data: { user: publicUser(user) } }
}, { auth: false })

route('POST', '/auth/login', ({ body }) => {
  const { email, password } = parseInput(body, LOGIN_FIELDS, { required: ['email', 'password'] })
  const user = getDb().users.find((u) => u.email === email)
  if (!user || user.password !== password) {
    throw new HttpError(401, 'Incorrect email or password.', { code: 'INVALID_CREDENTIALS' })
  }
  user.lastLoginAt = nowIso()
  saveDb()
  setSession(user.id)
  return { data: { user: publicUser(user) } }
}, { auth: false })

route('POST', '/auth/logout', () => {
  clearSession()
  return { data: { message: 'Logged out.' } }
}, { auth: false })

route('GET', '/auth/me', ({ user }) => ({ data: { user: publicUser(user) } }))

route('PATCH', '/auth/profile', ({ user, body }) => {
  const data = parseInput(body, PROFILE_FIELDS, { nonEmpty: true })
  if (data.email && data.email !== user.email && getDb().users.some((u) => u.email === data.email && u.id !== user.id)) {
    throw emailTaken()
  }
  Object.assign(user, data, { updatedAt: nowIso() })
  saveDb()
  return { data: { user: publicUser(user) } }
})

route('PATCH', '/auth/password', ({ user, body }) => {
  const { currentPassword, newPassword } = parseInput(body, PASSWORD_FIELDS, { required: ['currentPassword', 'newPassword'] })
  if (user.password !== currentPassword) {
    // 400, not 401: a wrong password here must not log the user out of the app.
    throw new HttpError(400, 'Current password is incorrect.', {
      code: 'INVALID_PASSWORD',
      errors: { currentPassword: 'Incorrect password' },
    })
  }
  Object.assign(user, { password: newPassword, updatedAt: nowIso() })
  saveDb()
  return { data: { message: 'Password updated. You have been signed out on other devices.' } }
})

// ---------- restaurants ----------

route('GET', '/restaurants/mine', ({ user }) => {
  const db = getDb()
  const restaurants = db.restaurants
    .filter((r) => r.ownerId === user.id && !r.archivedAt)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  return { data: { restaurants: restaurants.map(serializeRestaurant) } }
})

route('POST', '/restaurants', ({ user, body }) => {
  const { plan = 'starter', ...fields } = parseInput(body, CREATE_RESTAURANT_FIELDS, { required: ['name'] })
  const db = getDb()
  const owned = db.restaurants.filter((r) => r.ownerId === user.id && !r.archivedAt).length
  if (owned >= MAX_RESTAURANTS_PER_OWNER) {
    throw new HttpError(403, `You can manage up to ${MAX_RESTAURANTS_PER_OWNER} restaurants per account.`, {
      code: 'RESTAURANT_LIMIT',
    })
  }

  const now = nowIso()
  const restaurant = {
    id: uid('rst_'),
    ownerId: user.id,
    slug: uniqueSlug(fields.name),
    logo: '',
    cover: '',
    brandColor: DEFAULT_BRAND_COLOR,
    description: '',
    cuisine: '',
    address: '',
    phone: '',
    email: '',
    openingHours: '',
    currency: 'INR',
    isPublished: true,
    ...fields,
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
  }
  db.restaurants.push(restaurant)
  const subscription = createInitialSubscription(db, user, restaurant, plan)
  saveDb()
  return {
    status: 201,
    data: { restaurant: serializeRestaurant(restaurant), subscription: serializeSubscription(subscription) },
  }
})

route('GET', '/restaurants/:id', ({ user, params }) => ({
  data: { restaurant: serializeRestaurant(ownedRestaurant(getDb(), params.id, user)) },
}))

route('PATCH', '/restaurants/:id', ({ user, params, body }) => {
  const data = parseInput(body, RESTAURANT_FIELDS, { nonEmpty: true })
  const restaurant = ownedRestaurant(getDb(), params.id, user)
  Object.assign(restaurant, data, { updatedAt: nowIso() })
  saveDb()
  return { data: { restaurant: serializeRestaurant(restaurant) } }
})

// Archives, never hard-deletes: the slug stays reserved so printed QR codes can't be hijacked.
route('DELETE', '/restaurants/:id', ({ user, params }) => {
  const restaurant = ownedRestaurant(getDb(), params.id, user)
  const now = nowIso()
  Object.assign(restaurant, { archivedAt: now, isPublished: false, updatedAt: now })
  saveDb()
  return { data: { message: 'Restaurant deleted.', id: restaurant.id } }
})

route('GET', '/restaurants/:id/stats', ({ user, params }) => {
  const db = getDb()
  const restaurant = ownedRestaurant(db, params.id, user)
  const items = db.items.filter((i) => i.restaurantId === restaurant.id)
  const views = db.views.filter((v) => v.restaurantId === restaurant.id)
  const countByDay = Object.fromEntries(views.map((v) => [v.date, v.count]))

  const viewsByDay = Array.from({ length: 14 }, (_, i) => {
    const date = isoDay(Date.now() - (13 - i) * DAY_MS)
    return { date, count: countByDay[date] || 0 }
  })
  const sum = (list) => list.reduce((total, day) => total + day.count, 0)
  const views7d = sum(viewsByDay.slice(7))
  const previous7d = sum(viewsByDay.slice(0, 7))

  return {
    data: {
      totals: {
        items: items.length,
        availableItems: items.filter((i) => i.isAvailable).length,
        categories: db.categories.filter((c) => c.restaurantId === restaurant.id).length,
        views7d,
        viewsChange: previous7d ? Math.round(((views7d - previous7d) / previous7d) * 100) : null,
        viewsTotal: sum(views),
      },
      viewsByDay,
      recentItems: [...items]
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, 5)
        .map((item) => serializeItem(item)),
    },
  }
})

// ---------- menu ----------
// Order matters: /menu/item/… and /menu/category/… are registered before /menu/:restaurantId.

function categoryNames(db, restaurantId) {
  return Object.fromEntries(db.categories.filter((c) => c.restaurantId === restaurantId).map((c) => [c.id, c.name]))
}

function withItemCount(db, category) {
  return { ...clone(category), itemCount: db.items.filter((i) => i.categoryId === category.id).length }
}

function categoriesFor(db, restaurantId) {
  return db.categories
    .filter((c) => c.restaurantId === restaurantId)
    .sort(bySortOrder)
    .map((c) => withItemCount(db, c))
}

route('PATCH', '/menu/item/:id', ({ user, params, body }) => {
  const data = parseInput(body, ITEM_FIELDS, { nonEmpty: true })
  const db = getDb()
  const { item, restaurant } = ownedItem(db, params.id, user)
  writableSubscription(db, restaurant)
  const category = restaurantCategory(db, restaurant.id, data.categoryId ?? item.categoryId)
  Object.assign(item, data, { updatedAt: nowIso() })
  saveDb()
  return { data: { item: serializeItem(item, category.name) } }
})

// Allowed even without an active plan, so owners can trim their menu.
route('DELETE', '/menu/item/:id', ({ user, params }) => {
  const db = getDb()
  const { item } = ownedItem(db, params.id, user)
  db.items = db.items.filter((i) => i.id !== item.id)
  saveDb()
  return { data: { message: 'Item deleted.', id: item.id } }
})

route('POST', '/menu/item/:id/duplicate', ({ user, params }) => {
  const db = getDb()
  const { item: source, restaurant } = ownedItem(db, params.id, user)
  const subscription = writableSubscription(db, restaurant)
  assertCanAddItems(db, restaurant, subscription)

  const now = nowIso()
  const copy = {
    ...clone(source),
    id: uid('itm_'),
    name: `${source.name} (copy)`.slice(0, 80),
    sortOrder: source.sortOrder + 0.5,
    createdAt: now,
    updatedAt: now,
  }
  db.items.push(copy)
  saveDb()
  return { status: 201, data: { item: serializeItem(copy, categoryNames(db, restaurant.id)[copy.categoryId] || null) } }
})

route('PATCH', '/menu/category/:id', ({ user, params, body }) => {
  const data = parseInput(body, CATEGORY_FIELDS, { nonEmpty: true })
  const db = getDb()
  const { category, restaurant } = ownedCategory(db, params.id, user)
  writableSubscription(db, restaurant)
  Object.assign(category, data, { updatedAt: nowIso() })
  saveDb()
  return { data: { category: withItemCount(db, category) } }
})

// Also deletes the items in it. Allowed even without an active plan.
route('DELETE', '/menu/category/:id', ({ user, params }) => {
  const db = getDb()
  const { category } = ownedCategory(db, params.id, user)
  const before = db.items.length
  db.items = db.items.filter((i) => !(i.restaurantId === category.restaurantId && i.categoryId === category.id))
  db.categories = db.categories.filter((c) => c.id !== category.id)
  saveDb()
  return { data: { message: 'Category deleted.', id: category.id, deletedItems: before - db.items.length } }
})

route('GET', '/menu/:restaurantId/categories', ({ user, params }) => {
  const db = getDb()
  const restaurant = ownedRestaurant(db, params.restaurantId, user)
  return { data: { categories: categoriesFor(db, restaurant.id) } }
})

route('POST', '/menu/:restaurantId/categories', ({ user, params, body }) => {
  const data = parseInput(body, CATEGORY_FIELDS, { required: ['name'] })
  const db = getDb()
  const restaurant = ownedRestaurant(db, params.restaurantId, user)
  writableSubscription(db, restaurant)
  const existing = db.categories.filter((c) => c.restaurantId === restaurant.id)
  if (existing.length >= MAX_CATEGORIES) {
    throw new HttpError(403, `A menu can have up to ${MAX_CATEGORIES} categories.`, { code: 'CATEGORY_LIMIT' })
  }

  const now = nowIso()
  const category = {
    id: uid('cat_'),
    restaurantId: restaurant.id,
    description: '',
    isVisible: true,
    ...data,
    sortOrder: data.sortOrder ?? nextSortOrder(existing),
    createdAt: now,
    updatedAt: now,
  }
  db.categories.push(category)
  saveDb()
  return { status: 201, data: { category: { ...clone(category), itemCount: 0 } } }
})

route('PUT', '/menu/:restaurantId/categories/order', ({ user, params, body }) => {
  const { ids } = parseInput(body, { ids: categoryIds }, { required: ['ids'] })
  const db = getDb()
  const restaurant = ownedRestaurant(db, params.restaurantId, user)
  writableSubscription(db, restaurant)

  const categories = [...new Set(ids)].map((id) => db.categories.find((c) => c.id === id && c.restaurantId === restaurant.id))
  if (categories.some((c) => !c)) {
    throw new HttpError(400, 'Some categories do not belong to this restaurant.', { code: 'INVALID_CATEGORY' })
  }
  const now = nowIso()
  categories.forEach((category, index) => Object.assign(category, { sortOrder: index, updatedAt: now }))
  saveDb()
  return { data: { categories: categoriesFor(db, restaurant.id) } }
})

route('GET', '/menu/:restaurantId', ({ user, params, query }) => {
  const { categoryId, search, available, page = 1, limit = 100 } = parseInput(query, ITEMS_QUERY, { strict: false })
  const db = getDb()
  const restaurant = ownedRestaurant(db, params.restaurantId, user)
  const term = search?.toLowerCase()

  const matches = db.items
    .filter((i) => i.restaurantId === restaurant.id)
    .filter((i) => !categoryId || i.categoryId === categoryId)
    .filter((i) => available === undefined || i.isAvailable === available)
    .filter((i) => !term || i.name.toLowerCase().includes(term) || i.description.toLowerCase().includes(term))
    .sort(bySortOrder)
  const names = categoryNames(db, restaurant.id)

  return {
    data: {
      items: matches.slice((page - 1) * limit, page * limit).map((item) => serializeItem(item, names[item.categoryId] || null)),
      pagination: paginationMeta({ page, limit, total: matches.length }),
    },
  }
})

route('POST', '/menu/:restaurantId', ({ user, params, body }) => {
  const data = parseInput(body, ITEM_FIELDS, { required: ['categoryId', 'name', 'price'] })
  const db = getDb()
  const restaurant = ownedRestaurant(db, params.restaurantId, user)
  const subscription = writableSubscription(db, restaurant)
  const category = restaurantCategory(db, restaurant.id, data.categoryId)
  assertCanAddItems(db, restaurant, subscription)

  const now = nowIso()
  const siblings = db.items.filter((i) => i.restaurantId === restaurant.id && i.categoryId === category.id)
  const item = {
    id: uid('itm_'),
    restaurantId: restaurant.id,
    description: '',
    imageUrl: '',
    tags: [],
    isAvailable: true,
    isFeatured: false,
    ...data,
    sortOrder: data.sortOrder ?? nextSortOrder(siblings),
    createdAt: now,
    updatedAt: now,
  }
  db.items.push(item)
  saveDb()
  return { status: 201, data: { item: serializeItem(item, category.name) } }
})

// ---------- subscriptions ----------

route('GET', '/subscriptions/plans', () => ({
  data: { plans: PLAN_IDS.map(publicPlan), trialDays: TRIAL_DAYS, paymentsEnabled: false },
}), { auth: false })

route('GET', '/subscriptions/current', ({ user, query }) => {
  const { restaurantId } = parseInput(query, RESTAURANT_REF, { required: ['restaurantId'], strict: false })
  const db = getDb()
  const restaurant = ownedRestaurant(db, restaurantId, user)
  return { data: subscriptionSummary(db, restaurant, getSubscription(db, restaurant)) }
})

route('GET', '/subscriptions/payments', ({ user, query }) => {
  const { restaurantId, page = 1, limit = 10 } = parseInput(query, PAYMENTS_QUERY, { required: ['restaurantId'], strict: false })
  ownedRestaurant(getDb(), restaurantId, user)
  // No payment can exist in demo mode: checkout is never simulated.
  return { data: { payments: [], pagination: paginationMeta({ page, limit, total: 0 }) } }
})

// Never simulated: the demo must not pretend a payment succeeded or change the plan.
route('POST', '/subscriptions/checkout', paymentsUnavailable)
route('POST', '/subscriptions/verify', paymentsUnavailable)

route('POST', '/subscriptions/cancel', ({ user, body }) => {
  const { restaurantId } = parseInput(body, RESTAURANT_REF, { required: ['restaurantId'] })
  const db = getDb()
  const restaurant = ownedRestaurant(db, restaurantId, user)
  const subscription = getSubscription(db, restaurant)
  // Without payments there are no paid subscriptions, so only a running trial can be cancelled.
  if (subscription.status !== 'trialing') {
    throw new HttpError(409, 'There is no active subscription to cancel.', { code: 'NOTHING_TO_CANCEL' })
  }
  const now = nowIso()
  Object.assign(subscription, {
    status: 'cancelled',
    cancelledAt: now,
    currentPeriodEnd: subscription.trialEndsAt, // trial time already granted is kept
    updatedAt: now,
  })
  saveDb()
  return { data: subscriptionSummary(db, restaurant, getSubscription(db, restaurant)) }
})

// ---------- public menu (no session) ----------

const PUBLIC_RESTAURANT_FIELDS = ['name', 'slug', 'logo', 'cover', 'brandColor', 'description', 'cuisine', 'address', 'phone', 'openingHours', 'currency']
const PUBLIC_CATEGORY_FIELDS = ['id', 'name', 'description', 'sortOrder']
const PUBLIC_ITEM_FIELDS = ['id', 'categoryId', 'name', 'description', 'price', 'imageUrl', 'tags', 'isAvailable', 'isFeatured', 'sortOrder']

/** Only published, non-archived restaurants with an active plan or trial are online. */
function liveRestaurant(db, rawSlug) {
  const slug = String(rawSlug).toLowerCase()
  if (!/^[a-z0-9-]{1,64}$/.test(slug)) {
    throw new HttpError(400, 'Invalid menu link', { code: 'VALIDATION_ERROR', errors: { slug: 'Invalid menu link' } })
  }
  const restaurant = db.restaurants.find((r) => r.slug === slug && r.isPublished && !r.archivedAt)
  const subscription = restaurant && getSubscription(db, restaurant)
  if (!restaurant || !computeAccess(subscription)) throw new HttpError(404, MENU_UNAVAILABLE, { code: 'MENU_UNAVAILABLE' })
  return { restaurant, subscription }
}

route('GET', '/public/menu/:slug', ({ params }) => {
  const db = getDb()
  const { restaurant, subscription } = liveRestaurant(db, params.slug)
  const categories = db.categories.filter((c) => c.restaurantId === restaurant.id && c.isVisible).sort(bySortOrder)
  const visibleIds = new Set(categories.map((c) => c.id))
  const items = db.items
    .filter((i) => i.restaurantId === restaurant.id && i.isAvailable && visibleIds.has(i.categoryId))
    .sort(bySortOrder)

  // Never exposes owner details, internal restaurant/owner ids or billing data.
  return {
    data: clone({
      restaurant: pick(restaurant, PUBLIC_RESTAURANT_FIELDS),
      categories: categories.map((c) => pick(c, PUBLIC_CATEGORY_FIELDS)),
      items: items.map((i) => pick(i, PUBLIC_ITEM_FIELDS)),
      showBranding: getPlan(subscription.plan).id === 'starter',
    }),
  }
}, { auth: false })

route('POST', '/public/menu/:slug/views', ({ params }) => {
  const db = getDb()
  const { restaurant } = liveRestaurant(db, params.slug)
  const today = isoDay()
  const record = db.views.find((v) => v.restaurantId === restaurant.id && v.date === today)
  if (record) record.count += 1
  else db.views.push({ restaurantId: restaurant.id, date: today, count: 1 })
  saveDb()
  return { data: { recorded: true } }
}, { auth: false })

// ---------- adapter ----------

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** Stand-in for server/middleware/auth.js: the session "cookie" is a user id in localStorage. */
function sessionUser() {
  const userId = getSession()
  if (!userId) throw new HttpError(401, 'Please log in to continue.')
  const user = getDb().users.find((u) => u.id === userId)
  if (!user) {
    clearSession()
    throw new HttpError(401, 'Your session has expired. Please log in again.')
  }
  return user
}

function readBody(data) {
  if (typeof data !== 'string') return data || {}
  if (!data) return {}
  try {
    return JSON.parse(data)
  } catch {
    throw new HttpError(400, 'Request body is not valid JSON.', { code: 'INVALID_JSON' })
  }
}

function readQuery(search, params) {
  const query = { ...Object.fromEntries(new URLSearchParams(search)), ...(params || {}) }
  // Like axios, null and undefined params are not sent at all.
  return Object.fromEntries(Object.entries(query).filter(([, value]) => value !== undefined && value !== null))
}

export async function mockAdapter(config) {
  await delay(180 + Math.random() * 320)

  const method = config.method.toUpperCase()
  const [path, search = ''] = (config.url || '').replace(/^https?:\/\/[^/]+/, '').replace(/^\/api/, '').split('?')

  const respond = (status, data) => ({
    data,
    status,
    statusText: status < 400 ? 'OK' : 'Error',
    headers: { 'content-type': 'application/json' },
    config,
    request: {},
  })

  try {
    const match = routes.find((r) => r.method === method && r.pattern.test(path))
    if (!match) throw new HttpError(404, `No mock route for ${method} ${path}`)

    const values = path.match(match.pattern).slice(1)
    const params = Object.fromEntries(match.keys.map((key, i) => [key, decodeURIComponent(values[i])]))
    const user = match.auth ? sessionUser() : null

    const result = match.handler({ body: readBody(config.data), params, query: readQuery(search, config.params), user })
    return respond(result.status || 200, result.data)
  } catch (error) {
    // Errors leave the mock as { message, code?, errors? }, like server/middleware/errorHandler.js.
    const known = Boolean(error.status)
    if (!known) console.error('[mock api]', error)
    const status = error.status || 500
    const message = known ? error.message : 'Something went wrong on our side. Please try again.'
    const code = error.code || (known ? undefined : 'INTERNAL_ERROR')
    const response = respond(status, { message, ...(code && { code }), ...(error.errors && { errors: error.errors }) })
    throw new AxiosError(
      message,
      status >= 500 ? AxiosError.ERR_BAD_RESPONSE : AxiosError.ERR_BAD_REQUEST,
      config,
      null,
      response,
    )
  }
}
