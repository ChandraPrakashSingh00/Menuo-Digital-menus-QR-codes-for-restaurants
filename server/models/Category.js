import mongoose from 'mongoose'
import { toJSONPlugin } from './plugins.js'

const categorySchema = new mongoose.Schema(
  {
    restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true },
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: 40 },
    description: { type: String, default: '', maxlength: 200 },
    isVisible: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true },
)

categorySchema.index({ restaurantId: 1, sortOrder: 1 })

toJSONPlugin(categorySchema)

export const Category = mongoose.models.Category || mongoose.model('Category', categorySchema)
export default Category
