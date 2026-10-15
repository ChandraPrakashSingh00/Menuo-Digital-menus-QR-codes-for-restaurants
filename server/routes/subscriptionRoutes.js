import { Router } from 'express'
import {
  cancel,
  checkout,
  getCurrentSubscription,
  listPayments,
  listPlans,
  verifyCheckout,
} from '../controllers/subscriptionController.js'
import { requireAuth } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { checkoutBody, paymentsQuery, restaurantBody, restaurantQuery, verifyCheckoutBody } from '../validators/schemas.js'

const router = Router()

router.get('/plans', listPlans)

router.use(requireAuth)
router.get('/current', validate({ query: restaurantQuery }), getCurrentSubscription)
router.get('/payments', validate({ query: paymentsQuery }), listPayments)
router.post('/checkout', validate({ body: checkoutBody }), checkout)
router.post('/verify', validate({ body: verifyCheckoutBody }), verifyCheckout)
router.post('/cancel', validate({ body: restaurantBody }), cancel)

export default router
