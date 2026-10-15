import mongoose from 'mongoose'
import { PLAN_IDS } from '../config/plans.js'
import { preventDeletePlugin, toJSONPlugin } from './plugins.js'

export const SUBSCRIPTION_STATUSES = ['trialing', 'active', 'past_due', 'expired', 'cancelled']

// One document per restaurant holding its current billing state. Individual charges live in Payment.
const subscriptionSchema = new mongoose.Schema(
  {
    restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    plan: { type: String, enum: PLAN_IDS, required: true, default: 'starter' },
    status: { type: String, enum: SUBSCRIPTION_STATUSES, required: true },

    trialStartedAt: { type: Date, default: null },
    trialEndsAt: { type: Date, default: null },
    currentPeriodStart: { type: Date, default: null },
    currentPeriodEnd: { type: Date, default: null },
    cancelAtPeriodEnd: { type: Boolean, default: false },
    cancelledAt: { type: Date, default: null },

    gateway: { type: String, enum: ['razorpay'], default: 'razorpay' },
    // The gateway subscription that currently pays for this restaurant.
    gatewaySubscriptionId: { type: String, default: null },
    gatewayStatus: { type: String, default: null },
    // A checkout that has been started but not yet confirmed by Razorpay.
    pendingGatewaySubscriptionId: { type: String, default: null },
    pendingPlan: { type: String, enum: [...PLAN_IDS, null], default: null },
    // Gateway subscriptions replaced by a plan change; their events are ignored.
    supersededGatewaySubscriptionIds: { type: [String], default: [] },
    // created_at of the last gateway event applied, to ignore out-of-order deliveries.
    gatewayEventAt: { type: Date, default: null },
  },
  { timestamps: true },
)

subscriptionSchema.index({ restaurantId: 1 }, { unique: true })
subscriptionSchema.index({ gatewaySubscriptionId: 1 }, { sparse: true })
subscriptionSchema.index({ pendingGatewaySubscriptionId: 1 }, { sparse: true })
subscriptionSchema.index({ status: 1, plan: 1, createdAt: -1 })
subscriptionSchema.index({ ownerId: 1 })

toJSONPlugin(subscriptionSchema, { hide: ['gatewayEventAt', 'supersededGatewaySubscriptionIds'] })
preventDeletePlugin(subscriptionSchema, { modelName: 'Subscription' })

export const Subscription = mongoose.models.Subscription || mongoose.model('Subscription', subscriptionSchema)
export default Subscription
