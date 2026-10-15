import Payment from '../models/Payment.js'
import Restaurant from '../models/Restaurant.js'
import Subscription from '../models/Subscription.js'
import User from '../models/User.js'
import { computeAccess } from '../services/subscriptionService.js'
import { escapeRegex, paginate, paginationMeta } from '../utils/helpers.js'

// Read-only views for super admins. Mounted behind requireAuth + requireRole('admin').

const searchPattern = (search) => (search ? new RegExp(escapeRegex(search), 'i') : null)

async function paged(Model, filter, query, { sort = { createdAt: -1 }, populate } = {}) {
  const { page, limit, skip } = paginate(query)
  let find = Model.find(filter).sort(sort).skip(skip).limit(limit)
  if (populate) find = find.populate(populate)
  const [docs, total] = await Promise.all([find, Model.countDocuments(filter)])
  return { docs, pagination: paginationMeta({ page, limit, total }) }
}

/** GET /api/admin/stats */
export async function getStats(req, res) {
  const [users, restaurants, subscriptionsByStatus, revenue] = await Promise.all([
    User.countDocuments(),
    Restaurant.countDocuments({ archivedAt: null }),
    Subscription.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Payment.aggregate([{ $match: { status: 'captured' } }, { $group: { _id: '$currency', amount: { $sum: '$amount' }, count: { $sum: 1 } } }]),
  ])
  res.json({
    users,
    restaurants,
    subscriptions: Object.fromEntries(subscriptionsByStatus.map((s) => [s._id, s.count])),
    revenue: revenue.map((r) => ({ currency: r._id, amount: r.amount, payments: r.count })),
  })
}

/** GET /api/admin/users?page=&limit=&search=&role= */
export async function listUsers(req, res) {
  const { search, role, ...pageQuery } = req.valid.query
  const filter = {}
  if (role) filter.role = role
  const pattern = searchPattern(search)
  if (pattern) filter.$or = [{ name: pattern }, { email: pattern }]

  const { docs, pagination } = await paged(User, filter, pageQuery)
  res.json({ users: docs, pagination })
}

/** GET /api/admin/restaurants?page=&limit=&search=&status=published|unpublished|archived */
export async function listRestaurants(req, res) {
  const { search, status, ...pageQuery } = req.valid.query
  const filter = {}
  if (status === 'archived') filter.archivedAt = { $ne: null }
  else if (status) Object.assign(filter, { archivedAt: null, isPublished: status === 'published' })
  const pattern = searchPattern(search)
  if (pattern) filter.$or = [{ name: pattern }, { slug: pattern }]

  const { docs, pagination } = await paged(Restaurant, filter, pageQuery, { populate: { path: 'ownerId', select: 'name email' } })
  res.json({
    restaurants: docs.map((r) => {
      const { ownerId: owner, logo: _logo, cover: _cover, ...data } = r.toJSON()
      return { ...data, archived: Boolean(r.archivedAt), owner: owner && { id: owner.id, name: owner.name, email: owner.email } }
    }),
    pagination,
  })
}

/** GET /api/admin/subscriptions?page=&limit=&search=&status=&plan= */
export async function listSubscriptions(req, res) {
  const { search, status, plan, ...pageQuery } = req.valid.query
  const filter = {}
  if (status) filter.status = status
  if (plan) filter.plan = plan
  const pattern = searchPattern(search)
  if (pattern) {
    const restaurants = await Restaurant.find({ $or: [{ name: pattern }, { slug: pattern }] }).select('_id').limit(500).lean()
    filter.restaurantId = { $in: restaurants.map((r) => r._id) }
  }

  const { docs, pagination } = await paged(Subscription, filter, pageQuery, {
    sort: { updatedAt: -1 },
    populate: { path: 'restaurantId', select: 'name slug' },
  })
  res.json({
    subscriptions: docs.map((s) => {
      const { restaurantId: restaurant, ...data } = s.toJSON()
      return {
        ...data,
        hasAccess: computeAccess(s),
        restaurant: restaurant && { id: restaurant.id, name: restaurant.name, slug: restaurant.slug },
      }
    }),
    pagination,
  })
}

/** GET /api/admin/payments?page=&limit=&search=&status= */
export async function listPayments(req, res) {
  const { search, status, ...pageQuery } = req.valid.query
  const filter = {}
  if (status) filter.status = status
  if (search) filter.$or = [{ gatewayPaymentId: search }, { gatewaySubscriptionId: search }]

  const { docs, pagination } = await paged(Payment, filter, pageQuery, { populate: { path: 'restaurantId', select: 'name slug' } })
  res.json({
    payments: docs.map((p) => {
      const { restaurantId: restaurant, ...data } = p.toJSON()
      return { ...data, restaurant: restaurant && { id: restaurant.id, name: restaurant.name, slug: restaurant.slug } }
    }),
    pagination,
  })
}
