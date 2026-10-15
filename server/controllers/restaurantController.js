import { config } from '../config/env.js'
import Category from '../models/Category.js'
import MenuItem from '../models/MenuItem.js'
import MenuView from '../models/MenuView.js'
import Restaurant from '../models/Restaurant.js'
import { findOwnedRestaurant } from '../services/ownershipService.js'
import { createInitialSubscription, getSubscription, serializeSubscription } from '../services/subscriptionService.js'
import { ApiError } from '../utils/ApiError.js'
import { generateUniqueSlug, randomSlugVariant } from '../utils/generateSlug.js'
import { dayKey, isDuplicateKeyError } from '../utils/helpers.js'
import { serializeItem } from './menuController.js'

const MAX_RESTAURANTS_PER_OWNER = 10
const DAY_MS = 86400000

export function serializeRestaurant(restaurant) {
  const { ownerId: _ownerId, ...data } = restaurant.toJSON()
  return data
}

/** GET /api/restaurants/mine */
export async function listMyRestaurants(req, res) {
  const restaurants = await Restaurant.find({ ownerId: req.user._id, archivedAt: null }).sort({ createdAt: 1 })
  res.json({ restaurants: restaurants.map(serializeRestaurant) })
}

/** POST /api/restaurants */
export async function createRestaurant(req, res) {
  const { plan, ...fields } = req.valid.body

  const owned = await Restaurant.countDocuments({ ownerId: req.user._id, archivedAt: null })
  if (owned >= MAX_RESTAURANTS_PER_OWNER) {
    throw ApiError.forbidden(`You can manage up to ${MAX_RESTAURANTS_PER_OWNER} restaurants per account.`, { code: 'RESTAURANT_LIMIT' })
  }

  let restaurant
  for (let attempt = 0; !restaurant; attempt++) {
    const slug =
      attempt === 0 ? await generateUniqueSlug(fields.name, (candidate) => Restaurant.exists({ slug: candidate })) : randomSlugVariant(fields.name)
    try {
      restaurant = await Restaurant.create({ ...fields, ownerId: req.user._id, slug })
    } catch (error) {
      // Another restaurant grabbed the same slug between the check and the insert.
      if (!isDuplicateKeyError(error) || attempt >= 3) throw error
    }
  }

  const subscription = await createInitialSubscription({ restaurant, planId: plan })
  res.status(201).json({ restaurant: serializeRestaurant(restaurant), subscription: serializeSubscription(subscription) })
}

/** GET /api/restaurants/:id */
export async function getRestaurant(req, res) {
  const restaurant = await findOwnedRestaurant(req.valid.params.id, req.user._id)
  res.json({ restaurant: serializeRestaurant(restaurant) })
}

/** PATCH /api/restaurants/:id */
export async function updateRestaurant(req, res) {
  const restaurant = await findOwnedRestaurant(req.valid.params.id, req.user._id)
  restaurant.set(req.valid.body)
  await restaurant.save()
  res.json({ restaurant: serializeRestaurant(restaurant) })
}

/**
 * DELETE /api/restaurants/:id — archives, never hard-deletes: payments and subscriptions
 * stay linked for accounting, and the slug stays reserved so old QR codes can't be hijacked.
 */
export async function archiveRestaurant(req, res) {
  const restaurant = await findOwnedRestaurant(req.valid.params.id, req.user._id)
  const subscription = await getSubscription(restaurant)
  const billing = subscription.gatewaySubscriptionId && ['active', 'past_due'].includes(subscription.status) && !subscription.cancelAtPeriodEnd
  if (billing) {
    throw ApiError.conflict('Cancel this restaurant’s subscription before deleting it.', { code: 'SUBSCRIPTION_ACTIVE' })
  }
  restaurant.set({ archivedAt: new Date(), isPublished: false })
  await restaurant.save()
  res.json({ message: 'Restaurant deleted.', id: restaurant.id })
}

/** GET /api/restaurants/:id/stats — dashboard numbers and the 14-day views chart. */
export async function getRestaurantStats(req, res) {
  const restaurant = await findOwnedRestaurant(req.valid.params.id, req.user._id)
  const restaurantId = restaurant._id
  const now = Date.now()
  const days = Array.from({ length: 14 }, (_, i) => dayKey(new Date(now - (13 - i) * DAY_MS), config.analyticsTimezone))

  const [items, availableItems, categories, views, totals, recentItems] = await Promise.all([
    MenuItem.countDocuments({ restaurantId }),
    MenuItem.countDocuments({ restaurantId, isAvailable: true }),
    Category.countDocuments({ restaurantId }),
    MenuView.find({ restaurantId, date: { $in: days } }).lean(),
    MenuView.aggregate([{ $match: { restaurantId } }, { $group: { _id: null, total: { $sum: '$count' } } }]),
    MenuItem.find({ restaurantId }).sort({ updatedAt: -1 }).limit(5),
  ])

  const countByDay = Object.fromEntries(views.map((view) => [view.date, view.count]))
  const viewsByDay = days.map((date) => ({ date, count: countByDay[date] || 0 }))
  const sum = (list) => list.reduce((total, day) => total + day.count, 0)
  const views7d = sum(viewsByDay.slice(7))
  const previous7d = sum(viewsByDay.slice(0, 7))

  res.json({
    totals: {
      items,
      availableItems,
      categories,
      views7d,
      viewsChange: previous7d ? Math.round(((views7d - previous7d) / previous7d) * 100) : null,
      viewsTotal: totals[0]?.total || 0,
    },
    viewsByDay,
    recentItems: recentItems.map((item) => serializeItem(item)),
  })
}
