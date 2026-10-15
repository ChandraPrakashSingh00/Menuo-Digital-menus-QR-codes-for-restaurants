import { Router } from 'express'
import {
  createCategory,
  createItem,
  deleteCategory,
  deleteItem,
  duplicateItem,
  listCategories,
  listItems,
  reorderCategories,
  updateCategory,
  updateItem,
} from '../controllers/menuController.js'
import { requireAuth } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import {
  createCategoryBody,
  createItemBody,
  idParams,
  listItemsQuery,
  reorderCategoriesBody,
  restaurantParams,
  updateCategoryBody,
  updateItemBody,
} from '../validators/schemas.js'

const router = Router()

router.use(requireAuth)

// Single item / category (ownership is resolved through the record's restaurant).
router.patch('/item/:id', validate({ params: idParams, body: updateItemBody }), updateItem)
router.delete('/item/:id', validate({ params: idParams }), deleteItem)
router.post('/item/:id/duplicate', validate({ params: idParams }), duplicateItem)
router.patch('/category/:id', validate({ params: idParams, body: updateCategoryBody }), updateCategory)
router.delete('/category/:id', validate({ params: idParams }), deleteCategory)

// Collections of a restaurant.
router.get('/:restaurantId/categories', validate({ params: restaurantParams }), listCategories)
router.post('/:restaurantId/categories', validate({ params: restaurantParams, body: createCategoryBody }), createCategory)
router.put('/:restaurantId/categories/order', validate({ params: restaurantParams, body: reorderCategoriesBody }), reorderCategories)
router.get('/:restaurantId', validate({ params: restaurantParams, query: listItemsQuery }), listItems)
router.post('/:restaurantId', validate({ params: restaurantParams, body: createItemBody }), createItem)

export default router
