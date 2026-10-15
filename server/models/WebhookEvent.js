import mongoose from 'mongoose'

// Deduplicates gateway webhook deliveries (Razorpay retries and may send an event more than once).
const webhookEventSchema = new mongoose.Schema(
  {
    provider: { type: String, enum: ['razorpay'], required: true },
    eventId: { type: String, required: true },
    event: { type: String, required: true },
    status: { type: String, enum: ['processing', 'processed', 'ignored', 'failed'], required: true },
    error: { type: String, default: null },
  },
  { timestamps: true },
)

webhookEventSchema.index({ provider: 1, eventId: 1 }, { unique: true })
// Razorpay retries for about 24 hours; keep 90 days for debugging, then let MongoDB expire them.
webhookEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 86400 })

export const WebhookEvent = mongoose.models.WebhookEvent || mongoose.model('WebhookEvent', webhookEventSchema)
export default WebhookEvent
