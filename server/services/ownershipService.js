// Every private endpoint resolves records through these helpers so that ownership is
// always checked. Records owned by someone else are reported as "not found" to avoid
// revealing that they exist.

import Category from '../models/Category.js'
import MenuItem from '../models/MenuItem.js'
import Restaurant from '../models/Restaurant.js'
import { ApiError } from '../utils/ApiError.js'

export async function findOwnedRestaurant(restaurantId, userId) {
  const restaurant = await Restaurant.findOne({ _id: restaurantId, ownerId: userId, archivedAt: null })
  if (!restaurant) throw ApiError.notFound('Restaurant not found.')
  return restaurant
}

export async function findOwnedItem(itemId, userId) {
  const item = await MenuItem.findById(itemId)
  const restaurant = item && (await Restaurant.findOne({ _id: item.restaurantId, ownerId: userId, archivedAt: null }))
  if (!item || !restaurant) throw ApiError.notFound('Menu item not found.')
  return { item, restaurant }
}

export async function findOwnedCategory(categoryId, userId) {
  const category = await Category.findById(categoryId)
  const restaurant = category && (await Restaurant.findOne({ _id: category.restaurantId, ownerId: userId, archivedAt: null }))
  if (!category || !restaurant) throw ApiError.notFound('Category not found.')
  return { category, restaurant }
}

/** A category that belongs to the given restaurant, or a 400 if the client sent a foreign one. */
export async function findRestaurantCategory(restaurantId, categoryId) {
  const category = await Category.findOne({ _id: categoryId, restaurantId })
  if (!category) {
    throw ApiError.badRequest('Choose a category from this restaurant.', { code: 'INVALID_CATEGORY', errors: { categoryId: 'Category not found' } })
  }
  return category
}
