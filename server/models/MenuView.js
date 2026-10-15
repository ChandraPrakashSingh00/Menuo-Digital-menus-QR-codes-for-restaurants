import mongoose from 'mongoose'

// One counter per restaurant per day, incremented when a guest opens the public menu.
const menuViewSchema = new mongoose.Schema({
  restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true },
  date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  count: { type: Number, default: 0, min: 0 },
})

menuViewSchema.index({ restaurantId: 1, date: 1 }, { unique: true })

export const MenuView = mongoose.models.MenuView || mongoose.model('MenuView', menuViewSchema)
export default MenuView
