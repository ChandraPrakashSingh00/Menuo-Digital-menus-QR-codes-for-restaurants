import mongoose from 'mongoose'
import { toJSONPlugin } from './plugins.js'

export const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED']

const restaurantSchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: 80 },
    // Permanent: printed QR codes point at /m/<slug>, so it never changes after creation.
    slug: { type: String, required: true, lowercase: true, trim: true, immutable: true, match: /^[a-z0-9-]{1,64}$/ },
    logo: { type: String, default: '' },
    cover: { type: String, default: '' },
    brandColor: { type: String, default: '#05805F', match: /^#[0-9a-fA-F]{6}$/ },
    description: { type: String, default: '', maxlength: 240 },
    cuisine: { type: String, default: '', maxlength: 80 },
    address: { type: String, default: '', maxlength: 200 },
    phone: { type: String, default: '', maxlength: 30 },
    // Restaurant contact email chosen by the owner. Never exposed on the public menu.
    email: { type: String, default: '', lowercase: true, trim: true, maxlength: 254 },
    openingHours: { type: String, default: '', maxlength: 120 },
    currency: { type: String, enum: CURRENCIES, default: 'INR' },
    isPublished: { type: Boolean, default: true },
    // Restaurants linked to payments are archived, never hard-deleted.
    archivedAt: { type: Date, default: null },
  },
  { timestamps: true },
)

restaurantSchema.index({ slug: 1 }, { unique: true })
restaurantSchema.index({ ownerId: 1, archivedAt: 1, createdAt: 1 })
restaurantSchema.index({ createdAt: -1 })

toJSONPlugin(restaurantSchema, { hide: ['archivedAt'] })

export const Restaurant = mongoose.models.Restaurant || mongoose.model('Restaurant', restaurantSchema)
export default Restaurant
