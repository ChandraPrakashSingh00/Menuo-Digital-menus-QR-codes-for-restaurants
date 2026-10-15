import mongoose from 'mongoose'
import { PLAN_IDS } from '../config/plans.js'
import { preventDeletePlugin, toJSONPlugin } from './plugins.js'

export const PAYMENT_STATUSES = ['created', 'authorized', 'captured', 'failed', 'refunded']

// A record of one gateway charge. Only gateway identifiers and amounts are stored —
// never card numbers, CVV, UPI PINs or any other payment credentials.
const paymentSchema = new mongoose.Schema(
  {
    restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true },
    subscriptionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscription', required: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    plan: { type: String, enum: [...PLAN_IDS, null], default: null },

    gateway: { type: String, enum: ['razorpay'], default: 'razorpay' },
    gatewayPaymentId: { type: String, required: true },
    gatewaySubscriptionId: { type: String, default: null },
    gatewayInvoiceId: { type: String, default: null },
    gatewayOrderId: { type: String, default: null },

    amount: { type: Number, required: true, min: 0 }, // smallest currency unit (paise)
    currency: { type: String, required: true, default: 'INR' },
    status: { type: String, enum: PAYMENT_STATUSES, required: true },
    method: { type: String, default: null }, // e.g. "card", "upi" — the type only
    errorCode: { type: String, default: null },
    errorDescription: { type: String, default: null },
    paidAt: { type: Date, default: null },
  },
  { timestamps: true },
)

paymentSchema.index({ gatewayPaymentId: 1 }, { unique: true })
paymentSchema.index({ restaurantId: 1, createdAt: -1 })
paymentSchema.index({ gatewaySubscriptionId: 1 })
paymentSchema.index({ status: 1, createdAt: -1 })

toJSONPlugin(paymentSchema)
preventDeletePlugin(paymentSchema, { modelName: 'Payment' })

export const Payment = mongoose.models.Payment || mongoose.model('Payment', paymentSchema)
export default Payment
