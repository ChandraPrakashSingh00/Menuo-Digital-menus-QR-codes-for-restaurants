import mongoose from 'mongoose'
import { toJSONPlugin } from './plugins.js'

export const ITEM_TAGS = ['veg', 'non-veg', 'vegan', 'spicy', 'gluten-free', 'bestseller']
export const MAX_PRICE = 1_000_000

const menuItemSchema = new mongoose.Schema(
  {
    restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: 80 },
    description: { type: String, default: '', maxlength: 300 },
    price: {
      type: Number,
      required: true,
      min: [0, 'Price cannot be negative'],
      max: [MAX_PRICE, 'Price is too high'],
    },
    imageUrl: { type: String, default: '' },
    tags: { type: [{ type: String, enum: ITEM_TAGS }], default: [] },
    isAvailable: { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true },
)

// Menu builder and public menu: all items of a restaurant in category + display order.
menuItemSchema.index({ restaurantId: 1, categoryId: 1, sortOrder: 1 })
// Public menu / availability filter.
menuItemSchema.index({ restaurantId: 1, isAvailable: 1 })
// Recently updated items on the dashboard.
menuItemSchema.index({ restaurantId: 1, updatedAt: -1 })

toJSONPlugin(menuItemSchema)

export const MenuItem = mongoose.models.MenuItem || mongoose.model('MenuItem', menuItemSchema)
export default MenuItem
