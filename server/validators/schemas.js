import { z } from 'zod'
import { PLAN_IDS } from '../config/plans.js'
import { ITEM_TAGS, MAX_PRICE } from '../models/MenuItem.js'
import { PAYMENT_STATUSES } from '../models/Payment.js'
import { CURRENCIES } from '../models/Restaurant.js'
import { SUBSCRIPTION_STATUSES } from '../models/Subscription.js'
import { USER_ROLES } from '../models/User.js'

// ---------- building blocks ----------

export const objectId = (label = 'id') => z.string().regex(/^[a-f\d]{24}$/i, `Invalid ${label}`)

/** Error message that distinguishes a missing value from one of the wrong type. */
const typeError = (label, expected) => ({
  error: (issue) => (issue.input === undefined ? `${label} is required` : `${label} must be ${expected}`),
})

const text = (label, max, min = 0) => {
  let schema = z.string(typeError(label, 'text')).trim()
  if (min > 0) schema = schema.min(min, `${label} is required`)
  return schema.max(max, `${label} must be at most ${max} characters`)
}

const emailField = z
  .string(typeError('Email', 'text'))
  .trim()
  .toLowerCase()
  .max(254, 'Email is too long')
  .pipe(z.email('Enter a valid email address'))

const optionalEmail = z.union([z.literal(''), emailField])

const passwordField = z
  .string(typeError('Password', 'text'))
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be at most 72 characters')
  .refine((value) => Buffer.byteLength(value, 'utf8') <= 72, 'Password is too long')

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

/** An http(s) image URL, a base64 image data URL (what the React app uploads today), or "" to clear. */
const imageField = z
  .string({ error: 'Image must be a URL' })
  .trim()
  .max(MAX_IMAGE_CHARS, 'Image is too large (max 1 MB)')
  .refine((value) => value === '' || DATA_URL.test(value) || isHttpUrl(value), 'Use an http(s) image URL or upload a PNG, JPG or WebP image')

const hexColor = z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, 'Use a hex colour like #05805F')
const phone = text('Phone', 30).regex(/^[0-9+()\-.\s]*$/, 'Enter a valid phone number')

const page = z.coerce.number().int().min(1).max(100000).default(1)
const limit = (max, fallback) => z.coerce.number().int().min(1).max(max).default(fallback)
const booleanQuery = z
  .enum(['true', 'false'])
  .optional()
  .transform((value) => (value === undefined ? undefined : value === 'true'))

const notEmpty = (value) => Object.keys(value).length > 0
const NOTHING_TO_UPDATE = 'Send at least one field to update'

// ---------- auth ----------

export const registerBody = z.strictObject({
  name: text('Name', 80, 2),
  email: emailField,
  password: passwordField,
})

export const loginBody = z.strictObject({
  email: emailField,
  password: z.string({ error: 'Password is required' }).min(1, 'Password is required').max(200),
})

export const profileBody = z
  .strictObject({
    name: text('Name', 80, 2).optional(),
    email: emailField.optional(),
  })
  .refine(notEmpty, NOTHING_TO_UPDATE)

export const passwordBody = z.strictObject({
  currentPassword: z.string({ error: 'Current password is required' }).min(1, 'Current password is required').max(200),
  newPassword: passwordField,
})

// ---------- restaurants ----------

const restaurantFields = {
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
  currency: z.enum(CURRENCIES, 'Unsupported currency'),
  isPublished: z.boolean('isPublished must be true or false'),
}

export const idParams = z.object({ id: objectId() })

export const createRestaurantBody = z.strictObject({
  ...Object.fromEntries(Object.entries(restaurantFields).map(([key, schema]) => [key, key === 'name' ? schema : schema.optional()])),
  plan: z.enum(PLAN_IDS, 'Unknown plan').default('starter'),
})

// `slug` is intentionally absent: menu links are permanent once created.
export const updateRestaurantBody = z
  .strictObject(Object.fromEntries(Object.entries(restaurantFields).map(([key, schema]) => [key, schema.optional()])))
  .refine(notEmpty, NOTHING_TO_UPDATE)

// ---------- menu ----------

export const restaurantParams = z.object({ restaurantId: objectId('restaurant id') })

const price = z
  .number(typeError('Price', 'a number'))
  .min(0, 'Price cannot be negative')
  .max(MAX_PRICE, 'Price is too high')
  .transform((value) => Math.round(value * 100) / 100)

const itemFields = {
  categoryId: objectId('category'),
  name: text('Item name', 80, 1),
  description: text('Description', 300),
  price,
  imageUrl: imageField,
  tags: z
    .array(z.enum(ITEM_TAGS, 'Unknown tag'))
    .max(ITEM_TAGS.length)
    .transform((tags) => [...new Set(tags)]),
  isAvailable: z.boolean('isAvailable must be true or false'),
  isFeatured: z.boolean('isFeatured must be true or false'),
  sortOrder: z.number().finite().min(-1e6).max(1e6),
}

export const createItemBody = z.strictObject({
  categoryId: itemFields.categoryId,
  name: itemFields.name,
  price: itemFields.price,
  description: itemFields.description.optional(),
  imageUrl: itemFields.imageUrl.optional(),
  tags: itemFields.tags.optional(),
  isAvailable: itemFields.isAvailable.optional(),
  isFeatured: itemFields.isFeatured.optional(),
  sortOrder: itemFields.sortOrder.optional(),
})

export const updateItemBody = z
  .strictObject(Object.fromEntries(Object.entries(itemFields).map(([key, schema]) => [key, schema.optional()])))
  .refine(notEmpty, NOTHING_TO_UPDATE)

export const listItemsQuery = z.object({
  categoryId: objectId('category').optional(),
  search: z.string().trim().max(100).optional(),
  available: booleanQuery,
  page,
  limit: limit(500, 100),
})

const categoryFields = {
  name: text('Category name', 40, 1),
  description: text('Description', 200),
  isVisible: z.boolean('isVisible must be true or false'),
  sortOrder: z.number().finite().min(-1e6).max(1e6),
}

export const createCategoryBody = z.strictObject({
  name: categoryFields.name,
  description: categoryFields.description.optional(),
  isVisible: categoryFields.isVisible.optional(),
  sortOrder: categoryFields.sortOrder.optional(),
})

export const updateCategoryBody = z
  .strictObject(Object.fromEntries(Object.entries(categoryFields).map(([key, schema]) => [key, schema.optional()])))
  .refine(notEmpty, NOTHING_TO_UPDATE)

export const reorderCategoriesBody = z.strictObject({
  ids: z.array(objectId('category')).min(1, 'Send the category ids in their new order').max(500),
})

// ---------- public ----------

export const slugParams = z.object({
  slug: z
    .string()
    .toLowerCase()
    .regex(/^[a-z0-9-]{1,64}$/, 'Invalid menu link'),
})

// ---------- subscriptions ----------

export const restaurantQuery = z.object({ restaurantId: objectId('restaurant id') })

export const paymentsQuery = z.object({
  restaurantId: objectId('restaurant id'),
  page,
  limit: limit(50, 10),
})

export const checkoutBody = z.strictObject({
  restaurantId: objectId('restaurant id'),
  plan: z.enum(PLAN_IDS, 'Choose the Starter or Pro plan'),
})

export const verifyCheckoutBody = z.strictObject({
  restaurantId: objectId('restaurant id'),
  razorpay_payment_id: z.string().regex(/^pay_[A-Za-z0-9]{6,40}$/, 'Invalid payment id'),
  razorpay_subscription_id: z.string().regex(/^sub_[A-Za-z0-9]{6,40}$/, 'Invalid subscription id'),
  razorpay_signature: z.string().regex(/^[a-f0-9]{64}$/i, 'Invalid signature'),
})

export const restaurantBody = z.strictObject({ restaurantId: objectId('restaurant id') })

// ---------- admin ----------

const adminList = {
  page,
  limit: limit(100, 20),
  search: z.string().trim().max(100).optional(),
}

export const adminUsersQuery = z.object({ ...adminList, role: z.enum(USER_ROLES).optional() })

export const adminRestaurantsQuery = z.object({
  ...adminList,
  status: z.enum(['published', 'unpublished', 'archived']).optional(),
})

export const adminSubscriptionsQuery = z.object({
  ...adminList,
  status: z.enum(SUBSCRIPTION_STATUSES).optional(),
  plan: z.enum(PLAN_IDS).optional(),
})

export const adminPaymentsQuery = z.object({ ...adminList, status: z.enum(PAYMENT_STATUSES).optional() })
