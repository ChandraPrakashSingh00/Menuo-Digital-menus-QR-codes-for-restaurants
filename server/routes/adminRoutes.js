import { Router } from 'express'
import { getStats, listPayments, listRestaurants, listSubscriptions, listUsers } from '../controllers/adminController.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { adminPaymentsQuery, adminRestaurantsQuery, adminSubscriptionsQuery, adminUsersQuery } from '../validators/schemas.js'

const router = Router()

// Every admin route requires a signed-in user whose role is "admin".
router.use(requireAuth, requireRole('admin'))

router.get('/stats', getStats)
router.get('/users', validate({ query: adminUsersQuery }), listUsers)
router.get('/restaurants', validate({ query: adminRestaurantsQuery }), listRestaurants)
router.get('/subscriptions', validate({ query: adminSubscriptionsQuery }), listSubscriptions)
router.get('/payments', validate({ query: adminPaymentsQuery }), listPayments)

export default router
