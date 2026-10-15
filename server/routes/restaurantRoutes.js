import { Router } from 'express'
import {
  archiveRestaurant,
  createRestaurant,
  getRestaurant,
  getRestaurantStats,
  listMyRestaurants,
  updateRestaurant,
} from '../controllers/restaurantController.js'
import { requireAuth } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { createRestaurantBody, idParams, updateRestaurantBody } from '../validators/schemas.js'

const router = Router()

router.use(requireAuth)

router.get('/mine', listMyRestaurants)
router.post('/', validate({ body: createRestaurantBody }), createRestaurant)
router.get('/:id', validate({ params: idParams }), getRestaurant)
router.patch('/:id', validate({ params: idParams, body: updateRestaurantBody }), updateRestaurant)
router.delete('/:id', validate({ params: idParams }), archiveRestaurant)
router.get('/:id/stats', validate({ params: idParams }), getRestaurantStats)

export default router
