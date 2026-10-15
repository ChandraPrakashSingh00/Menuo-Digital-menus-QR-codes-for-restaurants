import { config } from '../config/env.js'
import { getPlan } from '../config/plans.js'
import Category from '../models/Category.js'
import MenuItem from '../models/MenuItem.js'
import MenuView from '../models/MenuView.js'
import Restaurant from '../models/Restaurant.js'
import { findOwnedCategory, findOwnedItem, findOwnedRestaurant, findRestaurantCategory } from '../services/ownershipService.js'
import {
  assertCanAddItems,
  assertHasAccess,
  computeAccess,
  enforceItemLimitAfterInsert,
  getSubscription,
} from '../services/subscriptionService.js'
import { ApiError } from '../utils/ApiError.js'
import { dayKey, escapeRegex, paginate, paginationMeta } from '../utils/helpers.js'

export function serializeItem(item, categoryName) {
  const data = item.toJSON()
  return categoryName === undefined ? data : { ...data, category: categoryName }
}

async function categoryNames(restaurantId) {
  const categories = await Category.find({ restaurantId }).select('name').lean()
  return Object.fromEntries(categories.map((c) => [String(c._id), c.name]))
}

async function nextSortOrder(Model, filter) {
  const last = await Model.findOne(filter).sort({ sortOrder: -1 }).select('sortOrder').lean()
  return last ? Math.floor(last.sortOrder) + 1 : 0
}

async function writableSubscription(restaurant) {
  const subscription = await getSubscription(restaurant)
  assertHasAccess(subscription)
  return subscription
}

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------

/** GET /api/menu/:restaurantId?categoryId=&search=&available=&page=&limit= */
export async function listItems(req, res) {
  const restaurant = await findOwnedRestaurant(req.valid.params.restaurantId, req.user._id)
  const { categoryId, search, available, ...pageQuery } = req.valid.query
  const { page, limit, skip } = paginate(pageQuery)

  const filter = { restaurantId: restaurant._id }
  if (categoryId) filter.categoryId = categoryId
  if (available !== undefined) filter.isAvailable = available
  if (search) {
    const pattern = new RegExp(escapeRegex(search), 'i')
    filter.$or = [{ name: pattern }, { description: pattern }]
  }

  const [items, total, names] = await Promise.all([
    MenuItem.find(filter).sort({ sortOrder: 1, createdAt: 1 }).skip(skip).limit(limit),
    MenuItem.countDocuments(filter),
    categoryNames(restaurant._id),
  ])

  res.json({
    items: items.map((item) => serializeItem(item, names[String(item.categoryId)] || null)),
    pagination: paginationMeta({ page, limit, total }),
  })
}

/** POST /api/menu/:restaurantId */
export async function createItem(req, res) {
  const restaurant = await findOwnedRestaurant(req.valid.params.restaurantId, req.user._id)
  const subscription = await writableSubscription(restaurant)
  const body = req.valid.body
  const category = await findRestaurantCategory(restaurant._id, body.categoryId)
  await assertCanAddItems(restaurant._id, subscription)

  const item = await MenuItem.create({
    ...body,
    restaurantId: restaurant._id,
    sortOrder: body.sortOrder ?? (await nextSortOrder(MenuItem, { restaurantId: restaurant._id, categoryId: category._id })),
  })
  await enforceItemLimitAfterInsert(restaurant._id, subscription, item)
  res.status(201).json({ item: serializeItem(item, category.name) })
}

/** PATCH /api/menu/item/:id — any subset of fields, e.g. { isAvailable: false } or { price: 249 }. */
export async function updateItem(req, res) {
  const { item, restaurant } = await findOwnedItem(req.valid.params.id, req.user._id)
  await writableSubscription(restaurant)
  const body = req.valid.body

  const category = await findRestaurantCategory(restaurant._id, body.categoryId ?? item.categoryId)
  item.set(body)
  await item.save()
  res.json({ item: serializeItem(item, category.name) })
}

/** DELETE /api/menu/item/:id — allowed even without an active plan, so owners can trim their menu. */
export async function deleteItem(req, res) {
  const { item } = await findOwnedItem(req.valid.params.id, req.user._id)
  await item.deleteOne()
  res.json({ message: 'Item deleted.', id: item.id })
}

/** POST /api/menu/item/:id/duplicate */
export async function duplicateItem(req, res) {
  const { item: source, restaurant } = await findOwnedItem(req.valid.params.id, req.user._id)
  const subscription = await writableSubscription(restaurant)
  await assertCanAddItems(restaurant._id, subscription)

  const { _id, __v, createdAt, updatedAt, ...fields } = source.toObject()
  const copy = await MenuItem.create({
    ...fields,
    name: `${source.name} (copy)`.slice(0, 80),
    sortOrder: source.sortOrder + 0.5,
  })
  await enforceItemLimitAfterInsert(restaurant._id, subscription, copy)
  const names = await categoryNames(restaurant._id)
  res.status(201).json({ item: serializeItem(copy, names[String(copy.categoryId)] || null) })
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

async function categoriesWithCounts(restaurantId) {
  const [categories, counts] = await Promise.all([
    Category.find({ restaurantId }).sort({ sortOrder: 1, createdAt: 1 }),
    MenuItem.aggregate([{ $match: { restaurantId } }, { $group: { _id: '$categoryId', count: { $sum: 1 } } }]),
  ])
  const countById = Object.fromEntries(counts.map((c) => [String(c._id), c.count]))
  return categories.map((category) => ({ ...category.toJSON(), itemCount: countById[category.id] || 0 }))
}

/** GET /api/menu/:restaurantId/categories */
export async function listCategories(req, res) {
  const restaurant = await findOwnedRestaurant(req.valid.params.restaurantId, req.user._id)
  res.json({ categories: await categoriesWithCounts(restaurant._id) })
}

/** POST /api/menu/:restaurantId/categories */
export async function createCategory(req, res) {
  const restaurant = await findOwnedRestaurant(req.valid.params.restaurantId, req.user._id)
  await writableSubscription(restaurant)
  const count = await Category.countDocuments({ restaurantId: restaurant._id })
  if (count >= 200) throw ApiError.forbidden('A menu can have up to 200 categories.', { code: 'CATEGORY_LIMIT' })

  const body = req.valid.body
  const category = await Category.create({
    ...body,
    restaurantId: restaurant._id,
    sortOrder: body.sortOrder ?? (await nextSortOrder(Category, { restaurantId: restaurant._id })),
  })
  res.status(201).json({ category: { ...category.toJSON(), itemCount: 0 } })
}

/** PATCH /api/menu/category/:id */
export async function updateCategory(req, res) {
  const { category, restaurant } = await findOwnedCategory(req.valid.params.id, req.user._id)
  await writableSubscription(restaurant)
  category.set(req.valid.body)
  await category.save()
  const itemCount = await MenuItem.countDocuments({ categoryId: category._id })
  res.json({ category: { ...category.toJSON(), itemCount } })
}

/** DELETE /api/menu/category/:id — also deletes the items in it. */
export async function deleteCategory(req, res) {
  const { category } = await findOwnedCategory(req.valid.params.id, req.user._id)
  const { deletedCount } = await MenuItem.deleteMany({ restaurantId: category.restaurantId, categoryId: category._id })
  await category.deleteOne()
  res.json({ message: 'Category deleted.', id: category.id, deletedItems: deletedCount })
}

/** PUT /api/menu/:restaurantId/categories/order  { ids: [...] } */
export async function reorderCategories(req, res) {
  const restaurant = await findOwnedRestaurant(req.valid.params.restaurantId, req.user._id)
  await writableSubscription(restaurant)
  const ids = [...new Set(req.valid.body.ids)]

  const owned = await Category.countDocuments({ restaurantId: restaurant._id, _id: { $in: ids } })
  if (owned !== ids.length) throw ApiError.badRequest('Some categories do not belong to this restaurant.', { code: 'INVALID_CATEGORY' })

  await Category.bulkWrite(
    ids.map((id, index) => ({ updateOne: { filter: { _id: id, restaurantId: restaurant._id }, update: { $set: { sortOrder: index } } } })),
  )
  res.json({ categories: await categoriesWithCounts(restaurant._id) })
}

// ---------------------------------------------------------------------------
// Public digital menu (no login)
// ---------------------------------------------------------------------------

const MENU_UNAVAILABLE = 'This menu is not available right now.'

async function findLiveRestaurant(slug) {
  const restaurant = await Restaurant.findOne({ slug, isPublished: true, archivedAt: null })
  if (!restaurant) return null
  const subscription = await getSubscription(restaurant)
  return computeAccess(subscription) ? { restaurant, subscription } : null
}

/**
 * GET /api/public/menu/:slug — only published restaurants with an active plan or trial.
 * Exposes branding, public contact details, visible categories and available items;
 * never owner details, internal ids of the restaurant/owner, or billing data.
 */
export async function getPublicMenu(req, res) {
  const live = await findLiveRestaurant(req.valid.params.slug)
  if (!live) throw ApiError.notFound(MENU_UNAVAILABLE, { code: 'MENU_UNAVAILABLE' })
  const { restaurant, subscription } = live

  const categories = await Category.find({ restaurantId: restaurant._id, isVisible: true }).sort({ sortOrder: 1, createdAt: 1 }).lean()
  const items = await MenuItem.find({
    restaurantId: restaurant._id,
    isAvailable: true,
    categoryId: { $in: categories.map((c) => c._id) },
  })
    .sort({ sortOrder: 1, createdAt: 1 })
    .lean()

  // Always revalidate so price and availability changes show up on the next scan.
  res.set('Cache-Control', 'no-cache')
  res.json({
    restaurant: {
      name: restaurant.name,
      slug: restaurant.slug,
      logo: restaurant.logo,
      cover: restaurant.cover,
      brandColor: restaurant.brandColor,
      description: restaurant.description,
      cuisine: restaurant.cuisine,
      address: restaurant.address,
      phone: restaurant.phone,
      openingHours: restaurant.openingHours,
      currency: restaurant.currency,
    },
    categories: categories.map((c) => ({ id: String(c._id), name: c.name, description: c.description, sortOrder: c.sortOrder })),
    items: items.map((i) => ({
      id: String(i._id),
      categoryId: String(i.categoryId),
      name: i.name,
      description: i.description,
      price: i.price,
      imageUrl: i.imageUrl,
      tags: i.tags,
      isAvailable: i.isAvailable,
      isFeatured: i.isFeatured,
      sortOrder: i.sortOrder,
    })),
    showBranding: getPlan(subscription.plan).id === 'starter',
  })
}

/** POST /api/public/menu/:slug/views — anonymous page-view counter (rate limited per IP). */
export async function recordMenuView(req, res) {
  const live = await findLiveRestaurant(req.valid.params.slug)
  if (!live) throw ApiError.notFound(MENU_UNAVAILABLE, { code: 'MENU_UNAVAILABLE' })
  await MenuView.updateOne(
    { restaurantId: live.restaurant._id, date: dayKey(new Date(), config.analyticsTimezone) },
    { $inc: { count: 1 } },
    { upsert: true },
  )
  res.json({ recorded: true })
}
